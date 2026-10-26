const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT) || 3000;
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error('Configura SESSION_SECRET con al menos 32 caracteres en .env.');
  process.exit(1);
}
const databasePath = path.join(__dirname, 'data');
fs.mkdirSync(databasePath, { recursive: true });
const db = new Database(path.join(databasePath, 'registro.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'docente')),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    age INTEGER NOT NULL CHECK(age >= 17 AND age <= 120),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    capacity INTEGER NOT NULL CHECK(capacity > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, subject_id)
  );
`);

const adminUsername = process.env.ADMIN_USER || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD;
if (!db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername)) {
  if (!adminPassword || adminPassword.length < 12) {
    console.error('Configura ADMIN_PASSWORD (mínimo 12 caracteres) antes de iniciar por primera vez.');
    process.exit(1);
  }
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(adminUsername, bcrypt.hashSync(adminPassword, 12), 'admin');
  console.log(`Administrador inicial creado: ${adminUsername}`);
}

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));
app.use(session({
  name: 'registro.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname), { index: 'index.html' }));

const fail = (res, status, message) => res.status(status).json({ error: message });
const requireAuth = (req, res, next) => req.session.user ? next() : fail(res, 401, 'Inicia sesión para continuar.');
const requireAdmin = (req, res, next) => req.session.user?.role === 'admin' ? next() : fail(res, 403, 'Esta acción requiere el rol administrador.');
const text = (value, max = 80) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const positiveInt = value => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;

app.post('/api/login', (req, res) => {
  const username = text(req.body?.username, 50);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = db.prepare('SELECT id, username, password_hash, role, active FROM users WHERE username = ?').get(username);
  if (!user || !user.active || !bcrypt.compareSync(password, user.password_hash)) return fail(res, 401, 'Usuario o contraseña incorrectos.');
  req.session.regenerate(err => {
    if (err) return fail(res, 500, 'No se pudo iniciar la sesión.');
    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.json({ user: req.session.user });
  });
});
app.post('/api/logout', requireAuth, (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/me', (req, res) => res.json({ user: req.session.user || null }));

app.get('/api/students', requireAuth, (req, res) => res.json(db.prepare(`SELECT s.id,s.first_name AS firstName,s.last_name AS lastName,s.age,
  (SELECT COUNT(*) FROM enrollments e WHERE e.student_id=s.id) AS subjectCount FROM students s ORDER BY s.last_name,s.first_name`).all()));
app.post('/api/students', requireAuth, requireAdmin, (req, res) => {
  const firstName = text(req.body?.firstName); const lastName = text(req.body?.lastName); const age = positiveInt(req.body?.age);
  if (!firstName || !lastName || !age || age < 17 || age > 120) return fail(res, 400, 'Completa nombre, apellido y una edad entre 17 y 120.');
  const result = db.prepare('INSERT INTO students(first_name,last_name,age) VALUES(?,?,?)').run(firstName,lastName,age);
  res.status(201).json({ id: result.lastInsertRowid, firstName, lastName, age, subjectCount: 0 });
});
app.put('/api/students/:id', requireAuth, requireAdmin, (req, res) => {
  const id = positiveInt(req.params.id); const firstName = text(req.body?.firstName); const lastName = text(req.body?.lastName); const age = positiveInt(req.body?.age);
  if (!id || !firstName || !lastName || !age || age < 17 || age > 120) return fail(res, 400, 'Datos de alumno no válidos.');
  const result = db.prepare('UPDATE students SET first_name=?,last_name=?,age=? WHERE id=?').run(firstName,lastName,age,id);
  return result.changes ? res.json({ ok: true }) : fail(res, 404, 'Alumno no encontrado.');
});
app.delete('/api/students/:id', requireAuth, requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM students WHERE id=?').run(positiveInt(req.params.id) || -1);
  return result.changes ? res.json({ ok: true }) : fail(res, 404, 'Alumno no encontrado.');
});

app.get('/api/subjects', requireAuth, (req, res) => res.json(db.prepare(`SELECT s.id,s.name,s.capacity,
  (SELECT COUNT(*) FROM enrollments e WHERE e.subject_id=s.id) AS enrolled FROM subjects s ORDER BY s.name`).all()));
app.post('/api/subjects', requireAuth, requireAdmin, (req, res) => {
  const name = text(req.body?.name); const capacity = positiveInt(req.body?.capacity);
  if (!name || !capacity || capacity > 10000) return fail(res, 400, 'Indica una materia y un cupo válido.');
  try { const result = db.prepare('INSERT INTO subjects(name,capacity) VALUES(?,?)').run(name,capacity); res.status(201).json({ id: result.lastInsertRowid,name,capacity,enrolled:0 }); }
  catch { fail(res, 409, 'Ya existe una materia con ese nombre.'); }
});
app.put('/api/subjects/:id', requireAuth, requireAdmin, (req, res) => {
  const id=positiveInt(req.params.id); const name=text(req.body?.name); const capacity=positiveInt(req.body?.capacity);
  if (!id || !name || !capacity || capacity>10000) return fail(res,400,'Datos de materia no válidos.');
  const enrolled=db.prepare('SELECT COUNT(*) AS count FROM enrollments WHERE subject_id=?').get(id).count;
  if(capacity<enrolled) return fail(res,409,`El cupo no puede ser menor que las ${enrolled} inscripciones actuales.`);
  try { const result=db.prepare('UPDATE subjects SET name=?,capacity=? WHERE id=?').run(name,capacity,id); return result.changes?res.json({ok:true}):fail(res,404,'Materia no encontrada.'); }
  catch { return fail(res,409,'Ya existe una materia con ese nombre.'); }
});
app.delete('/api/subjects/:id', requireAuth, requireAdmin, (req, res) => {
  const result=db.prepare('DELETE FROM subjects WHERE id=?').run(positiveInt(req.params.id)||-1);
  return result.changes?res.json({ok:true}):fail(res,404,'Materia no encontrada.');
});

app.get('/api/enrollments', requireAuth, (req,res)=>res.json(db.prepare(`SELECT e.id,e.student_id AS studentId,e.subject_id AS subjectId,
  s.first_name AS firstName,s.last_name AS lastName,m.name AS subjectName FROM enrollments e
  JOIN students s ON s.id=e.student_id JOIN subjects m ON m.id=e.subject_id ORDER BY m.name,s.last_name,s.first_name`).all()));
app.post('/api/enrollments', requireAuth, (req,res)=>{
  const studentId=positiveInt(req.body?.studentId); const subjectId=positiveInt(req.body?.subjectId);
  if(!studentId||!subjectId) return fail(res,400,'Selecciona un alumno y una materia.');
  const student=db.prepare('SELECT id FROM students WHERE id=?').get(studentId); const subject=db.prepare('SELECT id,name,capacity FROM subjects WHERE id=?').get(subjectId);
  if(!student||!subject) return fail(res,404,'El alumno o la materia no existe.');
  const enrolled=db.prepare('SELECT COUNT(*) AS count FROM enrollments WHERE subject_id=?').get(subjectId).count;
  if(enrolled>=subject.capacity) return fail(res,409,'La materia ya alcanzó su cupo.');
  const subjectCount=db.prepare('SELECT COUNT(*) AS count FROM enrollments WHERE student_id=?').get(studentId).count;
  if(subjectCount>=8) return fail(res,409,'El alumno ya alcanzó el máximo de 8 materias.');
  try { db.prepare('INSERT INTO enrollments(student_id,subject_id) VALUES(?,?)').run(studentId,subjectId); res.status(201).json({ok:true}); }
  catch { return fail(res,409,'El alumno ya está inscrito en esa materia.'); }
});
app.delete('/api/enrollments/:id', requireAuth, (req,res)=>{
  const result=db.prepare('DELETE FROM enrollments WHERE id=?').run(positiveInt(req.params.id)||-1);
  return result.changes?res.json({ok:true}):fail(res,404,'Inscripción no encontrada.');
});

app.get('/api/users', requireAuth, requireAdmin, (req,res)=>res.json(db.prepare('SELECT id,username,role,active FROM users ORDER BY username').all()));
app.post('/api/users', requireAuth, requireAdmin, (req,res)=>{
  const username=text(req.body?.username,50); const password=typeof req.body?.password==='string'?req.body.password:''; const role=req.body?.role;
  if(!/^[\p{L}\p{N}_.-]{3,50}$/u.test(username)||password.length<12||!['admin','docente'].includes(role)) return fail(res,400,'Usa un usuario de 3 a 50 caracteres, contraseña de al menos 12 y rol válido.');
  try { const result=db.prepare('INSERT INTO users(username,password_hash,role) VALUES(?,?,?)').run(username,bcrypt.hashSync(password,12),role); res.status(201).json({id:result.lastInsertRowid,username,role,active:1}); }
  catch { return fail(res,409,'Ese usuario ya existe.'); }
});
app.patch('/api/users/:id', requireAuth, requireAdmin, (req,res)=>{
  const id=positiveInt(req.params.id); const user=db.prepare('SELECT id,role,active FROM users WHERE id=?').get(id||-1);
  if(!user)return fail(res,404,'Usuario no encontrado.');
  const role=req.body?.role; const active=req.body?.active;
  if(role!==undefined&&!['admin','docente'].includes(role))return fail(res,400,'Rol no válido.');
  if(active!==undefined&&![true,false].includes(active))return fail(res,400,'Estado no válido.');
  if(id===req.session.user.id&&(active===false||role==='docente'))return fail(res,400,'No puedes desactivar o quitar el rol administrador de tu propia cuenta.');
  if((active===false||role==='docente')&&user.role==='admin'&&user.active&&db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin' AND active=1").get().count<=1)return fail(res,409,'Debe quedar al menos un administrador activo.');
  db.prepare('UPDATE users SET role=?,active=? WHERE id=?').run(role||user.role,active===undefined?user.active:(active?1:0),id);
  res.json({ok:true});
});
app.put('/api/password', requireAuth, (req,res)=>{
  const current=typeof req.body?.currentPassword==='string'?req.body.currentPassword:''; const next=typeof req.body?.newPassword==='string'?req.body.newPassword:'';
  const user=db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.session.user.id);
  if(!bcrypt.compareSync(current,user.password_hash))return fail(res,400,'La contraseña actual no es correcta.');
  if(next.length<12)return fail(res,400,'La nueva contraseña debe tener al menos 12 caracteres.');
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(next,12),req.session.user.id);
  res.json({ok:true});
});

app.use('/api', (_req,res)=>fail(res,404,'Ruta no encontrada.'));
app.listen(port,()=>console.log(`Servidor disponible en http://localhost:${port}`));


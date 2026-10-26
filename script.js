'use strict';
const $ = id => document.getElementById(id);
const state = { user: null, students: [], subjects: [], enrollments: [], users: [] };
const notice = $('notice');
let noticeTimer;
function showNotice(message, error = false) {
  notice.textContent = message;
  notice.className = `mb-5 rounded-lg px-4 py-3 text-sm ${error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => notice.classList.add('hidden'), 5000);
}
async function api(url, options = {}) {
  const response = await fetch(`/api${url}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin'
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && url !== '/login') showLogin();
    throw new Error(data?.error || 'No se pudo completar la operación.');
  }
  return data;
}
function showLogin() {
  state.user = null;
  $('login-panel').classList.remove('hidden');
  $('app-panel').classList.add('hidden');
  $('account-bar').classList.add('hidden');
}
function showApp(user) {
  state.user = user;
  $('login-panel').classList.add('hidden');
  $('app-panel').classList.remove('hidden');
  $('account-bar').classList.remove('hidden');
  $('account-bar').classList.add('flex');
  $('account-name').textContent = user.username;
  $('account-role').textContent = user.role === 'admin' ? 'Administrador' : 'Docente';
  const admin = user.role === 'admin';
  $('student-admin').classList.toggle('hidden', !admin);
  $('subject-admin').classList.toggle('hidden', !admin);
  $('user-admin').classList.toggle('hidden', !admin);
}
function esc(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function empty(text) { return `<p class="empty-state">${text}</p>`; }
function action(label, actionName, id, danger = false) {
  return `<button type="button" class="action-button ${danger ? 'action-danger' : ''}" data-action="${actionName}" data-id="${id}">${label}</button>`;
}
function optionList(select, records, labelFn, selected = '') {
  const prior = String(selected || select.value || '');
  select.replaceChildren(new Option(records.length ? 'Seleccionar…' : 'No hay registros', ''));
  for (const item of records) select.add(new Option(labelFn(item), item.id));
  if ([...select.options].some(option => option.value === prior)) select.value = prior;
}
async function loadData() {
  const [students, subjects, enrollments] = await Promise.all([
    api('/students'), api('/subjects'), api('/enrollments')
  ]);
  state.students = students;
  state.subjects = subjects;
  state.enrollments = enrollments;
  renderStudents(); renderSubjects(); renderEnrollments();
  optionList($('enrollment-student'), students, student => `${student.firstName} ${student.lastName}`);
  optionList($('enrollment-subject'), subjects.filter(item => item.enrolled < item.capacity), item => `${item.name} (${item.enrolled}/${item.capacity})`);
  if (state.user.role === 'admin') {
    state.users = await api('/users');
    renderUsers();
  }
}
function renderStudents() {
  $('student-count').textContent = String(state.students.length);
  if (!state.students.length) { $('student-list').innerHTML = empty('Todavía no hay alumnos registrados.'); return; }
  $('student-list').innerHTML = state.students.map(student => `<div class="record-row"><div class="record-main"><p class="record-title">${esc(student.firstName)} ${esc(student.lastName)}</p><p class="record-meta">${student.age} años · ${student.subjectCount} materias</p></div>${state.user.role === 'admin' ? `<div class="record-actions">${action('Editar','edit-student',student.id)}${action('Eliminar','delete-student',student.id,true)}</div>` : ''}</div>`).join('');
}
function renderSubjects() {
  $('subject-count').textContent = String(state.subjects.length);
  if (!state.subjects.length) { $('subject-list').innerHTML = empty('Todavía no hay materias registradas.'); return; }
  $('subject-list').innerHTML = state.subjects.map(subject => `<div class="record-row"><div class="record-main"><p class="record-title">${esc(subject.name)}</p><p class="record-meta">${subject.enrolled} de ${subject.capacity} lugares ocupados</p></div>${state.user.role === 'admin' ? `<div class="record-actions">${action('Editar','edit-subject',subject.id)}${action('Eliminar','delete-subject',subject.id,true)}</div>` : ''}</div>`).join('');
}
function renderEnrollments() {
  if (!state.enrollments.length) { $('enrollment-list').innerHTML = empty('Todavía no hay inscripciones.'); return; }
  $('enrollment-list').innerHTML = state.enrollments.map(row => `<div class="record-row"><div class="record-main"><p class="record-title">${esc(row.firstName)} ${esc(row.lastName)}</p><p class="record-meta">${esc(row.subjectName)}</p></div>${action('Quitar inscripción','delete-enrollment',row.id,true)}</div>`).join('');
}
function renderUsers() {
  if (!state.users.length) { $('user-list').innerHTML = empty('No hay usuarios registrados.'); return; }
  $('user-list').innerHTML = state.users.map(user => `<div class="record-row"><div class="record-main"><p class="record-title">${esc(user.username)}${user.id === state.user.id ? ' (tu cuenta)' : ''}</p><p class="record-meta">${user.role === 'admin' ? 'Administrador' : 'Docente'} · ${user.active ? 'Activo' : 'Inactivo'}</p></div><div class="record-actions"><select class="field !mt-0 !w-auto !py-1 !text-xs" aria-label="Rol de ${esc(user.username)}" data-user-role="${user.id}"><option value="docente" ${user.role === 'docente' ? 'selected' : ''}>Docente</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option></select><button class="action-button" data-action="save-user-role" data-id="${user.id}">Guardar rol</button><button class="action-button ${user.active ? 'action-danger' : ''}" data-action="toggle-user" data-id="${user.id}">${user.active ? 'Desactivar' : 'Activar'}</button></div></div>`).join('');
}
function resetStudentForm() { $('student-form').reset(); $('student-id').value = ''; $('student-submit').textContent = 'Registrar alumno'; $('student-cancel').classList.add('hidden'); }
function resetSubjectForm() { $('subject-form').reset(); $('subject-id').value = ''; $('subject-submit').textContent = 'Registrar materia'; $('subject-cancel').classList.add('hidden'); }
function onError(error) { showNotice(error.message, true); }
$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  try { const result = await api('/login', { method: 'POST', body: { username: $('login-username').value, password: $('login-password').value } }); $('login-form').reset(); showApp(result.user); await loadData(); showNotice('Sesión iniciada correctamente.'); }
  catch (error) { onError(error); }
});
$('logout-button').addEventListener('click', async () => {
  try { await api('/logout', { method: 'POST' }); showLogin(); showNotice('Sesión cerrada.'); }
  catch (error) { onError(error); }
});
$('student-form').addEventListener('submit', async event => {
  event.preventDefault(); const id = $('student-id').value;
  const body = { firstName: $('student-first').value, lastName: $('student-last').value, age: Number($('student-age').value) };
  try { await api(id ? `/students/${id}` : '/students', { method: id ? 'PUT' : 'POST', body }); resetStudentForm(); await loadData(); showNotice(id ? 'Alumno actualizado.' : 'Alumno registrado.'); }
  catch (error) { onError(error); }
});
$('student-cancel').addEventListener('click', resetStudentForm);
$('subject-form').addEventListener('submit', async event => {
  event.preventDefault(); const id = $('subject-id').value;
  const body = { name: $('subject-name').value, capacity: Number($('subject-capacity').value) };
  try { await api(id ? `/subjects/${id}` : '/subjects', { method: id ? 'PUT' : 'POST', body }); resetSubjectForm(); await loadData(); showNotice(id ? 'Materia actualizada.' : 'Materia registrada.'); }
  catch (error) { onError(error); }
});
$('subject-cancel').addEventListener('click', resetSubjectForm);
$('enrollment-form').addEventListener('submit', async event => {
  event.preventDefault();
  try { await api('/enrollments', { method: 'POST', body: { studentId: Number($('enrollment-student').value), subjectId: Number($('enrollment-subject').value) } }); await loadData(); showNotice('Alumno inscrito correctamente.'); }
  catch (error) { onError(error); }
});
$('user-form').addEventListener('submit', async event => {
  event.preventDefault();
  try { await api('/users', { method: 'POST', body: { username: $('user-name').value, password: $('user-password').value, role: $('user-role').value } }); $('user-form').reset(); await loadData(); showNotice('Usuario creado correctamente.'); }
  catch (error) { onError(error); }
});
$('password-form').addEventListener('submit', async event => {
  event.preventDefault();
  try { await api('/password', { method: 'PUT', body: { currentPassword: $('current-password').value, newPassword: $('new-password').value } }); $('password-form').reset(); showNotice('Contraseña cambiada correctamente.'); }
  catch (error) { onError(error); }
});
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const id = Number(button.dataset.id);
  try {
    switch (button.dataset.action) {
      case 'edit-student': { const item = state.students.find(row => row.id === id); if (!item) return; $('student-id').value = item.id; $('student-first').value = item.firstName; $('student-last').value = item.lastName; $('student-age').value = item.age; $('student-submit').textContent = 'Guardar cambios'; $('student-cancel').classList.remove('hidden'); $('student-first').focus(); break; }
      case 'delete-student': if (confirm('¿Eliminar este alumno y sus inscripciones?')) { await api(`/students/${id}`, { method: 'DELETE' }); await loadData(); showNotice('Alumno eliminado.'); } break;
      case 'edit-subject': { const item = state.subjects.find(row => row.id === id); if (!item) return; $('subject-id').value = item.id; $('subject-name').value = item.name; $('subject-capacity').value = item.capacity; $('subject-submit').textContent = 'Guardar cambios'; $('subject-cancel').classList.remove('hidden'); $('subject-name').focus(); break; }
      case 'delete-subject': if (confirm('¿Eliminar esta materia y todas sus inscripciones?')) { await api(`/subjects/${id}`, { method: 'DELETE' }); await loadData(); showNotice('Materia eliminada.'); } break;
      case 'delete-enrollment': if (confirm('¿Quitar esta inscripción?')) { await api(`/enrollments/${id}`, { method: 'DELETE' }); await loadData(); showNotice('Inscripción eliminada.'); } break;
      case 'save-user-role': { const select = document.querySelector(`[data-user-role="${id}"]`); await api(`/users/${id}`, { method: 'PATCH', body: { role: select.value } }); await loadData(); showNotice('Rol actualizado.'); break; }
      case 'toggle-user': { const user = state.users.find(row => row.id === id); if (user.id === state.user.id && user.active) { showNotice('No puedes desactivar tu propia cuenta.', true); break; } await api(`/users/${id}`, { method: 'PATCH', body: { active: !user.active } }); await loadData(); showNotice(`Usuario ${user.active ? 'desactivado' : 'activado'}.`); break; }
    }
  } catch (error) { onError(error); }
});
(async function init() {
  try { const result = await api('/me'); if (result.user) { showApp(result.user); await loadData(); } }
  catch (error) { onError(error); }
})();

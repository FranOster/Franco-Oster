# Guía de presentación y entrega

## Antes de rendir

- [ ] Instalar Node.js 20 o superior.
- [ ] Crear `.env` desde `.env.example` y colocar secretos propios.
- [ ] Ejecutar `npm install` y `npm start`.
- [ ] Abrir `http://localhost:3000`.
- [ ] Preparar un alumno, una materia y un cupo bajo para demostrar las reglas.
- [ ] Crear un usuario docente desde la sesión de administrador.
- [ ] Cambiar las contraseñas de demostración y no compartir `.env` ni `data/registro.db`.

## Idea central

El proyecto digitaliza el registro académico de alumnos, materias e inscripciones. Una API Express procesa las acciones de la interfaz y SQLite conserva los registros después de cerrar o reiniciar el servidor.

## Cómo explicar los roles

- **Administrador:** administra alumnos, materias, cuentas y roles; también puede inscribir alumnos.
- **Docente:** consulta alumnos y materias, administra inscripciones y cambia su propia contraseña.

Los permisos se validan en las rutas del servidor. Ocultar un botón en pantalla mejora la experiencia, pero no constituye el control de seguridad: la API también rechaza la operación si el rol no está autorizado.

## Flujo técnico

1. El navegador envía JSON a una ruta `/api/...`.
2. Express valida sesión, rol y datos recibidos.
3. Las consultas parametrizadas leen o modifican SQLite.
4. La API devuelve el resultado y la interfaz actualiza los listados.

## Esquema relacional

`students` y `subjects` se relacionan muchos-a-muchos mediante `enrollments`. Las claves foráneas mantienen la integridad, y una restricción única en `(student_id, subject_id)` evita duplicados. `users` guarda el hash bcrypt, rol y estado de la cuenta.

## Preguntas posibles

**¿Por qué hay un backend?** Para proteger las operaciones y credenciales, validar los roles del lado confiable y centralizar el acceso a la base de datos.

**¿Cómo se guardan las contraseñas?** Se almacena un hash bcrypt con factor de costo 12; el texto original no se guarda.

**¿Qué pasa si se repite una inscripción?** La API devuelve un error y la base de datos tiene una restricción única que impide el duplicado.

**¿Cómo se controla el cupo?** Antes de crear una inscripción se compara el total actual con la capacidad de la materia.

**¿Qué se mejoraría para producción?** Usar un almacén persistente de sesiones, desplegar con HTTPS, administrar secretos desde el proveedor y considerar PostgreSQL si se necesita acceso concurrente o más de una instancia.

## Archivos principales

- `server.js`: API, sesión, permisos y esquema SQLite.
- `index.html`, `script.js`, `style.css`: interfaz y consumo de la API.
- `package.json` y `package-lock.json`: dependencias y configuración reproducible.
- `.env.example`: variables necesarias, sin secretos reales.
- `README.md`: instalación, funcionalidades, roles y rutas de la API.

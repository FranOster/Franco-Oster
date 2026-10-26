# Registro académico

Aplicación web para administrar alumnos, materias e inscripciones. Usa Node.js y Express para la API, SQLite para persistir los datos y sesiones para autenticar usuarios.

## Funcionalidades

- Inicio y cierre de sesión con contraseña cifrada mediante bcrypt.
- Dos roles con permisos comprobados en el servidor.
- CRUD de alumnos y materias para administradores.
- Inscripción y baja de inscripciones para administradores y docentes.
- Gestión de usuarios, roles y estados para administradores.
- Cambio de contraseña del usuario autenticado.
- Validaciones de edad, cupos, materias repetidas y máximo de ocho materias por alumno.
- Base de datos SQLite persistente en `data/registro.db`.

## Requisitos e instalación

Se requiere Node.js 20 o superior y npm.

En PowerShell, desde la carpeta del proyecto:

```powershell
Copy-Item .env.example .env
notepad .env
npm install
npm start
```

En `.env`, cambia `ADMIN_PASSWORD` por una contraseña de al menos 12 caracteres y `SESSION_SECRET` por una clave aleatoria de al menos 32 caracteres. La primera ejecución crea el usuario administrador indicado por `ADMIN_USER`. Después abre <http://localhost:3000>.

No compartas `.env` ni la carpeta `data/`: contienen credenciales locales y datos de la aplicación. Ambos están excluidos de Git.

## Roles

| Acción | Administrador | Docente |
| --- | --- | --- |
| Ver alumnos y materias | Sí | Sí |
| Crear, editar y eliminar alumnos | Sí | No |
| Crear, editar y eliminar materias | Sí | No |
| Crear y quitar inscripciones | Sí | Sí |
| Crear usuarios y cambiar sus roles/estado | Sí | No |
| Cambiar su propia contraseña | Sí | Sí |

El sistema impide desactivar el último administrador activo y protege cada operación sensible también en la API, aunque se intente llamar directamente sin usar la interfaz.

## Estructura de datos

- `users`: nombre de usuario, hash de contraseña, rol y estado.
- `students`: nombre, apellido y edad.
- `subjects`: nombre y capacidad.
- `enrollments`: relación entre alumno y materia; las claves foráneas eliminan inscripciones relacionadas cuando se borra un registro.

La pareja alumno/materia es única, así que no se pueden crear inscripciones duplicadas. La capacidad se valida antes de inscribir. Las entradas se envían a consultas preparadas de SQLite.

## Guion breve para la defensa

> Este es un sistema de registro académico con persistencia en SQLite. La interfaz se comunica con una API creada con Express. Hay dos roles: el administrador administra alumnos, materias y usuarios; el docente consulta los registros y gestiona inscripciones. Las contraseñas se guardan con bcrypt y el servidor aplica las reglas y permisos, por lo que no dependen solo de los controles visuales.

### Demostración sugerida

1. Inicia sesión como `admin`.
2. Crea un alumno (edad mínima 17) y una materia con un cupo pequeño.
3. Inscribe al alumno y muestra el cupo actualizado.
4. Edita el alumno o la materia; luego elimina una inscripción.
5. Crea un usuario con rol **Docente** y cierra sesión.
6. Inicia sesión como docente y muestra que puede consultar e inscribir, pero no ve controles para editar alumnos/materias ni administrar usuarios.
7. Intenta una inscripción duplicada o superar el cupo y muestra el mensaje de validación.
8. Reinicia el servidor y confirma que los datos siguen guardados.

## API principal

- `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `GET/POST /api/students`, `PUT/DELETE /api/students/:id`
- `GET/POST /api/subjects`, `PUT/DELETE /api/subjects/:id`
- `GET/POST /api/enrollments`, `DELETE /api/enrollments/:id`
- `GET/POST /api/users`, `PATCH /api/users/:id`
- `PUT /api/password`

## Publicación

Para publicar en un servidor, configura secretos propios en el entorno, HTTPS, un almacenamiento persistente y una base de datos y almacén de sesiones adecuados para el proveedor de hosting. El modo local usa SQLite y el almacén de sesiones predeterminado de Express, apropiados para la demostración local; ese almacén de sesiones no está diseñado para despliegues con varias instancias.

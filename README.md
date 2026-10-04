# Sumo Tareas

Gestor de tareas interno de Sumo Growth: reemplazo simple de ClickUp/Asana, pensado para una agencia con varios clientes y varios colaboradores.

- **Mis tareas**: lo de cada uno, agrupado en vencidas / hoy / esta semana / próximas / sin fecha.
- **Pendientes**: todas las tareas abiertas de la agencia, con filtros que quedan en la URL (se comparten con un link), agrupables por vencimiento, cliente, responsable, estado o área. Tiene vista **lista** y **tablero** (Kanban con arrastrar y soltar).
- **Por colaborador**: una columna por persona con su carga (abiertas, vencidas, semana, en revisión) y una columna **Sin asignar**.
- **Por cliente**: tarjetas con la salud de cada cuenta y una página por cliente con sus tareas por área.
- **Recurrentes**: tareas que se generan solas (diaria hábil, semanal, mensual).
- **Administración**: equipo (invitaciones por link), clientes, áreas y tokens de API para agentes.
- **API REST** para los agentes de IA: ver [`docs/api.md`](docs/api.md).
- **Importador de ClickUp**.

El plan y el research del proyecto están en [`docs/plan-gestor-de-tareas.md`](docs/plan-gestor-de-tareas.md).

## Probarlo en local (5 minutos)

Requiere Node.js 20.9 o superior. No hace falta instalar una base de datos: sin `DATABASE_URL` usa **PGlite** (Postgres embebido) y guarda los datos en `.data/`.

```bash
npm install
npm run demo     # carga datos de ejemplo (usuarios ana@demo.local / bruno@demo.local / carla@demo.local, clave demo1234)
npm run dev      # http://localhost:3000
```

Para arrancar con la base vacía, saltá `npm run demo`: la primera vez la app te lleva a `/setup` para crear el usuario admin. Ahí se crean también el cliente interno y las 9 áreas que hoy se usan en ClickUp.

> PGlite no admite dos procesos a la vez sobre la misma carpeta. Si la app está corriendo, cerrala antes de ejecutar `npm run demo` o el importador (la app avisa si pasa).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm test` | Tests (60, sobre un Postgres real en memoria) |
| `npm run typecheck` | Chequeo de tipos |
| `npm run demo` | Datos de ejemplo (solo con la base vacía) |
| `npm run importar:clickup` | Importa desde ClickUp (ver abajo) |
| `npm run recurrentes` | Genera las tareas recurrentes del día (para un cron del sistema) |
| `npm run db:generate` | Genera una migración SQL después de cambiar `src/lib/db/schema.ts` |

## Puesta en producción

1. **Base de datos**: un Postgres cualquiera (Supabase, Neon, RDS o uno propio). Configurá `DATABASE_URL`. Las migraciones de `drizzle/` se aplican solas al arrancar.
2. **Variables** (ver `.env.example`):
   - `DATABASE_URL`: conexión a Postgres.
   - `APP_URL`: URL pública, por ejemplo `https://tareas.sumo-growth.com`. Se usa para armar los links de invitación.
   - `APP_TIMEZONE`: por defecto `America/Argentina/Buenos_Aires`. Define qué es "hoy" y "vencida".
   - `CRON_SECRET`: protege `/api/cron/recurrentes`.
3. **Hosting**: cualquier plataforma que corra Next.js (Vercel, Railway, Render o un VPS con `npm run build && npm start`). La recomendación del plan es un subdominio, `tareas.sumo-growth.com`, enlazado desde la web.
4. **Recurrentes**: se generan solas cuando alguien abre la app (como máximo cada 10 minutos). Para que estén listas a primera hora, en Vercel ya viene un cron en `vercel.json`. En otro hosting, programá una llamada diaria a `GET /api/cron/recurrentes` con el header `Authorization: Bearer $CRON_SECRET`, o corré `npm run recurrentes`.

> En Vercel u otros hostings serverless **hay que usar `DATABASE_URL`**: el disco es efímero y PGlite perdería los datos.

## Migrar desde ClickUp

```bash
# 1. Simulación: muestra qué se importaría, con advertencias (estados raros, personas que no existen, etc.)
CLICKUP_TOKEN=pk_xxx npm run importar:clickup

# 2. Importación real (se puede repetir: no duplica)
CLICKUP_TOKEN=pk_xxx npm run importar:clickup -- --aplicar
```

- Carpeta de ClickUp → **cliente**, lista → **área**, espacio "Sumo Growth" → **cliente interno**.
- Los estados se normalizan: `pendiente` / `to do` → Por hacer, `ready for review` → En revisión, `approved` / `complete` / `done` → Hecho.
- Los responsables se emparejan por **email**. Conviene invitar al equipo antes de importar, con el mismo email que usan en ClickUp.
- Cada tarea guarda un link a la original de ClickUp y sus comentarios.
- Opciones: `--guardar export.json` guarda lo descargado; `--json export.json` importa desde ese archivo sin llamar a ClickUp.

## Cómo está hecho

- **Next.js 16** (App Router, Server Actions) + **TypeScript** + **Tailwind CSS 4**.
- **PostgreSQL** con **Drizzle ORM**. Local: PGlite. Producción: cualquier Postgres.
- Login propio por invitación (contraseñas con scrypt, sesiones en la base). No depende de servicios externos.
- `src/lib/servicios/` concentra todas las reglas de negocio. La web, la API y el importador pasan por ahí, así que las validaciones son siempre las mismas.

```
src/
  app/(app)/        pantallas con login: mis tareas, pendientes, equipo, clientes, tareas, recurrentes, admin
  app/(acceso)/     login, setup inicial, invitación
  app/api/v1/       API REST para agentes
  app/acciones.ts   acciones del servidor que usa la interfaz
  lib/dominio.ts    estados, prioridades, fechas, recurrencias (lógica pura)
  lib/servicios/    tareas, consultas, cuentas, catálogo (clientes/áreas), recurrentes
  lib/importador-clickup.ts
  components/       interfaz
drizzle/            migraciones SQL
tests/              tests sobre Postgres real (PGlite en memoria)
```

## Inconsistencias que el sistema evita

| Situación | Qué pasa |
|---|---|
| Estados mezclados de ClickUp (`pendiente`, `to do`, `approved`, `complete`…) | Se normalizan a 6 estados fijos, en la importación y en la API. Uno desconocido da error o una advertencia, nunca un estado inventado. |
| "Flex Sports" vs "flex-sports" vs "FLEX SPORTS" | Es el mismo cliente: no se puede crear un duplicado y la API lo resuelve igual. Lo mismo vale para áreas y emails. |
| Un nombre que coincide con dos personas ("Bruno") | La API responde `409 ambiguo` con los candidatos, en lugar de elegir uno. |
| Tarea sin cliente | No se puede crear. Lo interno va al cliente "Sumo Growth (interno)". |
| Tareas sin responsable o sin fecha | Se ven aparte: columna "Sin asignar", grupo "Sin fecha" y contadores en Pendientes. |
| Desactivar a alguien con tareas abiertas | Se elige a quién pasárselas (tareas abiertas, recurrentes y cuentas de cliente). Su sesión se cierra en el momento. Lo ya terminado conserva su nombre. |
| Asignar a alguien desactivado | Se rechaza. Si un dato viejo lo tiene, se muestra "(inactivo)" en rojo. |
| Quedarse sin admin | No se puede quitar ni desactivar al último admin, y nadie puede desactivarse a sí mismo. |
| Archivar un cliente con tareas abiertas | Se bloquea y dice cuántas quedan. Al archivar se apagan sus recurrentes. |
| Borrar un área en uso | Se bloquea: se desactiva y las tareas la conservan. |
| Dos personas editando la misma tarea | Cambios puntuales (estado, fecha, responsable) se aplican sobre la última versión. Al editar texto, si otro guardó antes, avisa en vez de pisar, y no se pierde lo escrito. |
| Agente que reintenta y duplica tareas | `clave_externa` hace la creación idempotente, también con pedidos simultáneos. |
| Recurrentes generadas dos veces (dos crons, dos servidores) | Índice único por regla y fecha: nunca se duplica. |
| El servidor estuvo apagado varios días | Se genera solo la ocurrencia más reciente, no una pila de "Daily Forecast". |
| Mensual el día 31 | En meses cortos cae el último día (30, 28 o 29). |
| Cliente pausado | Sus recurrentes no generan tareas. Al reactivarlas no se generan las semanas pausadas. |
| "Hoy" según el servidor (UTC) | Todo se calcula en hora de Argentina: a las 22 h una tarea de hoy no figura como vencida. |
| Fechas imposibles (30/02) o en otros formatos | Se rechazan. Se aceptan `YYYY-MM-DD`, fecha-hora ISO y el epoch de ClickUp. |
| Marcar "Hecho" y después reabrir | La fecha de completado se marca y se limpia sola. |
| Links rotos o peligrosos (`javascript:`) | Solo se aceptan http(s). Los repetidos se eliminan. |
| Filtros con valores basura en la URL (links viejos) | Se ignoran sin romper la página. |
| Error en un formulario | Lo escrito no se borra. |
| Link de invitación usado dos veces o vencido | Es de un solo uso y vale 7 días. Al cambiar la contraseña se cierran las sesiones anteriores. |
| Tokens de API filtrados | Se guardan hasheados, se ven una sola vez, uno por agente y se revocan individualmente. |
| App y script abiertos sobre la base local | El segundo proceso se niega a abrirla, en lugar de corromperla. |

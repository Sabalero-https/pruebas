# Plan: Gestor de tareas interno de Sumo Growth

> Objetivo: reemplazar ClickUp/Asana por un panel propio, **simple**, integrado a nuestra web, pensado para una agencia que trabaja con varios clientes y varios colaboradores.
>
> **Estado:** el MVP (fases 1 a 3 y el importador de la fase 4) está implementado en este repositorio. Ver [§11](#11-estado-de-implementación-mvp) y el [README](../README.md).

---

## 1. Resumen ejecutivo

- Construimos una app web chica, en un subdominio propio (ej. `tareas.sumo-growth.com`), con login solo para el equipo.
- El modelo central es **Tarea = Cliente × Área × Responsable × Fecha × Estado**. Todo lo demás (paneles por colaborador, por cliente, pendientes globales) son *vistas filtradas* sobre la misma tabla.
- El MVP se puede tener andando en **~3 semanas de desarrollo** + 1–2 semanas de uso en paralelo con ClickUp antes de apagarlo.
- Desde el día 1 tiene una **API para nuestros agentes de IA**, porque hoy ya hay tareas que las crean agentes ("Agente 1/2/3").
- Regla de oro del proyecto: **no reconstruir ClickUp**. Si una función no se usó en ClickUp en los últimos 3 meses, no entra al MVP.

---

## 2. Research

### 2.1 Cómo trabajamos hoy en ClickUp (relevado del workspace actual)

| Hallazgo | Implicancia para el diseño |
|---|---|
| Espacio **Clientes** con una carpeta por cliente (Flex Sports, Sir Neko) y listas por área: *Pauta, Email/Automatizaciones, Desarrollo/Conexiones, Entregables/Reportes, Planificación, Producción Creativa*. | El cliente y el área son las dos dimensiones principales. Las áreas conviene que sean un **catálogo global** (no copiarlas a mano por cliente). |
| Espacio **Sumo Growth** interno: *Estrategia-Ops, Finanzas, Prospección/Nuevos clientes*. | Lo interno se modela como un "cliente" especial *Sumo Growth (interno)*. Así todas las vistas funcionan igual. |
| Equipo chico: 3 colaboradores + una cuenta genérica. | Permisos simples: todos ven todo. Dos roles alcanzan (admin / miembro). |
| Estados mezclados: `backlog`, `to do`, `pendiente`, `ready for review`, `approved`, `complete`, `done`. | Hay que **estandarizar** un único flujo de estados (ver §4.2). |
| Muchas tareas **sin responsable** y varias **sin fecha**. | Las vistas tienen que hacer visibles las tareas "huérfanas" (sin asignar / sin fecha). |
| Tareas repetitivas: *Daily Forecast*, *Optimización semanal de campañas*, *Reporte mensual + P&L*, *Enviar status al cliente*. | **Tareas recurrentes** entran al MVP, son parte del día a día de la agencia. |
| Tareas creadas por agentes de IA (*Calendario comercial*, *Grilla de contenidos*, *Estructura de pauta*) con flujo de revisión → aprobado. | **API con tokens** desde el MVP y un estado **En revisión**. |
| Prioridades usadas: urgente, alta, normal. | Mantenemos las 4 prioridades estándar. |
| No hay campos personalizados en uso. | No hace falta un sistema de campos personalizados. Gran ahorro de complejidad. |
| Volumen bajo (decenas de tareas). | La migración es chica y la performance no es un problema. |

### 2.2 Qué nos da ClickUp/Asana y qué necesitamos realmente

| Funcionalidad | ¿La necesitamos? | Fase |
|---|---|---|
| Tareas con responsable, fecha, prioridad, estado | Sí, es el núcleo | MVP |
| Organización por cliente y área | Sí | MVP |
| Vista lista con filtros / agrupar | Sí | MVP |
| Tablero Kanban | Sí (para revisión de entregables) | MVP |
| Comentarios + historial de cambios | Sí | MVP |
| Tareas recurrentes | Sí | MVP |
| API / integraciones con agentes | Sí | MVP |
| Recordatorios / resumen diario por mail | Muy útil | Fase 2 |
| Calendario | Útil | Fase 2 |
| Subtareas / checklist | Útil | Fase 2 |
| Adjuntos (archivos) | Por ahora alcanza con links a Drive | Fase 2 |
| Plantillas (ej. onboarding de cliente nuevo) | Útil | Fase 2 |
| Time tracking | Solo si se factura por hora | Fase 3 (a definir) |
| Portal para que el cliente vea/aprube | Diferencial a futuro | Fase 3 |
| Gantt, dependencias, docs, chat, whiteboards, metas, campos custom, automations visuales | No | Fuera de alcance |

### 2.3 ¿Construir o adoptar un open source?

Antes de construir conviene saber que existen gestores open source autoalojables:

| Herramienta | Stack | Pro | Contra para nosotros |
|---|---|---|---|
| **Plane** | React/Next.js + Python | Muy completo, comunidad grande (~48k ⭐), estilo Linear | Pensado para equipos de software (sprints, issues). Pesado de operar. |
| **Leantime** | PHP + MySQL | Simple, liviano, tiene clientes y timesheets | Interfaz y modelo propios, difícil de adaptar a nuestra marca y flujo. |
| **Vikunja** | Binario Go único | Muy liviano, kanban/lista/tabla/Gantt, recurrentes | No tiene concepto de cliente; organizado por proyectos. |

**Recomendación: construir propio, pero chico.** Motivos:

1. Nuestro modelo (cliente × área × responsable) es simple y muy específico. Con un open source tendríamos que adaptarnos a su modelo.
2. Queremos que viva en **nuestra web**, con nuestra marca, y que a futuro tenga un **portal de clientes**.
3. Nuestros **agentes de IA** necesitan una API hecha a medida (crear entregables, pasarlos a revisión, comentar).
4. El MVP es chico (~3 semanas). El costo de mantenerlo es bajo si respetamos el alcance.

> Plan B: si en algún momento no hay quién desarrolle o mantenga, **Vikunja** o **Leantime** autoalojados resuelven "no depender de ClickUp" en pocos días.

---

## 3. Alcance del MVP

**Entra:**
- Login del equipo (solo por invitación).
- ABM de clientes, áreas y colaboradores.
- Tareas: título, descripción, cliente, área, responsable, fecha de vencimiento, prioridad, estado y links.
- Alta rápida de tareas desde cualquier pantalla.
- Panel **Mis tareas**, panel **Por colaborador**, panel **Por cliente**, panel **Pendientes** (vista completa) y **Kanban**.
- Comentarios e historial de actividad por tarea.
- Tareas recurrentes (diaria hábil / semanal / mensual).
- API REST con tokens para agentes.
- Migración desde ClickUp.

**No entra (por ahora):** calendario, subtareas, adjuntos, notificaciones push, app mobile nativa (la web va a ser responsive), time tracking, portal de clientes.

---

## 4. Diseño funcional

### 4.1 Entidades

- **Colaborador**: nombre, email, rol (`admin` | `miembro`), activo.
- **Cliente**: nombre, color, estado (`activo` | `pausado` | `archivado`), responsable de cuenta, `es_interno` (para *Sumo Growth*).
- **Área**: Pauta, Email/Automatizaciones, Desarrollo/Conexiones, Entregables/Reportes, Planificación, Producción Creativa, Estrategia-Ops, Finanzas, Prospección. Catálogo editable.
- **Tarea**: pertenece a **un cliente** y **un área**, tiene **un responsable** (o ninguno), fecha, prioridad y estado.
  - *Un solo responsable* a propósito: deja claro de quién es cada tarea. Si hace falta, más adelante se agregan "seguidores".
- **Comentario** y **Actividad** (historial automático de cambios).
- **Regla recurrente**: plantilla de tarea + frecuencia, que genera la tarea real.

### 4.2 Estados estandarizados

```
Backlog → Por hacer → En curso → En revisión → Hecho
                           ↘ Esperando cliente ↗
```

| Estado nuevo | Estados de ClickUp que absorbe | Uso |
|---|---|---|
| Backlog | backlog | Ideas o tareas sin planificar |
| Por hacer | to do, pendiente | Comprometida, todavía no arrancó |
| En curso | — | Alguien la está trabajando |
| En revisión | ready for review | Entregable listo para revisión interna o del cliente (lo usan los agentes) |
| Esperando cliente | — | Bloqueada por el cliente (accesos, aprobaciones, material). Clave en una agencia. |
| Hecho | approved, complete, done | Terminada. Se guarda `fecha_completada`. |

Prioridades: **Urgente, Alta, Normal, Baja**.

### 4.3 Paneles

**1. Mis tareas** (pantalla de inicio)
Las tareas de quien está logueado, agrupadas por **Vencidas · Hoy · Esta semana · Próximas · Sin fecha**. Es lo primero que cada uno ve a la mañana.

**2. Por colaborador**
Una columna por persona con contadores (abiertas, vencidas, vencen esta semana, en revisión) y la lista de sus tareas. Al final, una columna **Sin asignar**. Sirve para repartir carga en la reunión semanal.

```
┌ Colaborador A ───┐ ┌ Colaborador B ───┐ ┌ Colaborador C ───┐ ┌ Sin asignar ─┐
│ 8 abiertas · 2 ⚠ │ │ 5 abiertas · 0 ⚠ │ │ 11 abiertas · 4 ⚠│ │ 6 tareas     │
│ ▸ Optimización…  │ │ ▸ SOP09 Onboard… │ │ ▸ Reporte mens…  │ │ ▸ Daily Fore…│
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────┘
```

**3. Por cliente**
- *Listado de clientes* con indicadores de salud: abiertas, vencidas, en revisión, esperando cliente, próxima entrega.
- *Página del cliente*: tareas agrupadas por área (como las listas actuales de ClickUp), con cambio a Kanban. Es la vista para preparar una reunión o un status con el cliente.

**4. Pendientes (vista completa)**
Tabla con **todas** las tareas abiertas de la agencia:
- Filtros: cliente, área, responsable, estado, prioridad, vencimiento (vencidas / hoy / semana / sin fecha).
- Agrupar por cliente, responsable, estado o área.
- Orden por vencimiento o prioridad.
- Los filtros quedan en la URL, así una vista se comparte con un link (ej. "todo lo vencido de Pauta").

**5. Kanban**
Columnas por estado, se puede usar sobre cualquier filtro (un cliente, una persona, todo). Arrastrar para cambiar de estado.

**6. Inicio / resumen** (puede ser parte de "Pendientes")
Cuatro números arriba de todo: **Vencidas · Sin asignar · En revisión · Esperando cliente**. Cada uno lleva a la lista filtrada.

### 4.4 Detalles de experiencia que hacen la diferencia

- **Alta rápida**: un input arriba (atajo `N`) donde se escribe el título y se eligen cliente, responsable y fecha sin abrir un formulario.
- **Detalle en panel lateral**: se abre la tarea sin perder la lista.
- **Edición en línea** de estado, responsable y fecha desde las listas.
- Fechas en hora de Argentina y en español.
- Responsive para revisar desde el celular.

### 4.5 Permisos

- **Admin**: gestiona colaboradores, clientes, áreas, tokens de API y reglas recurrentes.
- **Miembro**: ve todo y crea o edita cualquier tarea. Equipo chico, máxima transparencia.
- Login **solo por invitación** (lista de emails habilitados). Hoy el equipo usa emails personales, así que no se puede restringir por dominio `@sumo-growth.com`.

---

## 5. Arquitectura y stack

### 5.1 Dónde vive

**Recomendado: subdominio propio** (`tareas.sumo-growth.com` o `app.sumo-growth.com`), con un link/acceso desde la web.
- No acopla el panel a los deploys o al CMS de la web de marketing.
- Mejor seguridad: el panel tiene su propio login y sus propias cookies.
- Si la web está hecha en Next.js, también puede ir como ruta `/panel` del mismo proyecto. **A confirmar** (ver §9).

### 5.2 Stack recomendado

| Capa | Elección | Por qué |
|---|---|---|
| Frontend + backend | **Next.js (App Router) + TypeScript** | Un solo proyecto para la UI y la API. Muy documentado. |
| UI | **Tailwind CSS + shadcn/ui** | Componentes listos (tablas, diálogos, selects) sin diseñar de cero. Kanban con `dnd-kit`. |
| Base de datos | **PostgreSQL en Supabase** | Postgres gestionado, backups, y trae auth, storage (para adjuntos en fase 2) y cron. |
| Autenticación | **Supabase Auth** (magic link o Google) + allowlist | Sin manejar contraseñas. |
| Seguridad de datos | **Row Level Security** en Postgres | Hoy alcanza con "solo miembros activos". Deja preparado el portal de clientes. |
| Tareas recurrentes y mails | **pg_cron / Supabase Cron** + Resend (o similar) | Un job diario genera recurrentes y, en fase 2, manda el resumen. |
| Hosting | **Vercel** (o el hosting actual de la web) | Deploy automático desde GitHub. |

Costo estimado: se puede arrancar en planes gratuitos. Para uso comercial estable conviene contar con ~USD 25/mes de Supabase Pro + ~USD 20/mes de Vercel Pro (confirmar precios vigentes). Igual es menos que ClickUp para todo el equipo a mediano plazo.

> Alternativa sin Supabase: Next.js + Postgres en cualquier VPS + Prisma + Auth.js. Da más control y más trabajo de operación.

### 5.3 Modelo de datos (borrador SQL)

```sql
create type rol_usuario   as enum ('admin', 'miembro');
create type estado_tarea  as enum ('backlog', 'por_hacer', 'en_curso', 'en_revision', 'esperando_cliente', 'hecho');
create type prioridad     as enum ('urgente', 'alta', 'normal', 'baja');
create type estado_cliente as enum ('activo', 'pausado', 'archivado');

create table colaboradores (
  id          uuid primary key references auth.users,
  nombre      text not null,
  email       text not null unique,
  rol         rol_usuario not null default 'miembro',
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create table clientes (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  color           text,
  estado          estado_cliente not null default 'activo',
  es_interno      boolean not null default false,
  responsable_id  uuid references colaboradores,
  creado_en       timestamptz not null default now()
);

create table areas (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique,
  orden   int not null default 0
);

create table tareas (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null,
  descripcion       text,                       -- markdown
  cliente_id        uuid not null references clientes,
  area_id           uuid references areas,
  responsable_id    uuid references colaboradores,
  estado            estado_tarea not null default 'por_hacer',
  prioridad         prioridad not null default 'normal',
  vence_el          date,
  links             jsonb not null default '[]', -- [{titulo, url}] a Drive, Meta Ads, etc.
  orden_kanban      double precision,
  origen            text not null default 'manual', -- manual | recurrente | agente | migracion
  regla_id          uuid,                       -- si vino de una regla recurrente
  creado_por        uuid references colaboradores,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  completada_en     timestamptz,
  archivada_en      timestamptz
);
create index on tareas (responsable_id, estado);
create index on tareas (cliente_id, estado);
create index on tareas (vence_el) where estado <> 'hecho';

create table comentarios (
  id         uuid primary key default gen_random_uuid(),
  tarea_id   uuid not null references tareas on delete cascade,
  autor_id   uuid references colaboradores,       -- null si lo escribió un agente
  autor_api  text,                                -- nombre del token/agente
  cuerpo     text not null,
  creado_en  timestamptz not null default now()
);

create table actividad (
  id         bigserial primary key,
  tarea_id   uuid not null references tareas on delete cascade,
  actor      text not null,                       -- colaborador o agente
  campo      text not null,                       -- estado, responsable, vence_el...
  antes      text,
  despues    text,
  creado_en  timestamptz not null default now()
);

create table reglas_recurrentes (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  descripcion     text,
  cliente_id      uuid not null references clientes,
  area_id         uuid references areas,
  responsable_id  uuid references colaboradores,
  prioridad       prioridad not null default 'normal',
  frecuencia      text not null,  -- 'diaria_habil' | 'semanal:lun' | 'mensual:1'
  dias_para_vencer int not null default 0,
  proxima_en      date not null,
  activa          boolean not null default true
);

create table tokens_api (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,       -- "Agente 1 - Calendario comercial"
  hash        text not null,       -- nunca guardar el token en claro
  activo      boolean not null default true,
  creado_en   timestamptz not null default now(),
  ultimo_uso  timestamptz
);
```

Todas las vistas (por colaborador, por cliente, pendientes) son consultas sobre `tareas` con distintos filtros. No hay tablas por vista.

### 5.4 API para agentes y automatizaciones

Autenticación con `Authorization: Bearer <token>` (token creado por un admin, uno por agente).

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/v1/tareas?cliente=&area=&estado=&responsable=&vence_hasta=` | Listar o filtrar tareas |
| `POST` | `/api/v1/tareas` | Crear tarea (ej. el agente crea "Grilla de contenidos — Noviembre") |
| `PATCH` | `/api/v1/tareas/:id` | Cambiar estado, responsable, fecha o descripción |
| `POST` | `/api/v1/tareas/:id/comentarios` | Dejar el entregable o un link como comentario |
| `GET` | `/api/v1/clientes`, `/api/v1/areas`, `/api/v1/colaboradores` | Catálogos para resolver nombres a IDs |

- Clientes y áreas se pueden referenciar por **nombre o slug**, no solo por UUID, para que a los agentes les resulte simple.
- Todo lo que hace un agente queda en `actividad` con el nombre del token.
- Fase 2: **webhooks salientes** (ej. avisar a un agente cuando una tarea pasa a "Hecho") y, si suma, un **servidor MCP** para operar el panel desde Claude como hoy se hace con ClickUp.

---

## 6. Migración desde ClickUp

1. Script de una sola vez con la **API v2 de ClickUp**: carpetas → clientes, espacio *Sumo Growth* → cliente interno, listas → áreas, tareas + comentarios → tareas + comentarios (`origen = 'migracion'`, con link a la tarea original).
2. Mapeo de estados según la tabla de §4.2 y de responsables por email.
3. Corrida en seco, revisión de lo importado y corrida final.
4. Con el volumen actual (decenas de tareas), si el script se complica, la carga manual es una opción válida.
5. **Una semana de uso en paralelo**: lo nuevo se crea en el panel nuevo. Después, ClickUp queda en solo lectura un mes y se da de baja.
6. Reconfigurar los agentes de IA para que escriban en la nueva API en lugar de ClickUp.

---

## 7. Roadmap

Estimaciones para **1 desarrollador** a tiempo completo. Con dedicación parcial, multiplicar.

| Fase | Contenido | Duración | Entregable |
|---|---|---|---|
| **0. Definición** | Responder decisiones abiertas (§9), validar estados y áreas, wireframes en papel/Figma de los 4 paneles | 2–3 días | Este documento aprobado + wireframes |
| **1. Base** | Repo, proyecto Supabase, esquema de DB + RLS, login por invitación, ABM de colaboradores, clientes y áreas, crear/editar tareas, detalle lateral | ~1 semana | Se pueden cargar tareas reales |
| **2. Paneles** | Mis tareas, Pendientes (filtros + agrupar + URL compartible), Por cliente, Por colaborador, Kanban con drag & drop, alta rápida | ~1 semana | El equipo puede trabajar el día a día |
| **3. Colaboración y automatización** | Comentarios, historial de actividad, reglas recurrentes + cron diario, API v1 con tokens | ~1 semana | Recurrentes y agentes funcionando |
| **4. Migración y salida** | Script de importación, semana en paralelo, ajustes por feedback, reconfigurar agentes, baja de ClickUp | 1–2 semanas de calendario | ClickUp apagado |
| **5. Mejoras** (según uso) | Resumen diario por mail, calendario, subtareas/checklist, adjuntos, plantillas (onboarding de cliente), webhooks, MCP, reportes de carga y cumplimiento | Continuo | — |
| **6. Futuro** | Portal de clientes (ver y aprobar entregables), time tracking si se factura por hora | A evaluar | — |

### Criterios de éxito del MVP

- El equipo dejó de abrir ClickUp.
- Toda tarea abierta tiene **cliente**. Las tareas sin responsable o sin fecha se ven y se resuelven en la reunión semanal.
- Crear una tarea lleva **menos de 10 segundos**.
- Las tareas recurrentes aparecen solas y los agentes crean y actualizan tareas por API.

---

## 8. Riesgos y cómo mitigarlos

| Riesgo | Mitigación |
|---|---|
| **Scope creep**: terminar reconstruyendo ClickUp | Regla de oro: solo entra lo que se usó en los últimos 3 meses. Todo lo demás va a la lista de fase 5. |
| **Adopción**: el equipo vuelve a ClickUp o a WhatsApp | Uso en paralelo corto, fecha de corte clara, y que "Mis tareas" sea realmente útil desde el primer día. |
| **Mantenimiento**: nadie se hace cargo después | Stack mainstream (Next.js + Postgres), código en GitHub, README de cómo deployar. Plan B: Vikunja/Leantime. |
| **Pérdida de datos** | Backups diarios de Supabase + export semanal a CSV/JSON. |
| **Seguridad** (datos de clientes, tokens) | Login por invitación, RLS, tokens hasheados y revocables, HTTPS, nada sensible en la descripción de tareas. |
| **Dependencia de nuevos proveedores** (Supabase/Vercel) | Es Postgres estándar y Next.js estándar: se puede mudar a un VPS propio sin reescribir. |

---

## 9. Decisiones abiertas (a definir antes de arrancar)

1. **¿En qué está hecha la web de Sumo Growth?** (WordPress, Webflow, Next.js, otro). Define si el panel va en subdominio (recomendado) o como ruta de la web.
2. **¿Quién lo desarrolla y mantiene?** (interno, freelance, con Claude Code). Define plazos reales.
3. **Login**: ¿magic link por email o Google? ¿El equipo va a usar emails `@sumo-growth.com`?
4. **Notificaciones**: ¿por dónde quiere enterarse el equipo? (mail diario, Slack, WhatsApp). Recomendado: un resumen diario por mail en fase 5.
5. **Portal de clientes**: ¿es algo que queremos ofrecer en 3–6 meses? Si es así, se prioriza RLS por cliente desde el principio (ya contemplado en el diseño).
6. **Time tracking**: ¿facturamos o medimos rentabilidad por hora/cliente? Si sí, sube de prioridad.
7. **Áreas definitivas**: ¿mantenemos las 9 áreas actuales o las simplificamos?

---

## 10. Próximos pasos inmediatos

1. Revisar este documento con el equipo y responder §9.
2. Hacer wireframes rápidos de los 4 paneles (Mis tareas, Por colaborador, Por cliente, Pendientes).
3. Crear el proyecto (repo + Supabase + Vercel) y arrancar la **Fase 1**.

---

## 11. Estado de implementación (MVP)

**Hecho:**
- Fase 1, base: esquema de datos, login por invitación, ABM de colaboradores, clientes y áreas, y crear/editar tareas.
- Fase 2, paneles: Mis tareas, Pendientes (filtros en la URL, agrupar, lista/tablero), Por colaborador, Por cliente, Kanban con arrastrar y soltar, y alta rápida con atajo `N`.
- Fase 3:
  - Comentarios e historial de cambios.
  - Recurrentes (diaria hábil, semanal, mensual) con generación idempotente.
  - API v1 con tokens por agente ([docs/api.md](api.md)).
- Fase 4, migración: importador de ClickUp con simulación, normalización de estados y reintentos sin duplicar.
- 60 tests automáticos sobre Postgres real, más un recorrido completo en navegador (escritorio y celular).

**Cambios respecto al plan original:**

| Plan | Implementado | Por qué |
|---|---|---|
| Supabase Auth | Login propio (email + contraseña, invitación por link) | Funciona en cualquier hosting y no ata el proyecto a un proveedor. Sigue siendo compatible con Supabase como base de datos. |
| Supabase obligatorio | Cualquier Postgres vía `DATABASE_URL`. En local, PGlite (Postgres embebido) | Se prueba con `npm install && npm run dev`, sin instalar nada más. |
| Row Level Security | Autorización en la capa de servicios (todo pasa por `src/lib/servicios`) | Con un equipo chico donde todos ven todo es suficiente. RLS se suma junto con el portal de clientes. |

**Pendiente (fase 4 y 5):**
- Correr el importador contra el ClickUp real (hace falta un token de API de ClickUp) y usar ambos sistemas en paralelo una semana.
- Desplegar en el subdominio (decidir hosting y Postgres, ver §9).
- Reconfigurar los agentes de IA para que usen la API nueva en vez de ClickUp.
- Mejoras: resumen diario por mail, calendario, subtareas, adjuntos, plantillas, webhooks y servidor MCP.

# Contexto para Claude: Sumo Growth · Tareas

Gestor de tareas interno de la agencia Sumo Growth (reemplaza a ClickUp). Quien mantiene este proyecto trabaja con Claude y no programa: explicá lo que hacés en criollo, pedí confirmación antes de tocar producción y no asumas conocimientos técnicos.

- Guía de implementación paso a paso: `docs/guia-implementacion.md`
- Plan, research y decisiones: `docs/plan-gestor-de-tareas.md`
- API para agentes: `docs/api.md`
- Instalación, comandos y lista de inconsistencias que el sistema evita: `README.md`

## Comandos

```bash
npm install          # dependencias
npm run dev          # http://localhost:3000 (sin DATABASE_URL usa PGlite en .data/)
npm run demo         # datos de ejemplo (solo con base vacía). Login: ana@demo.local / demo1234
npm test             # 61 tests sobre Postgres real (PGlite en memoria). Tienen que pasar siempre.
npm run typecheck
npm run build        # build de producción
npm run db:generate  # genera migración SQL tras cambiar src/lib/db/schema.ts
npm run importar:clickup [-- --aplicar]   # migración desde ClickUp (requiere CLICKUP_TOKEN)
```

PGlite no admite dos procesos sobre la misma carpeta: cerrá `npm run dev` antes de correr `demo` o el importador.

## Arquitectura (respetala)

- Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS 4, Drizzle ORM, PostgreSQL.
- **Next.js 16 tiene cambios grandes**: antes de usar una API de Next, leé la guía en `node_modules/next/dist/docs/`. No uses `middleware` (ahora se llama `proxy`). No está activado `cacheComponents`: todas las páginas son dinámicas.
- **Toda regla de negocio vive en `src/lib/servicios/`** (tareas, consultas, cuentas, catálogo, recurrentes). La interfaz (`src/app/acciones.ts`), la API (`src/app/api/v1`) y el importador llaman a esos servicios. Nunca escribas en la base saltándote los servicios: ahí están las validaciones que evitan inconsistencias.
- `src/lib/dominio.ts`: estados, prioridades, fechas (zona horaria de Argentina) y recurrencias. Lógica pura y testeada.
- Cambios de esquema: editar `src/lib/db/schema.ts` → `npm run db:generate` → commitear la migración de `drizzle/`. Las migraciones se aplican solas al arrancar. Nunca edites una migración ya publicada.
- Todo cambio de comportamiento lleva su test en `tests/`.

## Reglas de producto

- Simple a propósito. No reconstruir ClickUp: si una función no se usó en los últimos 3 meses, no entra.
- Toda tarea tiene cliente. Lo interno va al cliente "Sumo Growth (interno)".
- 6 estados fijos: backlog, por hacer, en curso, en revisión, esperando cliente, hecho.
- Un solo responsable por tarea.

## Marca (identidad visual de Sumo Growth)

- Paleta definida en `src/app/globals.css` (`@theme`): rojo `#C62828` (acentos, botones, sello), beige `#F2E8D9` (fondo claro), negro `#111111` (fondo oscuro y texto), blanco sobre rojo o negro. No agregues colores de marca nuevos.
- Wordmark: componente `src/components/marca.tsx`. Se dibuja como texto (SUMO + GROWTH + recuadro con el sello 成長), nunca como PNG estirado. Variantes aprobadas según el fondo: negro (wordmark blanco, acento rojo, sello blanco), beige (wordmark negro, acento rojo, sello rojo), rojo (todo blanco).
- Tipografías: cuerpo Inter; títulos Montserrat. La tipografía custom "SumoGrowth" (trazo tipo tinta) se activa sola si se agrega un `@font-face` con ese nombre en `globals.css` y el archivo en `public/fonts/`.
- El sello 成長 usa `public/fonts/sello-kanji.woff2` (solo esos 2 glifos de Noto Serif JP, licencia OFL).
- El ícono oficial (carita de sumo con sol rojo) va como favicon: reemplazar `src/app/icon.svg` por `src/app/icon.png`.
- Estilo: minimalista, alto contraste, bloques claros, sin ruido visual. Motivo permitido: gran sol rojo de fondo (ya usado en el login).

## Escritura

- Español rioplatense (vos, no tú). Directo, sin humo ni lenguaje corporativo.
- **Nunca usar guion largo (—)** en textos de la interfaz o que puedan llegar a un cliente. Usar coma, punto o dos puntos.
- Si algún día se muestra algo a clientes: GoHighLevel se nombra "Sumo CRM" y Nylos no se nombra nunca.

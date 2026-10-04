# Guía de implementación: Sumo Growth · Tareas

Para quien pone en marcha la app trabajando con Claude, sin necesidad de programar. Cada paso trae un **prompt listo para pegar en Claude Code**.

## Qué es

Un gestor de tareas propio para reemplazar ClickUp. Tiene:

- Paneles por colaborador, por cliente, pendientes de toda la agencia, tablero y "mis tareas".
- Tareas recurrentes.
- API para los agentes de IA.
- Importador desde ClickUp.

El código está terminado y probado (61 tests automáticos y un recorrido completo en navegador). Lo que falta es **publicarlo y migrar**.

## Qué vas a necesitar

| Qué | Para qué | Costo aproximado |
|---|---|---|
| Acceso al repo `Sabalero-https/pruebas` en GitHub | Bajar el código y publicarlo | Gratis |
| Cuenta en **Vercel** | Publicar la app | Hobby es gratis pero solo para uso no comercial; para la agencia corresponde **Pro** (~USD 20/mes). Alternativas: Railway o Render |
| Base Postgres: **Neon** (recomendado) o **Supabase** | Guardar los datos | Plan gratis alcanza para arrancar |
| Acceso al DNS de `sumo-growth.com` | Crear `tareas.sumo-growth.com` | Gratis |
| Token de API de ClickUp | Migrar las tareas | Gratis (ClickUp → Settings → Apps → API Token) |
| Claude Code | Hacer los pasos con ayuda | El plan que ya usás |

> Confirmá los precios vigentes en cada sitio antes de contratar.

## Paso 0: preparar el código

El trabajo está en el pull request #1 de `Sabalero-https/pruebas`. Primero hay que **mergearlo a `main`**: desde GitHub, botón "Merge pull request".

Después abrí el repo con Claude Code. El archivo `CLAUDE.md` le da a Claude todo el contexto del proyecto.

> **Prompt para Claude Code:**
> Leé CLAUDE.md y docs/guia-implementacion.md. Vamos a implementar esta app paso a paso. Antes de cada paso explicame qué vas a hacer, en criollo y sin tecnicismos, y pedime confirmación antes de tocar cualquier cosa que esté en producción.

## Paso 1: probarla en tu compu (opcional, 5 minutos)

> **Prompt:**
> Instalá las dependencias, cargá los datos de demo y levantá la app en local. Decime la dirección para abrirla y con qué usuario entro.

Entrás con `ana@demo.local`, contraseña `demo1234`. Son datos inventados para mirar; no se publican.

## Paso 2: crear la base de datos

1. Entrá a [neon.tech](https://neon.tech), creá un proyecto llamado `sumo-tareas` y elegí la región más cercana (São Paulo, si está disponible).
2. Copiá la **connection string pooled**. Tiene la forma `postgres://usuario:clave@...-pooler.../neondb?sslmode=require`.
3. Guardala en un lugar seguro (un gestor de contraseñas). **No la pegues en chats ni la subas al repo.**

## Paso 3: publicar en Vercel

1. En [vercel.com](https://vercel.com): **Add New → Project → Import** el repo `Sabalero-https/pruebas`.
2. En **Environment Variables** cargá:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La connection string de Neon |
| `APP_URL` | `https://tareas.sumo-growth.com` |
| `APP_TIMEZONE` | `America/Argentina/Buenos_Aires` |
| `CRON_SECRET` | Una clave larga al azar (pedile a Claude: "generame una clave aleatoria de 40 caracteres") |

3. Tocá **Deploy**. Las tablas se crean solas la primera vez que arranca.
4. El archivo `vercel.json` ya programa la generación diaria de tareas recurrentes (06:05, hora de Argentina).

> **Si algo falla, prompt:**
> El deploy en Vercel falló con este error: [pegar el error]. Revisá el código y la configuración y decime qué hay que cambiar.

## Paso 4: el subdominio

1. En Vercel: **Project → Settings → Domains → Add** `tareas.sumo-growth.com`.
2. Vercel te muestra un registro **CNAME**. Cargalo en el panel donde se administra el dominio (donde se compró `sumo-growth.com`).
3. En minutos u horas queda andando con HTTPS. En la web de Sumo se puede agregar un link "Acceso equipo" que apunte ahí.

## Paso 5: primer ingreso y equipo

1. Abrí `https://tareas.sumo-growth.com`. La primera vez te lleva a **/setup** para crear el primer administrador.
2. En **Administración → Equipo**, invitá a cada persona **con el mismo email que usa en ClickUp**. Así la migración le asigna sus tareas.
3. Cada invitación genera un link (vale 7 días, un solo uso). Mandalo por WhatsApp o mail; la persona elige su contraseña.
4. En **Administración → Clientes**, revisá que estén los clientes y asignales un responsable de cuenta.

## Paso 6: migrar desde ClickUp

Primero una **simulación**: no guarda nada, solo muestra qué se importaría y avisa de problemas (estados raros, personas que no existen).

> **Prompt:**
> Quiero migrar las tareas de ClickUp a la base de producción. El token de ClickUp y la DATABASE_URL te los paso por variables de entorno, no en el chat. Primero corré el importador en modo simulación (npm run importar:clickup) y explicame el resultado y las advertencias. No uses --aplicar hasta que yo te diga.

Si el resultado está bien:

> **Prompt:**
> Ahora corré la importación real con --aplicar y mostrame el resumen.

Se puede repetir sin miedo: cada tarea recuerda su id de ClickUp y no se duplica.

## Paso 7: tareas recurrentes

En **Recurrentes** cargá las que hoy se repiten a mano:

- Daily Forecast: días hábiles.
- Optimización semanal de campañas: lunes.
- Reporte mensual + P&L: día 1, título `Reporte mensual {mes}`.
- Enviar status al cliente: cada semana.

## Paso 8: conectar los agentes de IA

1. En **Administración → API y agentes**, creá **un token por agente** (Agente 1 Calendario, Agente 2 Grilla, Agente 3 Pauta…). El token se muestra una sola vez.
2. Quien configure los agentes tiene que leer `docs/api.md`. Lo importante:
   - Crean tareas con `POST /api/v1/tareas`.
   - Cliente, área y responsable se pueden mandar por nombre.
   - Siempre conviene mandar `clave_externa`, así un reintento no duplica la tarea.
   - Para entregar algo: estado `en revisión` más un comentario con el link.

> **Prompt:**
> Leé docs/api.md y adaptá [el agente / el flujo X] para que en vez de crear tareas en ClickUp las cree en https://tareas.sumo-growth.com/api/v1, usando el token que voy a guardar en la variable SUMO_TAREAS_TOKEN.

## Paso 9: uso en paralelo y apagar ClickUp

1. Durante **una semana** todo lo nuevo se crea en la app nueva. ClickUp queda solo para consultar.
2. Al terminar la semana, revisión rápida en la reunión de equipo: ¿falta algo indispensable?
3. Dejá ClickUp en solo lectura un mes y después dalo de baja.

## Checklist final

- [ ] PR mergeado a `main`
- [ ] Base creada en Neon
- [ ] Proyecto en Vercel con las 4 variables
- [ ] `tareas.sumo-growth.com` funcionando con HTTPS
- [ ] Admin creado en /setup
- [ ] Equipo invitado (mismos emails que ClickUp)
- [ ] Simulación de importación revisada
- [ ] Importación aplicada
- [ ] Recurrentes cargadas
- [ ] Tokens creados y agentes apuntando a la API nueva
- [ ] Semana en paralelo
- [ ] ClickUp en solo lectura

## Si algo no anda

| Síntoma | Qué hacer |
|---|---|
| "La base local está abierta por otro proceso" | Pasa solo en tu compu: cerrá `npm run dev` antes de correr scripts. |
| Los links de invitación apuntan a `localhost` | Falta `APP_URL` en Vercel. Cargala y volvé a desplegar. |
| Las fechas aparecen corridas un día | Revisá `APP_TIMEZONE`. |
| No se generan las recurrentes | Revisá que exista `CRON_SECRET` en Vercel y que el cliente no esté pausado. También se generan solas cuando alguien abre la app. |
| Error de conexión a la base | Usá la connection string **pooled** de Neon, con `sslmode=require`. |
| Cualquier otra cosa | Pegale el error completo a Claude Code junto con "leé CLAUDE.md primero". |

## Pendientes de marca

- Agregar el archivo de la tipografía custom **SumoGrowth** (`public/fonts/` y un `@font-face`). Mientras tanto, el wordmark usa Montserrat.
- Reemplazar el favicon provisorio (sol rojo) por el **ícono oficial** (carita de sumo): guardar `src/app/icon.png` y borrar `src/app/icon.svg`.

> **Prompt:**
> Te paso el archivo de la tipografía SumoGrowth y el ícono oficial. Integralos siguiendo las reglas de marca de CLAUDE.md y mostrame cómo quedó el login.

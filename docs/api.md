# API v1: referencia para agentes e integraciones

Base: `https://<tu-dominio>/api/v1`. Todas las respuestas son JSON.

## Autenticación

Un admin crea un token en **Administración → API y agentes** (uno por agente). Se muestra una sola vez.

```
Authorization: Bearer sg_xxxxxxxxxxxxxxxx
```

Todo lo que hace un token queda en el historial de la tarea como `API · <nombre del token>`.

## Referencias flexibles

En `cliente`, `area` y `responsable` se puede mandar:

- el **id** (uuid),
- el **slug** (`flex-sports`),
- el **nombre**, sin importar mayúsculas, acentos ni signos (`"flex sports"`, `"Planificacion"`),
- para responsables, también el **email** o el primer nombre, si no es ambiguo.

Si la referencia coincide con más de uno, la respuesta es `409 ambiguo` con los candidatos.

Estados aceptados: `backlog`, `por_hacer`, `en_curso`, `en_revision`, `esperando_cliente`, `hecho`, y los alias habituales (`to do`, `pendiente`, `in progress`, `ready for review`, `review`, `blocked`, `done`, `complete`, `approved`…).

Prioridades: `urgente`, `alta`, `normal`, `baja` (también `urgent`, `high`, `low`, o 1–4 como en ClickUp).

Fechas (`vence_el`): `YYYY-MM-DD`, fecha-hora ISO o epoch en ms. Se guarda el día en hora de Argentina. `null` quita la fecha.

## Endpoints

### `GET /tareas`

Por defecto devuelve las tareas **abiertas** (no hechas ni archivadas), ordenadas por vencimiento.

| Parámetro | Ejemplo |
|---|---|
| `cliente` | `cliente=flex-sports` |
| `area` | `area=pauta` (o `sin`) |
| `responsable` | `responsable=bruno@sumo-growth.com` (o `sin`) |
| `estado` | `estado=en_revision,esperando_cliente` o `estado=todas` |
| `prioridad` | `prioridad=urgente,alta` |
| `vence` | `vencida`, `hoy`, `semana`, `proxima`, `sin_fecha` |
| `vence_desde`, `vence_hasta` | `2026-10-01` |
| `q` | búsqueda en título y descripción |
| `clave_externa` | busca una tarea creada por un agente (incluye las hechas) |
| `limite`, `offset` | paginación (máximo 200) |

```json
{ "tareas": [ { "id": "…", "titulo": "…", "estado": "en_revision", "vence_el": "2026-10-20",
    "cliente": { "id": "…", "nombre": "Flex Sports", "slug": "flex-sports" },
    "area": { "id": "…", "nombre": "Planificación" }, "responsable": null,
    "version": 3, "url": "https://…/tareas/…" } ],
  "hay_mas": false, "siguiente_offset": null }
```

### `POST /tareas`

```json
{
  "titulo": "Grilla de contenidos — Noviembre 2026",
  "cliente": "Flex Sports",
  "area": "Planificación",
  "responsable": null,
  "estado": "en revisión",
  "prioridad": "normal",
  "vence_el": "2026-10-28",
  "descripcion": "Generada por el Agente 2",
  "links": [{ "titulo": "Documento", "url": "https://docs.google.com/…" }],
  "clave_externa": "agente2:grilla:2026-11"
}
```

- Obligatorios: `titulo` y `cliente`.
- **`clave_externa`** (recomendada): si ya existe una tarea con esa clave, devuelve la existente con `200` y `"creada": false`, sin duplicar. Si no, la crea y devuelve `201`.
- Un campo desconocido (por ejemplo `responsible` en vez de `responsable`) da `422`: así un error de tipeo no se pierde en silencio.

### `GET /tareas/:id`

Devuelve la tarea con sus comentarios e historial.

### `PATCH /tareas/:id`

Cambios parciales con los mismos campos que el POST, salvo `clave_externa`. Para no pisar cambios de otra persona, mandá la `version` que leíste: si la tarea cambió desde entonces, responde `409 conflicto`.

```json
{ "estado": "hecho", "version": 3 }
```

### `DELETE /tareas/:id`

Archiva la tarea (no la borra). Se puede restaurar desde la app.

### `GET|POST /tareas/:id/comentarios`

```json
{ "cuerpo": "Entregable listo: https://docs.google.com/…" }
```

### Catálogos

- `GET /clientes` (agregá `?incluir_archivados=true` para ver todos)
- `GET /areas`
- `GET /colaboradores` (solo activos)

## Errores

```json
{ "error": { "codigo": "no_encontrado", "mensaje": "No existe el cliente \"Nike\"" } }
```

| HTTP | Códigos |
|---|---|
| 400 | `json_invalido` |
| 401 | `no_autorizado` |
| 404 | `no_encontrado` |
| 409 | `ambiguo`, `conflicto` |
| 422 | `campos_desconocidos`, `estado_invalido`, `prioridad_invalida`, `fecha_invalida`, `cliente_archivado`, `colaborador_inactivo`, `area_inactiva`, `campo_requerido`, … |

## Cron de recurrentes

`GET /api/cron/recurrentes` con `Authorization: Bearer $CRON_SECRET`. Es idempotente: se puede llamar varias veces por día sin duplicar tareas.

# App de Seguimiento de Leads: guía

Una app web simple para cargar y seguir leads, que guarda todo en la planilla
**"Fecundart - Seguimiento de Leads"**. La planilla sigue siendo la base de datos:
la hoja *Resumen* y cualquier fórmula que tengan siguen funcionando igual.

La app tiene tres pantallas:

| Pantalla | Para qué |
|---|---|
| **Nuevo lead** | Formulario corto. La fecha se completa sola, las listas se eligen con un toque y avisa si el teléfono ya estaba cargado. |
| **Seguimiento** | Lista de leads con buscador y filtros por estado ("A seguir" muestra los que todavía requieren acción). Tocando un lead se edita; el botón de WhatsApp abre el chat directo. |
| **Resultados** | Leads del período, turnos agendados y realizados con su %, gráfico por mes y desgloses por estado, motivo y origen. |

Todo lo que se ve en la app (campos, listas, métricas, colores) se define en la
hoja **Config** de la misma planilla. No hace falta tocar código para cambiarlo.

---

## 1. Instalación (una sola vez, unos 10 minutos)

Lo hace quien administra la planilla, desde una computadora.

1. Abrir la planilla → menú **Extensiones → Apps Script**.
2. En el editor que se abre:
   - En el archivo `Código.gs`, borrar todo y pegar el contenido de [`src/Codigo.gs`](src/Codigo.gs).
   - Botón **+** (al lado de "Archivos") → **HTML** → nombre: `Index` (así, con mayúscula y sin `.html`).
     Borrar lo que trae y pegar el contenido de [`src/Index.html`](src/Index.html).
   - Guardar (ícono de disquete o Ctrl+S). Arriba, a la izquierda, se puede renombrar el proyecto a "App de Leads".
3. Preparar la planilla: en la barra de arriba del editor elegir la función **`configurarPlanilla`** y tocar **Ejecutar**.
   - La primera vez Google pide permisos. Si aparece "Google no verificó esta app", tocar
     **Configuración avanzada → Ir a App de Leads (no seguro)** → **Permitir**. Es normal en
     scripts propios: el código solo accede a esta planilla.
   - Esto crea la hoja **Config**, agrega la columna **Origen** a *Leads* y una columna **ID**
     oculta al final (la app la usa para identificar cada fila; no borrarla).
   - Tarda unos segundos. El resultado se ve en el **Registro de ejecución** del editor y en un aviso
     abajo a la derecha de la planilla.
4. Volver a la planilla y revisar la hoja **Config** (ver sección 3). Al recargar la planilla aparece
   el menú **App de Leads**, con el que se puede repetir este paso cuando haga falta.
5. Publicar la app: en el editor, **Implementar → Nueva implementación**.
   - Engranaje de "Seleccionar tipo" → **Aplicación web**.
   - *Ejecutar como*: **Usuario que accede a la aplicación web**.
   - *Quién tiene acceso*: **Cualquier usuario con una cuenta de Google**.
   - **Implementar** → copiar la **URL de la aplicación web**. Ese es el link de la app.
     También se puede ver después desde la planilla: **App de Leads → Ver link de la app**.

### Darle acceso a la secretaria

- La planilla tiene que estar compartida con su cuenta de Google **como Editor**.
- Pasarle el link de la app. La primera vez que lo abra le va a pedir permisos (mismo aviso del paso 3).
- En el celular: abrir el link en Chrome/Safari → **Agregar a pantalla de inicio**, y queda como una app más.

**¿Quién puede ver los datos?** Solo las personas con permiso de edición en la planilla.
Cualquier otra persona que abra el link ve el mensaje "No tenés acceso a la planilla".
Para sacarle el acceso a alguien, alcanza con dejar de compartirle la planilla.

### Actualizar la app cuando cambie el código

1. Pegar el código nuevo en `Código.gs` y/o `Index` y guardar.
2. **Implementar → Gestionar implementaciones** → lápiz ✏️ → *Versión*: **Nueva versión** → **Implementar**.

El link sigue siendo el mismo. (Los cambios en la hoja Config **no** requieren esto: se ven al tocar "Actualizar" en la app.)

---

## 2. Uso diario

- **Cargar un lead:** pestaña *Nuevo lead* → completar → **Guardar lead**. Los campos con `*` son obligatorios.
  "Fecha del turno" aparece solo si se marca que agendó turno.
- **Seguir un lead:** pestaña *Seguimiento* → tocar la tarjeta → cambiar el estado (está arriba de todo),
  la fecha del turno o agregar un comentario → **Guardar cambios**.
- **Actualizar:** si alguien cargó algo desde otro dispositivo o desde la planilla, tocar **Actualizar** (arriba a la derecha).
- Se puede seguir editando la planilla a mano. La app la lee tal cual.

---

## 3. Cómo configurar (hoja Config)

La hoja Config tiene tres tablas una al lado de la otra.

### Campos (columnas A a H)

Cada fila es un campo del formulario y una columna de la hoja *Leads* (el nombre tiene que coincidir con el encabezado; mayúsculas y tildes no importan).

| Columna | Qué hace |
|---|---|
| **Campo** | Nombre del campo = encabezado de la columna en *Leads*. Si la columna no existe, la app la crea sola al guardar. |
| **Tipo** | `texto`, `texto largo`, `telefono`, `email`, `numero`, `fecha`, `lista`, `si/no`. |
| **Opciones** | Solo para `lista`, separadas por coma. Hasta 7 opciones cortas se muestran como botones; más, como desplegable. Si se deja vacío, usa el desplegable que tenga la columna en *Leads*. |
| **Obligatorio** | No deja guardar si está vacío. |
| **Ver en lista** | Se muestra en las tarjetas de *Seguimiento*. |
| **Por defecto** | Valor inicial al cargar un lead nuevo. Para fechas: `hoy`. |
| **Mostrar solo si** | Condición para que el campo aparezca, por ejemplo `Agendo turno = Si` (varios valores con coma). |
| **Ocultar** | Lo saca de la app sin borrar la columna ni los datos. |

El orden de las filas es el orden del formulario.

### Ajustes (columnas J y K)

| Ajuste | Qué hace |
|---|---|
| Título de la app | Lo que se ve arriba y en la pestaña del navegador. |
| Hoja de datos | Nombre de la hoja donde se guardan los leads (`Leads`). |
| Fila de encabezados | En qué fila están los títulos de las columnas (normalmente `1`). |
| Campo de fecha de carga | Qué fecha se usa para agrupar por mes en *Resultados*. |
| Campo de nombre / teléfono / estado | Qué campos cumplen esos roles (título de la tarjeta, WhatsApp y duplicados, filtros). |
| Estados a seguir | Estados que aparecen en el filtro "A seguir" de *Seguimiento*. |
| Acciones por estado | Qué hay que hacer con un lead según su estado, con el formato `Estado: Acción` separado por comas. Ejemplo: `No asistió: Recontactar`. La acción se ve como etiqueta en la tarjeta, tiene su propio filtro en *Seguimiento* y esos leads también entran en "A seguir". El estado no cambia. |
| Agrupar resultados por | Campos para los desgloses de *Resultados* (además del estado). |
| Prefijo WhatsApp | Se antepone al teléfono para el link de WhatsApp. `549` = celulares de Argentina. |
| Color principal | Color de la app en formato `#rrggbb` (el código de color de la marca). |
| Tema | `claro` (si se deja vacío, también), `oscuro` o `automático` (sigue la configuración de cada celular o computadora). |

### Métricas (columnas M a O)

Cada fila es una tarjeta en *Resultados* y una columna en los desgloses. Una métrica cuenta los leads
cuyo **Campo** tenga alguno de los **valores** indicados. El % se calcula sobre el total de leads.

Ejemplos:

| Métrica | Campo | Cuenta cuando el valor es |
|---|---|---|
| Turnos agendados | Agendo turno | Si |
| Turnos realizados | Estado | Turno realizado |
| Leads de fertilidad | Motivo de consulta | Fertilidad |

### Ejemplos de cambios comunes

- **Agregar "Obra social":** nueva fila en Campos → `Obra social` · `texto`. Tocar *Actualizar* en la app. La columna se crea en *Leads* al guardar el primer lead.
- **Agregar un estado:** sumarlo en *Opciones* de `Estado` (y en *Estados a seguir* si corresponde).
  Si la columna Estado de *Leads* tiene un desplegable, conviene agregarlo ahí también.
- **Dejar de pedir un dato:** tildar *Ocultar* en esa fila.
- **Marcar a quién recontactar:** en Ajustes, fila *Acciones por estado* → `No asistió: Recontactar`.
  Si la Config se creó antes de que existiera este ajuste, agregar la fila a mano debajo de *Color principal*
  (columna J: `Acciones por estado`, columna K: el valor).

> ⚠️ **Renombrar** un campo en Config sin renombrar la columna en *Leads* hace que la app cree una columna nueva
> (vacía). Si se renombra, hacerlo en los dos lugares.
>
> ⚠️ La hoja *Resumen* cuenta con sus propias fórmulas. Si cambian los nombres de los estados,
> revisar que esas fórmulas usen los nombres nuevos.

---

## 4. Para quien mantiene el código

```
leads-app/
├── src/                     ← lo que se pega en Apps Script
│   ├── Codigo.gs            servidor: lee Config, lee/escribe la hoja
│   ├── Index.html           interfaz (HTML + CSS + JS en un solo archivo)
│   └── appsscript.json      manifiesto (opcional si se implementa desde el editor)
└── dev/
    ├── mock-gas.js          simulación de SpreadsheetApp y compañía, en memoria
    ├── semilla.js           planilla de prueba con la misma forma que la real
    ├── test.js              tests del servidor           → npm test
    ├── armar-vista-previa.js genera vista-previa.html   → npm run vista-previa
    └── vista-previa.html    la app completa con datos de prueba, se abre con doble clic
```

Para usar `clasp` en vez de copiar y pegar, `src/` ya tiene la forma de un proyecto de clasp
(`clasp clone <scriptId> --rootDir src`, después `clasp push`).

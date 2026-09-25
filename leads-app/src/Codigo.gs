/**
 * App de Seguimiento de Leads (Google Apps Script, vinculado a la planilla).
 *
 * La planilla es la base de datos. La hoja "Config" define qué campos tiene el
 * formulario, qué listas muestra y qué métricas calcula la pantalla de resultados.
 *
 * @OnlyCurrentDoc
 */

var HOJA_CONFIG = 'Config';
var COLUMNA_ID = 'ID';

var TIPOS = ['texto', 'texto largo', 'telefono', 'email', 'numero', 'fecha', 'lista', 'si/no'];

// Distribución de la hoja Config: tres tablas una al lado de la otra.
var BLOQUE_CAMPOS = {
  col: 1,
  titulos: ['Campo', 'Tipo', 'Opciones (separadas por coma)', 'Obligatorio', 'Ver en lista',
    'Por defecto', 'Mostrar solo si', 'Ocultar']
};
var BLOQUE_AJUSTES = { col: 10, titulos: ['Ajuste', 'Valor'] };
var BLOQUE_METRICAS = { col: 13, titulos: ['Métrica', 'Campo', 'Cuenta cuando el valor es'] };

// Etiqueta visible en Config -> clave interna.
var AJUSTES = [
  ['titulo', 'Título de la app'],
  ['hoja', 'Hoja de datos'],
  ['filaEncabezados', 'Fila de encabezados'],
  ['campoFecha', 'Campo de fecha de carga'],
  ['campoNombre', 'Campo de nombre'],
  ['campoTelefono', 'Campo de teléfono'],
  ['campoEstado', 'Campo de estado'],
  ['estadosSeguir', 'Estados a seguir'],
  ['acciones', 'Acciones por estado'],
  ['agruparPor', 'Agrupar resultados por'],
  ['prefijoWhatsapp', 'Prefijo WhatsApp'],
  ['color', 'Color principal']
];

var OPCIONES_ESTADO = ['Nuevo', 'Contactado', 'Turno agendado', 'Asistió', 'No asistió', 'No le interesa'];
var OPCIONES_MOTIVO = ['Control ginecológico', 'Fertilidad', 'Embarazo', 'Consulta general', 'Otro'];
var OPCIONES_ORIGEN = ['Instagram', 'Facebook', 'Google', 'WhatsApp', 'Recomendación', 'Otro'];

// ---------------------------------------------------------------------------
// Entradas: web app y menú de la planilla
// ---------------------------------------------------------------------------

function doGet() {
  var titulo = 'Seguimiento de Leads';
  try {
    titulo = leerConfig_().ajustes.titulo || titulo;
  } catch (e) {
    // Sin Config todavía: la app muestra el error al cargar datos.
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(titulo)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('App de Leads')
    .addItem('Configurar / revisar planilla', 'configurarPlanillaDesdeMenu')
    .addItem('Ver link de la app', 'mostrarLinkApp')
    .addToUi();
}

function mostrarLinkApp() {
  var ui = SpreadsheetApp.getUi();
  var url = ScriptApp.getService().getUrl();
  if (url) {
    ui.alert('Link de la app', url, ui.ButtonSet.OK);
  } else {
    ui.alert('La app todavía no está publicada',
      'En el editor de Apps Script: Implementar → Nueva implementación → Aplicación web.',
      ui.ButtonSet.OK);
  }
}

/** Igual que configurarPlanilla, pero muestra el resultado en un cuadro (el menú corre con la planilla a la vista). */
function configurarPlanillaDesdeMenu() {
  var partes = configurarPlanilla();
  var ui = SpreadsheetApp.getUi();
  ui.alert('App de Leads', partes.join('\n\n'), ui.ButtonSet.OK);
}

/**
 * Crea la hoja Config a partir de las columnas actuales (si no existe) y deja la
 * hoja de datos lista: columnas faltantes, columna ID oculta e IDs completos.
 * Se puede correr todas las veces que haga falta; nunca pisa una Config existente.
 *
 * No abre cuadros de diálogo: corrida desde el editor, un alert() queda esperando en la
 * pestaña de la planilla hasta que se agota el tiempo de ejecución. El resultado va al
 * registro de ejecución y a un aviso breve en la planilla.
 */
function configurarPlanilla() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var creada = false;
  if (!ss.getSheetByName(HOJA_CONFIG)) {
    crearConfig_(ss);
    creada = true;
  }
  var cfg = leerConfig_();
  var hoja = hojaDatos_(cfg);
  var nombres = cfg.campos.filter(function (c) { return c.activo; })
    .map(function (c) { return c.nombre; });
  var agregadas = asegurarColumnas_(hoja, cfg.ajustes.filaEncabezados, nombres);
  var ids = completarIds_(hoja, cfg);

  var partes = [];
  partes.push(creada ? 'Creé la hoja "Config" a partir de tus columnas. Revisala y ajustala a gusto.'
    : 'La hoja "Config" ya existía: no la modifiqué.');
  if (agregadas.length) partes.push('Agregué estas columnas a "' + hoja.getName() + '": ' + agregadas.join(', ') + '.');
  if (ids) partes.push('Asigné un ID interno a ' + ids + ' fila(s) (columna "ID", oculta).');
  var url = ScriptApp.getService().getUrl();
  if (url) partes.push('Link de la app: ' + url);

  console.log(partes.join('\n\n'));
  ss.toast(creada ? 'Listo: se creó la hoja Config.' : 'Listo: la planilla ya estaba configurada.', 'App de Leads', 8);
  return partes;
}

// ---------------------------------------------------------------------------
// API que usa la app (google.script.run)
// ---------------------------------------------------------------------------

/** Devuelve la configuración y todos los leads, listos para la interfaz. */
function obtenerDatos() {
  var cfg = leerConfig_();
  var hoja = hojaDatos_(cfg);
  var ss = hoja.getParent();
  var tz = ss.getSpreadsheetTimeZone();
  var filaEnc = cfg.ajustes.filaEncabezados;

  completarIds_(hoja, cfg);
  var mapa = mapaColumnas_(hoja, filaEnc);
  var avisos = [];

  cfg.campos.forEach(function (c) {
    var col = mapa[norm_(c.nombre)];
    if (c.activo && !col) {
      avisos.push('La columna "' + c.nombre + '" no existe todavía en la hoja; se crea sola al guardar el primer lead.');
    }
    // Una lista sin opciones en Config toma las del desplegable de la planilla.
    if (col && (c.tipo === 'lista') && !c.opciones.length) {
      c.opciones = opcionesDeValidacion_(hoja.getRange(filaEnc + 1, col));
    }
  });

  var leads = [];
  var ultima = hoja.getLastRow();
  if (ultima > filaEnc) {
    var ancho = hoja.getLastColumn();
    var valores = hoja.getRange(filaEnc + 1, 1, ultima - filaEnc, ancho).getValues();
    var colId = mapa[norm_(COLUMNA_ID)];
    valores.forEach(function (fila, i) {
      var lead = leadDesdeFila_(fila, cfg, mapa, tz);
      if (!lead) return;
      lead.id = colId ? String(fila[colId - 1]) : '';
      lead.fila = filaEnc + 1 + i;
      leads.push(lead);
    });
  }

  return {
    config: cfg,
    leads: leads,
    avisos: avisos,
    hoy: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'),
    usuario: emailUsuario_()
  };
}

/**
 * Crea (sin id) o actualiza (con id) un lead.
 * @param {{id: string, valores: Object<string, *>}} datos valores por nombre de campo
 */
function guardarLead(datos) {
  if (!datos || typeof datos.valores !== 'object') throw new Error('Datos inválidos.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var cfg = leerConfig_();
    var hoja = hojaDatos_(cfg);
    var filaEnc = cfg.ajustes.filaEncabezados;
    var tz = hoja.getParent().getSpreadsheetTimeZone();

    var valores = datos.valores;
    // Un lead nuevo recibe el valor por defecto de los campos que no vinieron del
    // formulario, incluidos los ocultos: así se puede ocultar "Fecha" y que se complete sola.
    var defectos = datos.id ? [] : valoresPorDefecto_(cfg, valores, tz);
    if (defectos.length) {
      valores = {};
      Object.keys(datos.valores).forEach(function (k) { valores[k] = datos.valores[k]; });
      defectos.forEach(function (d) { valores[d.campo.nombre] = d.valor; });
    }
    var campos = cfg.campos.filter(function (c) {
      return (c.activo && Object.prototype.hasOwnProperty.call(valores, c.nombre)) ||
        defectos.some(function (d) { return d.campo === c; });
    });
    validarObligatorios_(cfg, valores);

    asegurarColumnas_(hoja, filaEnc, campos.map(function (c) { return c.nombre; }));
    var mapa = mapaColumnas_(hoja, filaEnc);
    var colId = mapa[norm_(COLUMNA_ID)];

    var fila, id = datos.id ? String(datos.id) : '';
    if (id) {
      fila = buscarFilaPorId_(hoja, filaEnc, colId, id);
      if (!fila) throw new Error('No encontré ese lead en la planilla (¿lo borraron?). Tocá "Actualizar" y probá de nuevo.');
    } else {
      id = nuevoId_();
      fila = ultimaFilaConDatos_(hoja, filaEnc, cfg, mapa) + 1;
      if (fila > hoja.getMaxRows()) hoja.insertRowsAfter(hoja.getMaxRows(), fila - hoja.getMaxRows());
      hoja.getRange(fila, colId).setValue(id);
    }

    campos.forEach(function (c) {
      escribirCelda_(hoja.getRange(fila, mapa[norm_(c.nombre)]), c, valores[c.nombre]);
    });
    SpreadsheetApp.flush();

    var filaValores = hoja.getRange(fila, 1, 1, hoja.getLastColumn()).getValues()[0];
    var lead = leadDesdeFila_(filaValores, cfg, mapa, tz) || { v: {} };
    lead.id = id;
    lead.fila = fila;
    return lead;
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Lectura de Config
// ---------------------------------------------------------------------------

function leerConfig_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(HOJA_CONFIG);
  if (!hoja) {
    throw new Error('Falta la hoja "Config". Abrí la planilla y usá el menú App de Leads → Configurar / revisar planilla.');
  }
  var ultima = Math.max(hoja.getLastRow(), 1);
  var ancho = Math.max(hoja.getLastColumn(), BLOQUE_METRICAS.col + BLOQUE_METRICAS.titulos.length - 1);
  var v = hoja.getRange(1, 1, ultima, ancho).getValues();

  var campos = [];
  var ajustesPorEtiqueta = {};
  var metricas = [];
  for (var r = 1; r < v.length; r++) {
    var fila = v[r];
    var nombre = texto_(fila[BLOQUE_CAMPOS.col - 1]);
    if (nombre) {
      var b = BLOQUE_CAMPOS.col - 1;
      campos.push({
        nombre: nombre,
        tipo: normalizarTipo_(fila[b + 1]),
        opciones: lista_(fila[b + 2]),
        obligatorio: bool_(fila[b + 3], false),
        verEnLista: bool_(fila[b + 4], false),
        porDefecto: texto_(fila[b + 5]),
        mostrarSi: parsearCondicion_(fila[b + 6]),
        activo: !bool_(fila[b + 7], false)
      });
    }
    var etiqueta = texto_(fila[BLOQUE_AJUSTES.col - 1]);
    if (etiqueta) ajustesPorEtiqueta[norm_(etiqueta)] = fila[BLOQUE_AJUSTES.col];

    var nombreMetrica = texto_(fila[BLOQUE_METRICAS.col - 1]);
    var campoMetrica = texto_(fila[BLOQUE_METRICAS.col]);
    if (nombreMetrica && campoMetrica) {
      metricas.push({ nombre: nombreMetrica, campo: campoMetrica, valores: lista_(fila[BLOQUE_METRICAS.col + 1]) });
    }
  }
  if (!campos.length) throw new Error('La hoja "Config" no tiene campos cargados (columna "Campo").');

  var a = {};
  AJUSTES.forEach(function (par) { a[par[0]] = ajustesPorEtiqueta[norm_(par[1])]; });
  var primero = function (tipo) {
    var c = campos.filter(function (x) { return x.tipo === tipo; })[0];
    return c ? c.nombre : '';
  };
  var ajustes = {
    titulo: texto_(a.titulo) || 'Seguimiento de Leads',
    hoja: texto_(a.hoja),
    filaEncabezados: Math.max(1, parseInt(a.filaEncabezados, 10) || 1),
    campoFecha: texto_(a.campoFecha) || primero('fecha'),
    campoNombre: texto_(a.campoNombre) || campos[0].nombre,
    campoTelefono: texto_(a.campoTelefono) || primero('telefono'),
    campoEstado: texto_(a.campoEstado),
    estadosSeguir: lista_(a.estadosSeguir),
    acciones: parsearAcciones_(a.acciones),
    agruparPor: lista_(a.agruparPor),
    prefijoWhatsapp: texto_(a.prefijoWhatsapp).replace(/\D/g, ''),
    color: /^#[0-9a-f]{6}$/i.test(texto_(a.color)) ? texto_(a.color) : '#8a4f9e'
  };

  return { campos: campos, ajustes: ajustes, metricas: metricas };
}

function hojaDatos_(cfg) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var nombre = cfg.ajustes.hoja;
  var hoja = nombre ? ss.getSheetByName(nombre) : null;
  if (!hoja) {
    throw new Error('No encuentro la hoja de datos "' + (nombre || '(vacío)') +
      '". Revisá el ajuste "Hoja de datos" en Config.');
  }
  return hoja;
}

// ---------------------------------------------------------------------------
// Creación de Config a partir de la hoja existente
// ---------------------------------------------------------------------------

function crearConfig_(ss) {
  var hojaDatos = ss.getSheetByName('Leads') || ss.getSheets()[0];
  var filaEnc = 1;
  var ancho = Math.max(hojaDatos.getLastColumn(), 1);
  var encabezados = hojaDatos.getRange(filaEnc, 1, 1, ancho).getValues()[0]
    .map(texto_)
    .filter(function (h) { return h && norm_(h) !== norm_(COLUMNA_ID); });

  var campos = encabezados.map(function (h, i) {
    return inferirCampo_(h, hojaDatos.getRange(filaEnc + 1, i + 1));
  });
  var buscar = function (re) {
    return campos.filter(function (c) { return re.test(norm_(c.nombre)); })[0];
  };

  var fecha = campos.filter(function (c) { return c.tipo === 'fecha'; })[0];
  var nombre = buscar(/nombre/) || campos[0];
  var telefono = campos.filter(function (c) { return c.tipo === 'telefono'; })[0];
  var estado = buscar(/estado/);
  var motivo = buscar(/motivo/);
  var agendo = campos.filter(function (c) {
    return /agend/.test(norm_(c.nombre)) && c.tipo === 'lista' && esSiNo_(c.opciones);
  })[0];
  var fechaTurno = buscar(/fecha.*turno|turno.*fecha/);

  if (!campos.length) {
    nombre = { nombre: 'Nombre y Apellido', tipo: 'texto', opciones: [] };
    campos.push(nombre);
  }
  if (!estado) {
    estado = { nombre: 'Estado', tipo: 'lista', opciones: OPCIONES_ESTADO.slice() };
    campos.push(estado);
  }
  estado.tipo = 'lista';
  if (!estado.opciones.length) estado.opciones = OPCIONES_ESTADO.slice();
  if (motivo && motivo.tipo === 'texto') {
    motivo.tipo = 'lista';
    motivo.opciones = OPCIONES_MOTIVO.slice();
  }
  var origen = buscar(/origen|fuente|canal/);
  if (!origen) {
    origen = { nombre: 'Origen', tipo: 'lista', opciones: OPCIONES_ORIGEN.slice() };
    // Justo antes de Comentarios si existe, si no al final.
    var iComent = campos.indexOf(buscar(/coment|nota|observ/));
    campos.splice(iComent >= 0 ? iComent : campos.length, 0, origen);
  }

  [fecha, nombre, telefono, estado].forEach(function (c) { if (c) c.obligatorio = true; });
  [nombre, telefono, motivo, estado, fechaTurno].forEach(function (c) { if (c) c.verEnLista = true; });
  if (fecha) fecha.porDefecto = 'hoy';
  if (estado.opciones.length) estado.porDefecto = estado.opciones[0];
  if (fechaTurno && agendo) fechaTurno.mostrarSi = agendo.nombre + ' = ' + opcionSi_(agendo.opciones);

  // Estados que siguen "abiertos": los que no son un cierre.
  var cierres = /asisti|realiz|atendid|no vino|no se present|no le interesa|descart|perdid|cerrad/;
  var seguir = estado.opciones.filter(function (o) { return !cierres.test(norm_(o)); });
  var realizado = estado.opciones.filter(function (o) {
    return /asisti|realiz|atendid|vino/.test(norm_(o)) && !/^no /.test(norm_(o));
  });
  if (!realizado.length) realizado = ['Asistió'];

  var metricas = [];
  if (agendo) {
    metricas.push(['Turnos agendados', agendo.nombre, opcionSi_(agendo.opciones)]);
  } else {
    var agendados = estado.opciones.filter(function (o) { return /agend|asisti|realiz/.test(norm_(o)); });
    metricas.push(['Turnos agendados', estado.nombre, agendados.join(', ') || 'Turno agendado']);
  }
  metricas.push(['Turnos realizados', estado.nombre, realizado.join(', ')]);

  var agrupar = [motivo, origen].filter(Boolean).map(function (c) { return c.nombre; });
  var ajustes = {
    titulo: 'Seguimiento de Leads',
    hoja: hojaDatos.getName(),
    filaEncabezados: filaEnc,
    campoFecha: fecha ? fecha.nombre : '',
    campoNombre: nombre.nombre,
    campoTelefono: telefono ? telefono.nombre : '',
    campoEstado: estado.nombre,
    estadosSeguir: seguir.join(', '),
    acciones: estado.opciones.filter(function (o) { return /^no (asisti|vino|se present)/.test(norm_(o)); })
      .map(function (o) { return o + ': Recontactar'; }).join(', '),
    agruparPor: agrupar.join(', '),
    prefijoWhatsapp: '549',
    color: '#8a4f9e'
  };

  escribirConfig_(ss, campos, ajustes, metricas);
}

function inferirCampo_(nombre, celdaEjemplo) {
  var n = norm_(nombre);
  var opciones = opcionesDeValidacion_(celdaEjemplo);
  var tipo = 'texto';
  if (opciones.length) tipo = 'lista';
  else if (/fecha|dia\b/.test(n)) tipo = 'fecha';
  else if (/telefono|celular|whatsapp|\btel\b/.test(n)) tipo = 'telefono';
  else if (/mail/.test(n)) tipo = 'email';
  else if (/coment|nota|observ/.test(n)) tipo = 'texto largo';
  else if (/^(agendo|agendó|asistio|vino)\b/.test(n) || /^(agendo turno)$/.test(n)) {
    tipo = 'lista';
    opciones = ['Si', 'No'];
  }
  return {
    nombre: nombre, tipo: tipo, opciones: opciones, obligatorio: false, verEnLista: false,
    porDefecto: '', mostrarSi: '', activo: true
  };
}

function escribirConfig_(ss, campos, ajustes, metricas) {
  var hoja = ss.insertSheet(HOJA_CONFIG);
  var filas = Math.max(campos.length, AJUSTES.length, metricas.length) + 1;
  hoja.setTabColor('#8a4f9e');

  var bc = BLOQUE_CAMPOS.col, nc = BLOQUE_CAMPOS.titulos.length;
  // Checkboxes y desplegable de tipo en filas de sobra para que agreguen campos.
  // Van antes de los valores porque insertCheckboxes() pone todo en FALSE.
  var filasEditables = Math.max(campos.length + 15, 30);
  [4, 5, 8].forEach(function (off) {
    hoja.getRange(2, bc + off - 1, filasEditables, 1).insertCheckboxes();
  });
  hoja.getRange(2, bc + 1, filasEditables, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(TIPOS, true).setAllowInvalid(false).build());

  hoja.getRange(1, bc, 1, nc).setValues([BLOQUE_CAMPOS.titulos]);
  if (campos.length) {
    hoja.getRange(2, bc, campos.length, nc).setValues(campos.map(function (c) {
      return [c.nombre, c.tipo, (c.opciones || []).join(', '), !!c.obligatorio, !!c.verEnLista,
        c.porDefecto || '', c.mostrarSi || '', c.activo === false];
    }));
  }

  var ba = BLOQUE_AJUSTES.col;
  hoja.getRange(1, ba, 1, 2).setValues([BLOQUE_AJUSTES.titulos]);
  hoja.getRange(2, ba, AJUSTES.length, 2).setValues(AJUSTES.map(function (par) {
    var valor = ajustes[par[0]];
    return [par[1], valor === undefined ? '' : valor];
  }));

  var bm = BLOQUE_METRICAS.col;
  hoja.getRange(1, bm, 1, 3).setValues([BLOQUE_METRICAS.titulos]);
  if (metricas.length) hoja.getRange(2, bm, metricas.length, 3).setValues(metricas);

  [[bc, nc], [ba, 2], [bm, 3]].forEach(function (b) {
    hoja.getRange(1, b[0], 1, b[1]).setFontWeight('bold').setBackground('#efe6f3').setFontColor('#3d2447');
  });
  hoja.setFrozenRows(1);
  var anchos = { 1: 170, 2: 100, 3: 320, 4: 90, 5: 90, 6: 110, 7: 190, 8: 60, 9: 24,
    10: 190, 11: 260, 12: 24, 13: 170, 14: 170, 15: 240 };
  Object.keys(anchos).forEach(function (c) { hoja.setColumnWidth(Number(c), anchos[c]); });
  hoja.getRange(1, 1, filas, 15).setWrap(true);

  hoja.getRange(1, bc + 1).setNote('Tipos: ' + TIPOS.join(', ') + '.');
  hoja.getRange(1, bc + 2).setNote('Solo para tipo "lista". Si lo dejás vacío, usa el desplegable que tenga la columna en la hoja de datos.');
  hoja.getRange(1, bc + 5).setNote('"hoy" para fechas, o un valor fijo (por ejemplo, un estado inicial).');
  hoja.getRange(1, bc + 6).setNote('Ejemplo: Agendo turno = Si\nEl campo solo aparece cuando se cumple la condición. Se pueden poner varios valores separados por coma.');
  hoja.getRange(1, bc + 7).setNote('Tildar para ocultar un campo de la app sin borrar la columna ni sus datos.');
  hoja.getRange(1, bm + 2).setNote('Valores (separados por coma) que cuentan para esta métrica. El % se calcula sobre el total de leads.');
  hoja.getRange(1, ba).setNote('"Estados a seguir" son los que aparecen por defecto en la pestaña Seguimiento.\n' +
    '"Acciones por estado": qué hay que hacer con un lead en ese estado, por ejemplo "No asistió: Recontactar". ' +
    'Esos leads también aparecen en "A seguir" y tienen su propio filtro.\n' +
    '"Prefijo WhatsApp": 549 para celulares de Argentina.');
}

// ---------------------------------------------------------------------------
// Hoja de datos
// ---------------------------------------------------------------------------

/** { nombreNormalizado: númeroDeColumna } */
function mapaColumnas_(hoja, filaEnc) {
  var ancho = Math.max(hoja.getLastColumn(), 1);
  var enc = hoja.getRange(filaEnc, 1, 1, ancho).getValues()[0];
  var mapa = {};
  enc.forEach(function (h, i) {
    var k = norm_(h);
    if (k && !mapa[k]) mapa[k] = i + 1;
  });
  return mapa;
}

/** Crea las columnas que falten (y la de ID, al final y oculta). Devuelve las creadas. */
function asegurarColumnas_(hoja, filaEnc, nombres) {
  var mapa = mapaColumnas_(hoja, filaEnc);
  var creadas = [];
  if (!mapa[norm_(COLUMNA_ID)]) {
    var col = hoja.getLastColumn() + 1;
    if (col > hoja.getMaxColumns()) hoja.insertColumnAfter(hoja.getMaxColumns());
    hoja.getRange(filaEnc, col).setValue(COLUMNA_ID);
    hoja.hideColumns(col);
    mapa = mapaColumnas_(hoja, filaEnc);
  }
  nombres.forEach(function (nombre) {
    if (mapa[norm_(nombre)]) return;
    var colId = mapa[norm_(COLUMNA_ID)];
    hoja.insertColumnBefore(colId);
    var celda = hoja.getRange(filaEnc, colId);
    if (colId > 1) hoja.getRange(filaEnc, colId - 1).copyFormatToRange(hoja, colId, colId, filaEnc, filaEnc);
    celda.setValue(nombre);
    creadas.push(nombre);
    mapa = mapaColumnas_(hoja, filaEnc);
  });
  return creadas;
}

/** Asigna ID a las filas con datos que no lo tengan. Devuelve cuántas completó. */
function completarIds_(hoja, cfg) {
  var filaEnc = cfg.ajustes.filaEncabezados;
  asegurarColumnas_(hoja, filaEnc, []);
  var mapa = mapaColumnas_(hoja, filaEnc);
  var colId = mapa[norm_(COLUMNA_ID)];
  var ultima = hoja.getLastRow();
  if (ultima <= filaEnc) return 0;
  var valores = hoja.getRange(filaEnc + 1, 1, ultima - filaEnc, hoja.getLastColumn()).getValues();
  var cols = columnasDeCampos_(cfg, mapa);
  var ids = valores.map(function (f) { return [f[colId - 1]]; });
  var n = 0;
  valores.forEach(function (f, i) {
    if (ids[i][0] === '' && filaTieneDatos_(f, cols)) {
      ids[i][0] = nuevoId_();
      n++;
    }
  });
  if (n) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      hoja.getRange(filaEnc + 1, colId, ids.length, 1).setValues(ids);
    } finally {
      lock.releaseLock();
    }
  }
  return n;
}

function columnasDeCampos_(cfg, mapa) {
  return cfg.campos.map(function (c) { return mapa[norm_(c.nombre)]; }).filter(Boolean);
}

function filaTieneDatos_(fila, cols) {
  return cols.some(function (c) { return fila[c - 1] !== '' && fila[c - 1] !== null; });
}

function ultimaFilaConDatos_(hoja, filaEnc, cfg, mapa) {
  var ultima = hoja.getLastRow();
  if (ultima <= filaEnc) return filaEnc;
  var valores = hoja.getRange(filaEnc + 1, 1, ultima - filaEnc, hoja.getLastColumn()).getValues();
  var cols = columnasDeCampos_(cfg, mapa).concat([mapa[norm_(COLUMNA_ID)]]);
  for (var i = valores.length - 1; i >= 0; i--) {
    if (filaTieneDatos_(valores[i], cols)) return filaEnc + 1 + i;
  }
  return filaEnc;
}

function buscarFilaPorId_(hoja, filaEnc, colId, id) {
  var ultima = hoja.getLastRow();
  if (ultima <= filaEnc) return 0;
  var ids = hoja.getRange(filaEnc + 1, colId, ultima - filaEnc, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) return filaEnc + 1 + i;
  }
  return 0;
}

function leadDesdeFila_(fila, cfg, mapa, tz) {
  var v = {};
  var tieneDatos = false;
  cfg.campos.forEach(function (c) {
    var col = mapa[norm_(c.nombre)];
    if (!col) return;
    var x = serializar_(fila[col - 1], tz);
    if (x !== '') tieneDatos = true;
    v[c.nombre] = x;
  });
  return tieneDatos ? { v: v } : null;
}

function serializar_(valor, tz) {
  if (valor instanceof Date) return Utilities.formatDate(valor, tz, 'yyyy-MM-dd');
  if (valor === true) return 'Si';
  if (valor === false) return 'No';
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return valor;
  return String(valor).trim();
}

function escribirCelda_(celda, campo, valor) {
  var s = valor === null || valor === undefined ? '' : String(valor).trim();
  switch (campo.tipo) {
    case 'fecha':
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (m) {
        celda.setNumberFormat('dd/mm/yyyy').setValue(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
      } else {
        celda.setValue('');
      }
      return;
    case 'numero':
      var n = Number(s.replace(',', '.'));
      celda.setValue(s === '' || isNaN(n) ? s : n);
      return;
    default:
      // Texto plano: evita que "+54..." o "=..." se interpreten como fórmula o número.
      celda.setNumberFormat('@').setValue(s);
  }
}

/** [{ campo, valor }] de los campos con "Por defecto" que no vinieron en `valores`. */
function valoresPorDefecto_(cfg, valores, tz) {
  return cfg.campos.filter(function (c) {
    return c.porDefecto && !Object.prototype.hasOwnProperty.call(valores, c.nombre) &&
      (!c.mostrarSi || condicionCumplida_(c.mostrarSi, valores));
  }).map(function (c) {
    var v = c.porDefecto;
    if (c.tipo === 'fecha' && norm_(v) === 'hoy') v = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    return { campo: c, valor: v };
  });
}

function validarObligatorios_(cfg, valores) {
  var faltan = cfg.campos.filter(function (c) {
    if (!c.activo || !c.obligatorio) return false;
    if (!Object.prototype.hasOwnProperty.call(valores, c.nombre)) return false;
    if (c.mostrarSi && !condicionCumplida_(c.mostrarSi, valores)) return false;
    return String(valores[c.nombre] === null || valores[c.nombre] === undefined ? '' : valores[c.nombre]).trim() === '';
  });
  if (faltan.length) {
    throw new Error('Falta completar: ' + faltan.map(function (c) { return c.nombre; }).join(', ') + '.');
  }
}

function condicionCumplida_(cond, valores) {
  var actual = norm_(valores[cond.campo]);
  return cond.valores.some(function (x) { return norm_(x) === actual; });
}

function opcionesDeValidacion_(celda) {
  try {
    var dv = celda.getDataValidation();
    if (!dv) return [];
    var tipo = dv.getCriteriaType();
    var crit = dv.getCriteriaValues();
    if (tipo === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      return (crit[0] || []).map(texto_).filter(Boolean);
    }
    if (tipo === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
      return crit[0].getValues().reduce(function (a, f) { return a.concat(f); }, [])
        .map(texto_).filter(Boolean);
    }
  } catch (e) {
    // Sin validación legible: la lista queda vacía.
  }
  return [];
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function norm_(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function texto_(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

function lista_(v) {
  return texto_(v).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
}

function bool_(v, siVacio) {
  if (v === true || v === false) return v;
  var s = norm_(v);
  if (s === '') return siVacio;
  return ['si', 'x', 'true', 'verdadero', '1'].indexOf(s) >= 0;
}

function normalizarTipo_(v) {
  var s = norm_(v).replace(/\s*\/\s*/, '/');
  var alias = { 'si/no': 'si/no', 'checkbox': 'si/no', 'desplegable': 'lista', 'numero': 'numero',
    'texto largo': 'texto largo', 'parrafo': 'texto largo', 'mail': 'email', 'correo': 'email',
    'tel': 'telefono', 'celular': 'telefono' };
  if (alias[s]) return alias[s];
  return TIPOS.indexOf(s) >= 0 ? s : 'texto';
}

/** "Agendo turno = Si, Tal vez" -> { campo: 'Agendo turno', valores: ['Si', 'Tal vez'] } */
function parsearCondicion_(v) {
  var s = texto_(v);
  var i = s.indexOf('=');
  if (i <= 0) return null;
  var campo = s.slice(0, i).trim();
  var valores = lista_(s.slice(i + 1));
  return campo && valores.length ? { campo: campo, valores: valores } : null;
}

/** "No asistió: Recontactar, Nuevo: Llamar" -> [{ estado: 'No asistió', accion: 'Recontactar' }, ...] */
function parsearAcciones_(v) {
  return lista_(v).map(function (par) {
    var m = /^(.+?)\s*[:=]\s*(.+)$/.exec(par);
    return m ? { estado: m[1].trim(), accion: m[2].trim() } : null;
  }).filter(Boolean);
}

function esSiNo_(opciones) {
  var o = opciones.map(norm_).sort().join('|');
  return o === 'no|si';
}

function opcionSi_(opciones) {
  return opciones.filter(function (o) { return norm_(o) === 'si'; })[0] || 'Si';
}

function nuevoId_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function emailUsuario_() {
  try {
    return Session.getActiveUser().getEmail() || '';
  } catch (e) {
    return '';
  }
}

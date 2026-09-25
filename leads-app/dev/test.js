/* Tests de Codigo.gs contra la planilla simulada. Correr con: npm test (desde leads-app/) */
'use strict';
process.env.TZ = 'America/Argentina/Cordoba';
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');

function entorno() {
  var ctx = vm.createContext({ console: console });
  ['mock-gas.js', 'semilla.js'].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx, { filename: f });
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'Codigo.gs'), 'utf8'), ctx, { filename: 'Codigo.gs' });
  return ctx;
}

var pruebas = [];
function prueba(nombre, fn) { pruebas.push([nombre, fn]); }

// Los objetos creados dentro del contexto vm son de otro "realm": se comparan planos.
function plano(x) { return JSON.parse(JSON.stringify(x)); }
function esFecha(x) { return Object.prototype.toString.call(x) === '[object Date]'; }

function encabezados(hoja) {
  return hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
}

prueba('configurarPlanilla crea Config a partir de las columnas y los desplegables', function () {
  var g = entorno();
  var ss = g.Semilla.crear();
  g.configurarPlanilla();
  var cfg = g.leerConfig_();

  var nombres = cfg.campos.map(function (c) { return c.nombre; });
  assert.deepEqual(plano(nombres), ['Fecha', 'Nombre y Apellido', 'Telefono', 'Motivo de consulta', 'Agendo turno',
    'Fecha del turno', 'Estado', 'Origen', 'Comentarios']);
  var por = {};
  cfg.campos.forEach(function (c) { por[c.nombre] = c; });
  assert.equal(por['Fecha'].tipo, 'fecha');
  assert.equal(por['Fecha'].porDefecto, 'hoy');
  assert.equal(por['Telefono'].tipo, 'telefono');
  assert.equal(por['Agendo turno'].tipo, 'lista');
  assert.deepEqual(plano(por['Agendo turno'].opciones), ['Si', 'No']);
  assert.deepEqual(plano(por['Estado'].opciones), plano(g.Semilla.ESTADOS), 'toma el desplegable existente');
  assert.equal(por['Estado'].porDefecto, 'Consulta');
  assert.equal(por['Motivo de consulta'].tipo, 'lista');
  assert.equal(por['Comentarios'].tipo, 'texto largo');
  assert.deepEqual(JSON.parse(JSON.stringify(por['Fecha del turno'].mostrarSi)), { campo: 'Agendo turno', valores: ['Si'] });
  assert.ok(cfg.campos.every(function (c) { return c.activo; }));

  assert.equal(cfg.ajustes.hoja, 'Leads');
  assert.equal(cfg.ajustes.campoEstado, 'Estado');
  assert.deepEqual(Array.from(cfg.ajustes.estadosSeguir), ['Consulta', 'Turno agendado']);
  assert.deepEqual(Array.from(cfg.ajustes.agruparPor), ['Motivo de consulta', 'Origen']);
  assert.deepEqual(JSON.parse(JSON.stringify(cfg.metricas)), [
    { nombre: 'Turnos agendados', campo: 'Agendo turno', valores: ['Si'] },
    { nombre: 'Turnos realizados', campo: 'Estado', valores: ['Turno realizado'] }
  ]);

  var leads = ss.getSheetByName('Leads');
  assert.deepEqual(plano(encabezados(leads)), plano(g.Semilla.ENCABEZADOS.concat(['Origen', 'ID'])));
  assert.ok(leads.ocultas[10], 'la columna ID queda oculta');
  assert.match(String(leads.getRange(2, 10).getValue()), /^[0-9a-f]{10}$/, 'la fila de ejemplo recibe ID');
});

prueba('configurarPlanilla no pisa una Config existente y se puede correr de nuevo', function () {
  var g = entorno();
  var ss = g.Semilla.crear();
  g.configurarPlanilla();
  var config = ss.getSheetByName('Config');
  config.getRange(2, 1).setValue('Fecha de ingreso'); // renombrado a mano
  var id = ss.getSheetByName('Leads').getRange(2, 10).getValue();
  var msgs = g.configurarPlanilla();
  assert.match(msgs[0], /ya existía/);
  assert.equal(config.getRange(2, 1).getValue(), 'Fecha de ingreso');
  assert.match(msgs.join(' '), /Fecha de ingreso/, 'crea la columna nueva en Leads');
  assert.equal(ss.getSheetByName('Leads').getRange(2, 11).getValue(), id, 'el ID se corre pero se conserva');
});

prueba('sin desplegable de Estado usa los estados por defecto', function () {
  var g = entorno();
  g.Semilla.crear({ conDesplegableEstado: false });
  g.configurarPlanilla();
  var cfg = g.leerConfig_();
  var estado = cfg.campos.filter(function (c) { return c.nombre === 'Estado'; })[0];
  assert.deepEqual(Array.from(estado.opciones), Array.from(g.OPCIONES_ESTADO));
  assert.deepEqual(Array.from(cfg.metricas[1].valores), ['Asistió']);
  assert.deepEqual(Array.from(cfg.ajustes.estadosSeguir), ['Nuevo', 'Contactado', 'Turno agendado']);
});

prueba('obtenerDatos devuelve leads serializados (fechas ISO) y salta filas vacías', function () {
  var g = entorno();
  g.Semilla.crear({ demo: 30, hoy: new Date(2026, 8, 25) });
  g.configurarPlanilla();
  var d = g.obtenerDatos();
  assert.equal(d.leads.length, 31);
  var ej = d.leads[0];
  assert.equal(ej.fila, 2);
  assert.equal(ej.v['Fecha'], '2026-09-03');
  assert.equal(ej.v['Fecha del turno'], '2026-09-10');
  assert.equal(ej.v['Nombre y Apellido'], 'Maria Gomez (EJEMPLO)');
  assert.equal(ej.v['Origen'], '');
  assert.ok(d.leads.every(function (l) { return /^[0-9a-f]{10}$/.test(l.id); }));
  assert.match(d.hoy, /^\d{4}-\d{2}-\d{2}$/);
  // Tiene que poder viajar por google.script.run: nada de Date ni funciones.
  assert.doesNotThrow(function () { JSON.stringify(d); });
  assert.equal(JSON.stringify(d).indexOf('"20') > 0, true);
  assert.deepEqual(JSON.parse(JSON.stringify(d)).leads[0], JSON.parse(JSON.stringify(ej)));
});

prueba('una lista sin opciones en Config toma el desplegable de la hoja', function () {
  var g = entorno();
  var ss = g.Semilla.crear();
  g.configurarPlanilla();
  var config = ss.getSheetByName('Config');
  config.getRange(8, 3).setValue(''); // Opciones de Estado (fila 8 = 7º campo)
  assert.equal(config.getRange(8, 1).getValue(), 'Estado');
  var d = g.obtenerDatos();
  var estado = d.config.campos.filter(function (c) { return c.nombre === 'Estado'; })[0];
  assert.deepEqual(plano(estado.opciones), plano(g.Semilla.ESTADOS));
});

prueba('guardarLead crea un lead en la primera fila libre, con tipos correctos', function () {
  var g = entorno();
  var ss = g.Semilla.crear();
  g.configurarPlanilla();
  var lead = g.guardarLead({ id: '', valores: {
    'Fecha': '2026-09-25', 'Nombre y Apellido': 'Ana Test', 'Telefono': '+54 9 351 000 0000',
    'Motivo de consulta': 'Fertilidad', 'Agendo turno': 'No', 'Estado': 'Consulta', 'Origen': 'Instagram',
    'Comentarios': '=HACK()'
  } });
  var hoja = ss.getSheetByName('Leads');
  assert.equal(lead.fila, 3);
  assert.match(lead.id, /^[0-9a-f]{10}$/);
  var fecha = hoja.getRange(3, 1).getValue();
  assert.ok(esFecha(fecha) && fecha.getFullYear() === 2026 && fecha.getMonth() === 8 && fecha.getDate() === 25);
  assert.equal(hoja.formatos['3,3'], '@', 'el teléfono se guarda como texto');
  assert.equal(hoja.getRange(3, 3).getValue(), '+54 9 351 000 0000');
  assert.equal(hoja.formatos['3,8'], '@', 'los textos no se interpretan como fórmula');
  assert.equal(hoja.getRange(3, 9).getValue(), 'Instagram');
  assert.equal(hoja.getRange(3, 10).getValue(), lead.id);
  assert.equal(lead.v['Fecha'], '2026-09-25');
  assert.ok(g.MockGAS.lockLibre(), 'libera el lock');
});

prueba('guardarLead actualiza por ID y no toca los campos que no se envían', function () {
  var g = entorno();
  var ss = g.Semilla.crear();
  g.configurarPlanilla();
  var hoja = ss.getSheetByName('Leads');
  var id = hoja.getRange(2, 10).getValue();
  var lead = g.guardarLead({ id: id, valores: { 'Estado': 'Turno realizado', 'Nombre y Apellido': 'Maria Gomez' } });
  assert.equal(lead.fila, 2);
  assert.equal(hoja.getRange(2, 7).getValue(), 'Turno realizado');
  assert.equal(hoja.getRange(2, 8).getValue(), 'Pidio turno por la tarde', 'Comentarios queda igual');
  assert.equal(lead.v['Fecha del turno'], '2026-09-10');
  assert.equal(g.obtenerDatos().leads.length, 1, 'no duplica filas');
});

prueba('guardarLead valida obligatorios, respetando "Mostrar solo si"', function () {
  var g = entorno();
  var ss = g.Semilla.crear();
  g.configurarPlanilla();
  var config = ss.getSheetByName('Config');
  config.getRange(7, 4).setValue(true); // Fecha del turno obligatoria (solo si agendó)
  assert.throws(function () {
    g.guardarLead({ id: '', valores: { 'Fecha': '2026-09-25', 'Nombre y Apellido': '', 'Telefono': '1', 'Estado': 'Consulta' } });
  }, /Falta completar: Nombre y Apellido/);
  assert.throws(function () {
    g.guardarLead({ id: '', valores: { 'Fecha': '2026-09-25', 'Nombre y Apellido': 'X', 'Telefono': '1', 'Estado': 'Consulta',
      'Agendo turno': 'Si', 'Fecha del turno': '' } });
  }, /Fecha del turno/);
  assert.doesNotThrow(function () {
    g.guardarLead({ id: '', valores: { 'Fecha': '2026-09-25', 'Nombre y Apellido': 'X', 'Telefono': '1', 'Estado': 'Consulta',
      'Agendo turno': 'No', 'Fecha del turno': '' } });
  });
  assert.ok(g.MockGAS.lockLibre(), 'libera el lock aunque falle');
});

prueba('un campo nuevo en Config crea su columna al guardar', function () {
  var g = entorno();
  var ss = g.Semilla.crear();
  g.configurarPlanilla();
  var config = ss.getSheetByName('Config');
  config.getRange(11, 1, 1, 2).setValues([['Obra social', 'texto']]);
  var d = g.obtenerDatos();
  assert.ok(d.avisos.some(function (a) { return /Obra social/.test(a); }));
  g.guardarLead({ id: '', valores: { 'Fecha': '2026-09-25', 'Nombre y Apellido': 'Y', 'Telefono': '2', 'Estado': 'Consulta',
    'Obra social': 'OSDE' } });
  var hoja = ss.getSheetByName('Leads');
  var enc = encabezados(hoja);
  assert.equal(enc[enc.length - 1], 'ID', 'ID sigue al final');
  assert.equal(enc[enc.length - 2], 'Obra social');
  assert.equal(hoja.getRange(3, enc.length - 1).getValue(), 'OSDE');
  assert.equal(g.obtenerDatos().avisos.length, 0);
});

prueba('un campo oculto en Config no se escribe', function () {
  var g = entorno();
  var ss = g.Semilla.crear();
  g.configurarPlanilla();
  ss.getSheetByName('Config').getRange(9, 8).setValue(true); // Ocultar Origen
  var cfg = g.leerConfig_();
  assert.equal(cfg.campos[7].nombre, 'Origen');
  assert.equal(cfg.campos[7].activo, false);
  var lead = g.guardarLead({ id: '', valores: { 'Fecha': '2026-09-25', 'Nombre y Apellido': 'Z', 'Telefono': '3', 'Estado': 'Consulta',
    'Origen': 'Google' } });
  assert.equal(ss.getSheetByName('Leads').getRange(lead.fila, 9).getValue(), '');
});

prueba('actualizar un ID que no existe da un error claro', function () {
  var g = entorno();
  g.Semilla.crear();
  g.configurarPlanilla();
  assert.throws(function () { g.guardarLead({ id: 'noexiste', valores: { 'Estado': 'Consulta' } }); }, /No encontré ese lead/);
});

prueba('configurarPlanilla no abre cuadros de diálogo (desde el editor se colgaría)', function () {
  var g = entorno();
  g.Semilla.crear();
  g.configurarPlanilla();
  assert.equal(g.MockGAS.alertas.length, 0);
  g.configurarPlanillaDesdeMenu();
  assert.equal(g.MockGAS.alertas.length, 1, 'desde el menú sí muestra el resultado');
});

prueba('acciones por estado: se leen de Config y se proponen al crearla', function () {
  var g = entorno();
  var ss = g.Semilla.crear({ conDesplegableEstado: false });
  g.configurarPlanilla();
  assert.deepEqual(plano(g.leerConfig_().ajustes.acciones), [{ estado: 'No asistió', accion: 'Recontactar' }]);
  // Una Config vieja no tiene la fila: se agrega a mano debajo de los otros ajustes.
  var config = ss.getSheetByName('Config');
  var filas = config.getRange(1, 10, 20, 1).getValues().map(function (f) { return f[0]; });
  var fila = filas.indexOf('Acciones por estado') + 1;
  config.getRange(fila, 10, 1, 2).setValues([['', '']]);
  assert.deepEqual(plano(g.leerConfig_().ajustes.acciones), []);
  config.getRange(20, 10, 1, 2).setValues([['acciones por estado', 'No asistió: Recontactar, Nuevo = Llamar, basura']]);
  assert.deepEqual(plano(g.leerConfig_().ajustes.acciones), [
    { estado: 'No asistió', accion: 'Recontactar' }, { estado: 'Nuevo', accion: 'Llamar' }]);
});

prueba('sin hoja Config el error explica qué hacer', function () {
  var g = entorno();
  g.Semilla.crear();
  assert.throws(function () { g.obtenerDatos(); }, /Configurar/);
  assert.equal(g.doGet().titulo, 'Seguimiento de Leads');
});

var fallas = 0;
pruebas.forEach(function (p) {
  try {
    p[1]();
    console.log('  ok  ' + p[0]);
  } catch (e) {
    fallas++;
    console.log('  MAL ' + p[0] + '\n      ' + (e.stack || e).toString().split('\n').slice(0, 4).join('\n      '));
  }
});
console.log('\n' + (pruebas.length - fallas) + '/' + pruebas.length + ' pruebas OK');
process.exit(fallas ? 1 : 0);

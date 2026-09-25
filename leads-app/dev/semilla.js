/*
 * Arma una planilla de prueba con la misma forma que "Fecundart - Seguimiento de Leads"
 * (hoja Leads con 8 columnas y desplegables, hoja Resumen) y, opcionalmente, leads de demo.
 */
(function (global) {
  'use strict';

  var ENCABEZADOS = ['Fecha', 'Nombre y Apellido', 'Telefono', 'Motivo de consulta', 'Agendo turno',
    'Fecha del turno', 'Estado', 'Comentarios'];
  var ESTADOS = ['Consulta', 'Turno agendado', 'Turno realizado', 'No se presento', 'Descartado'];

  function crear(opciones) {
    opciones = opciones || {};
    var ss = MockGAS.nuevaPlanilla();
    var leads = ss.insertSheet('Leads');
    leads.maxFilas = 506;
    ss.insertSheet('Resumen').getRange(1, 1, 1, 5)
      .setValues([['Mes', 'Leads totales', 'Turnos agendados', 'Turnos realizados', '% conversion a turno']]);

    leads.getRange(1, 1, 1, 8).setValues([ENCABEZADOS]);
    leads.getRange(2, 5, 505, 1).setDataValidation(new MockGAS.Validacion('VALUE_IN_LIST', [['Si', 'No'], true]));
    if (opciones.conDesplegableEstado !== false) {
      leads.getRange(2, 7, 505, 1).setDataValidation(new MockGAS.Validacion('VALUE_IN_LIST', [ESTADOS, true]));
    }
    leads.getRange(2, 1, 1, 8).setValues([[new Date(2026, 8, 3), 'Maria Gomez (EJEMPLO)', '351 555 1234',
      'Control ginecologico', 'Si', new Date(2026, 8, 10), 'Turno agendado', 'Pidio turno por la tarde']]);

    if (opciones.demo) cargarDemo(leads, opciones.demo, opciones.hoy || new Date());
    return ss;
  }

  // Generador pseudoaleatorio fijo para que la demo sea siempre igual.
  function azar(semilla) {
    var s = semilla;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  function cargarDemo(hoja, n, hoy) {
    var r = azar(42);
    var nombres = ['Lucía', 'Sofía', 'Valentina', 'Camila', 'Martina', 'Julieta', 'Florencia', 'Agustina',
      'Paula', 'Carolina', 'Micaela', 'Rocío', 'Belén', 'Natalia', 'Romina', 'Daniela'];
    var apellidos = ['Pérez', 'González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Sosa', 'Romero',
      'Díaz', 'Álvarez', 'Torres', 'Ruiz', 'Castro', 'Moreno', 'Ortiz', 'Silva'];
    var motivos = ['Control ginecologico', 'Control ginecologico', 'Fertilidad', 'Fertilidad', 'Fertilidad',
      'Embarazo', 'Consulta general'];
    var comentarios = ['', '', '', 'Pidió turno por la mañana', 'Consulta por obra social', 'Llamar después de las 18',
      'Vino por recomendación de una paciente'];
    var filas = [];
    for (var i = 0; i < n; i++) {
      var diasAtras = Math.floor(Math.pow(r(), 1.3) * 300);
      var f = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - diasAtras);
      var x = r();
      var reciente = diasAtras < 12;
      var estado = reciente
        ? (x < 0.45 ? 'Consulta' : x < 0.85 ? 'Turno agendado' : 'Descartado')
        : (x < 0.18 ? 'Consulta' : x < 0.3 ? 'Turno agendado' : x < 0.62 ? 'Turno realizado' : x < 0.75 ? 'No se presento' : 'Descartado');
      var agendo = /agendado|realizado|presento/.test(estado) ? 'Si' : 'No';
      var turno = agendo === 'Si' ? new Date(f.getFullYear(), f.getMonth(), f.getDate() + 3 + Math.floor(r() * 12)) : '';
      filas.push([f, nombres[Math.floor(r() * nombres.length)] + ' ' + apellidos[Math.floor(r() * apellidos.length)],
        '351 ' + (400 + Math.floor(r() * 500)) + ' ' + (1000 + Math.floor(r() * 9000)),
        motivos[Math.floor(r() * motivos.length)], agendo, turno, estado, comentarios[Math.floor(r() * comentarios.length)]]);
    }
    filas.sort(function (a, b) { return a[0] - b[0]; });
    hoja.getRange(3, 1, filas.length, 8).setValues(filas);
  }

  global.Semilla = { crear: crear, ENCABEZADOS: ENCABEZADOS, ESTADOS: ESTADOS };
})(typeof window !== 'undefined' ? window : globalThis);

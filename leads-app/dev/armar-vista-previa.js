/*
 * Genera dev/vista-previa.html: la app real (src/Index.html + src/Codigo.gs) corriendo en el
 * navegador contra una planilla simulada con leads de prueba. No toca ninguna planilla real.
 *   node dev/armar-vista-previa.js
 */
'use strict';
var fs = require('node:fs');
var path = require('node:path');

var leer = function (p) { return fs.readFileSync(path.join(__dirname, p), 'utf8'); };
var index = leer('../src/Index.html');

var arranque = function () {
  Semilla.crear({ demo: 150, hoy: new Date() });
  configurarPlanilla();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cfg = leerConfig_();
  ss.getSheetByName('Config').getRange(2, 11).setValue('Seguimiento de Leads · Demo');
  // Completa "Origen" en los leads de prueba.
  var hoja = ss.getSheetByName('Leads');
  var mapa = mapaColumnas_(hoja, 1);
  var col = mapa[norm_('Origen')];
  var origenes = ['Instagram', 'Instagram', 'Instagram', 'Facebook', 'Google', 'Google', 'WhatsApp', 'Recomendación'];
  for (var f = 3; f <= hoja.getLastRow(); f++) hoja.getRange(f, col).setValue(origenes[(f * 7) % origenes.length]);

  // google.script.run simulado: serializa como el real y responde con demora.
  var crear = function (ok, mal) {
    return new Proxy({}, {
      get: function (_, nombre) {
        if (nombre === 'withSuccessHandler') return function (fn) { return crear(fn, mal); };
        if (nombre === 'withFailureHandler') return function (fn) { return crear(ok, fn); };
        return function () {
          var args = JSON.parse(JSON.stringify(Array.prototype.slice.call(arguments)));
          setTimeout(function () {
            try {
              var r = window[nombre].apply(null, args);
              if (ok) ok(r === undefined ? null : JSON.parse(JSON.stringify(r)));
            } catch (e) {
              if (mal) mal(e); else console.error(e);
            }
          }, 350);
        };
      }
    });
  };
  window.google = { script: { run: crear(null, null) } };
  void cfg;
};

var cabecera = [
  '<script>' + leer('mock-gas.js') + '</script>',
  '<script>' + leer('semilla.js') + '</script>',
  '<script>' + leer('../src/Codigo.gs') + '</script>',
  '<script>(' + arranque.toString() + ')();</script>',
  '<style>.demo-banner{background:#2b2a27;color:#f3f2ee;font-size:12px;text-align:center;padding:6px 12px}</style>'
].join('\n');

var salida = index
  .replace('</head>', cabecera + '\n</head>')
  .replace('<body>', '<body>\n<div class="demo-banner">Vista previa con datos de prueba: lo que cargues acá no se guarda en ninguna planilla.</div>');
if (salida === index) throw new Error('No pude insertar la simulación en Index.html');
fs.writeFileSync(path.join(__dirname, 'vista-previa.html'), salida);
console.log('Listo: dev/vista-previa.html');

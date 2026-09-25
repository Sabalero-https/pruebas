/*
 * Simulación mínima de los servicios de Apps Script que usa Codigo.gs, sobre una
 * planilla en memoria. Sirve para los tests (Node) y para la vista previa (navegador).
 * Solo implementa lo que el código usa; un método real que falte acá falla a propósito.
 */
(function (global) {
  'use strict';

  function Validacion(tipo, valores) {
    this.tipo = tipo;
    this.valores = valores;
  }
  Validacion.prototype.getCriteriaType = function () { return this.tipo; };
  Validacion.prototype.getCriteriaValues = function () { return this.valores; };

  function Hoja(ss, nombre, filas, columnas) {
    this.ss = ss;
    this.nombre = nombre;
    this.maxFilas = filas || 1000;
    this.maxCols = columnas || 26;
    this.celdas = {}; // "f,c" -> valor
    this.validaciones = {};
    this.formatos = {};
    this.ocultas = {};
  }
  Hoja.prototype.getName = function () { return this.nombre; };
  Hoja.prototype.getParent = function () { return this.ss; };
  Hoja.prototype.getMaxRows = function () { return this.maxFilas; };
  Hoja.prototype.getMaxColumns = function () { return this.maxCols; };
  Hoja.prototype._get = function (f, c) {
    var v = this.celdas[f + ',' + c];
    return v === undefined ? '' : v;
  };
  Hoja.prototype._set = function (f, c, v) {
    if (f > this.maxFilas || c > this.maxCols) throw new Error('Fuera de la grilla: ' + f + ',' + c);
    if (v === '' || v === null || v === undefined) delete this.celdas[f + ',' + c];
    else this.celdas[f + ',' + c] = v;
  };
  Hoja.prototype.getLastRow = function () {
    var m = 0;
    Object.keys(this.celdas).forEach(function (k) { m = Math.max(m, Number(k.split(',')[0])); });
    return m;
  };
  Hoja.prototype.getLastColumn = function () {
    var m = 0;
    Object.keys(this.celdas).forEach(function (k) { m = Math.max(m, Number(k.split(',')[1])); });
    return m;
  };
  Hoja.prototype.getRange = function (f, c, nf, nc) {
    if (typeof f !== 'number' || f < 1 || c < 1) throw new Error('getRange: argumentos inválidos');
    return new Rango(this, f, c, nf || 1, nc || 1);
  };
  Hoja.prototype.getDataRange = function () {
    return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn()));
  };
  Hoja.prototype._desplazarColumnas = function (desde) {
    var nuevas = {};
    var self = this;
    ['celdas', 'validaciones', 'formatos'].forEach(function (prop) {
      var mapa = {};
      Object.keys(self[prop]).forEach(function (k) {
        var p = k.split(',').map(Number);
        mapa[p[0] + ',' + (p[1] >= desde ? p[1] + 1 : p[1])] = self[prop][k];
      });
      nuevas[prop] = mapa;
    });
    Object.keys(nuevas).forEach(function (p) { self[p] = nuevas[p]; });
    var oc = {};
    Object.keys(this.ocultas).forEach(function (c) { oc[Number(c) >= desde ? Number(c) + 1 : c] = true; });
    this.ocultas = oc;
    this.maxCols++;
  };
  Hoja.prototype.insertColumnBefore = function (c) { this._desplazarColumnas(c); return this; };
  Hoja.prototype.insertColumnAfter = function (c) { this._desplazarColumnas(c + 1); return this; };
  Hoja.prototype.insertRowsAfter = function (f, n) { this.maxFilas += n; return this; };
  Hoja.prototype.hideColumns = function (c) { this.ocultas[c] = true; };
  Hoja.prototype.setFrozenRows = function () { return this; };
  Hoja.prototype.setColumnWidth = function () { return this; };
  Hoja.prototype.setTabColor = function () { return this; };

  function Rango(hoja, f, c, nf, nc) {
    this.hoja = hoja; this.f = f; this.c = c; this.nf = nf; this.nc = nc;
  }
  Rango.prototype._cada = function (fn) {
    for (var i = 0; i < this.nf; i++) for (var j = 0; j < this.nc; j++) fn(this.f + i, this.c + j, i, j);
    return this;
  };
  Rango.prototype.getValues = function () {
    var out = [];
    for (var i = 0; i < this.nf; i++) {
      var fila = [];
      for (var j = 0; j < this.nc; j++) {
        var v = this.hoja._get(this.f + i, this.c + j);
        fila.push(v instanceof Date ? new Date(v.getTime()) : v);
      }
      out.push(fila);
    }
    return out;
  };
  Rango.prototype.getValue = function () { return this.getValues()[0][0]; };
  Rango.prototype.setValues = function (vals) {
    if (vals.length !== this.nf || vals.some(function (f) { return f.length !== this.nc; }, this)) {
      throw new Error('setValues: las dimensiones no coinciden con el rango');
    }
    var h = this.hoja;
    return this._cada(function (f, c, i, j) { h._set(f, c, vals[i][j]); });
  };
  Rango.prototype.setValue = function (v) {
    var h = this.hoja;
    return this._cada(function (f, c) {
      // Como Sheets: con formato texto plano el valor queda como string.
      if (h.formatos[f + ',' + c] === '@' && typeof v === 'string') { h._set(f, c, v); return; }
      h._set(f, c, v);
    });
  };
  Rango.prototype.setNumberFormat = function (fmt) {
    var h = this.hoja;
    return this._cada(function (f, c) { h.formatos[f + ',' + c] = fmt; });
  };
  Rango.prototype.getDataValidation = function () {
    return this.hoja.validaciones[this.f + ',' + this.c] || null;
  };
  Rango.prototype.setDataValidation = function (dv) {
    var h = this.hoja;
    return this._cada(function (f, c) { h.validaciones[f + ',' + c] = dv; });
  };
  Rango.prototype.insertCheckboxes = function () {
    var h = this.hoja;
    return this._cada(function (f, c) {
      h.validaciones[f + ',' + c] = new Validacion('CHECKBOX', []);
      h._set(f, c, false);
    });
  };
  Rango.prototype.copyFormatToRange = function (hoja, c1, c2, f1, f2) {
    if (!(hoja instanceof Hoja) || [c1, c2, f1, f2].some(function (n) { return typeof n !== 'number'; })) {
      throw new Error('copyFormatToRange: argumentos inválidos');
    }
    return this;
  };
  ['setFontWeight', 'setBackground', 'setFontColor', 'setWrap', 'setNote', 'setHorizontalAlignment']
    .forEach(function (m) { Rango.prototype[m] = function () { return this; }; });

  function Planilla(tz) {
    this.hojas = [];
    this.tz = tz || 'America/Argentina/Cordoba';
  }
  Planilla.prototype.getSheetByName = function (n) {
    return this.hojas.filter(function (h) { return h.nombre === n; })[0] || null;
  };
  Planilla.prototype.getSheets = function () { return this.hojas.slice(); };
  Planilla.prototype.insertSheet = function (n) {
    if (this.getSheetByName(n)) throw new Error('Ya existe una hoja llamada ' + n);
    var h = new Hoja(this, n);
    this.hojas.push(h);
    return h;
  };
  Planilla.prototype.getSpreadsheetTimeZone = function () { return this.tz; };

  var activa = new Planilla();
  var alertas = [];

  function Constructor() { this.lista = null; }
  Constructor.prototype.requireValueInList = function (l) { this.lista = l.slice(); return this; };
  Constructor.prototype.setAllowInvalid = function () { return this; };
  Constructor.prototype.build = function () { return new Validacion('VALUE_IN_LIST', [this.lista, true]); };

  var ui = {
    ButtonSet: { OK: 'OK' },
    alert: function (titulo, msg) { alertas.push({ titulo: titulo, msg: msg }); },
    createMenu: function () {
      var menu = { addItem: function () { return menu; }, addToUi: function () {} };
      return menu;
    }
  };

  global.SpreadsheetApp = {
    DataValidationCriteria: { VALUE_IN_LIST: 'VALUE_IN_LIST', VALUE_IN_RANGE: 'VALUE_IN_RANGE', CHECKBOX: 'CHECKBOX' },
    getActiveSpreadsheet: function () { return activa; },
    newDataValidation: function () { return new Constructor(); },
    getUi: function () { return ui; },
    flush: function () {}
  };

  function dos(n) { return (n < 10 ? '0' : '') + n; }
  global.Utilities = {
    // Asume que el reloj local está en la zona de la planilla (los tests usan TZ=America/Argentina/Cordoba).
    formatDate: function (d, tz, fmt) {
      if (fmt !== 'yyyy-MM-dd') throw new Error('formato no soportado en el mock: ' + fmt);
      return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
    },
    getUuid: function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (ch) {
        var r = Math.random() * 16 | 0;
        return (ch === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }
  };
  var bloqueado = false;
  global.LockService = {
    getScriptLock: function () {
      return {
        waitLock: function () { if (bloqueado) throw new Error('lock ya tomado'); bloqueado = true; },
        releaseLock: function () { bloqueado = false; }
      };
    }
  };
  global.Session = { getActiveUser: function () { return { getEmail: function () { return 'secretaria@ejemplo.com'; } }; } };
  global.ScriptApp = { getService: function () { return { getUrl: function () { return ''; } }; } };
  global.Logger = { log: function () {} };
  global.HtmlService = {
    createHtmlOutputFromFile: function () {
      var o = { setTitle: function (t) { o.titulo = t; return o; }, addMetaTag: function () { return o; } };
      return o;
    }
  };

  global.MockGAS = {
    Planilla: Planilla,
    Validacion: Validacion,
    alertas: alertas,
    nuevaPlanilla: function (tz) { activa = new Planilla(tz); alertas.length = 0; return activa; },
    planilla: function () { return activa; },
    lockLibre: function () { return !bloqueado; }
  };
})(typeof window !== 'undefined' ? window : globalThis);

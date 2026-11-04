/*
  Yi Shu Studio - Manager de la tienda (Google Apps Script) - versión 4

  Novedades de la versión 4: pestaña "Fichas" (horas, gramos y componentes de cada producto), precio de la luz,
  datos de cada impresora para calcular su costo por hora y lista de componentes (luces, conectores, switches).
  La pestaña "Fichas" se crea sola la primera vez que la app se conecta. Tus pedidos y gastos no se tocan.

  SI YA TIENES EL SCRIPT DE PEDIDOS FUNCIONANDO (el que ya está conectado a la app)
  No crees un proyecto nuevo: un proyecto nuevo tendría otra URL y habría que reconectar todo.
  1. Abre el mismo Apps Script que ya usas (el de la hoja del tracker), borra todo el código y pega este.
  2. Vuelve a escribir tu CLAVE abajo. Tiene que ser LA MISMA que ya tienes en la app (Ajustes);
     si pones otra, la app deja de conectar.
  3. Arriba elige la función "autorizarPermisos" y toca Ejecutar. Acepta los permisos nuevos.
     (Si ves "Google no ha verificado esta aplicación": Avanzado > Ir a tu proyecto. Es tu propio script.)
  4. Implementar > Administrar implementaciones > lápiz > Versión: Nueva versión > Implementar.
     La URL se mantiene igual y tus pedidos no se tocan: solo se agregan columnas al final.

  PRIMERA INSTALACIÓN (solo si nunca has conectado la app a una hoja)
  1. Abre script.google.com con la MISMA cuenta de Google dueña de la hoja y toca "Nuevo proyecto".
  2. Borra lo que haya en el editor y pega todo este código.
  3. Cambia la CLAVE de abajo por una frase tuya (de 16 letras o más, mejor). La misma la pegas en la app.
  4. Arriba elige la función "autorizarPermisos" y toca Ejecutar. Acepta todos los permisos.
  5. Implementar > Nueva implementación > tipo "Aplicación web".
     Ejecutar como: Yo. Quién tiene acceso: Cualquier persona. Toca Implementar.
  6. Copia la URL que termina en /exec y pégala en la app (ícono de ajustes) junto con la clave.

  Zona horaria: en Configuración del proyecto (rueda dentada) deja la zona horaria en
  "(GMT-05:00) Bogotá" para que las entregas del calendario caigan en el día correcto.
*/

const VERSION = 4;
const CLAVE = 'CAMBIA-ESTA-CLAVE';
const NOMBRE_HOJA = 'Pedidos';
const NOMBRE_GASTOS = 'Gastos';
const NOMBRE_FICHAS = 'Fichas';
const NOMBRE_CONFIG = 'Config';
const NOMBRE_CALENDARIO = 'Entregas Yi Shu';
const NOMBRE_CARPETA_RESPALDO = 'Respaldos Yi Shu';
const PREFIJO_RESPALDO = 'Respaldo Yi Shu ';
const PREFIJO_ID = 'YS-';
const PREFIJO_GASTO = 'G-';
const PREFIJO_FICHA = 'F-';
const RESPALDOS_A_CONSERVAR = 8;
const MAX_FICHAS = 400;

// ID de tu hoja de Google (la parte larga de su dirección, entre /d/ y /edit).
// Pégalo entre las comillas. Déjalo vacío solo si el script lo creaste desde Extensiones > Apps Script dentro de la hoja.
const ID_HOJA = '';

const CAMPOS = [
  { k: 'id',           h: 'ID' },
  { k: 'fecha',        h: 'Fecha del pedido' },
  { k: 'cliente',      h: 'Cliente' },
  { k: 'contacto',     h: 'WhatsApp / teléfono' },
  { k: 'canal',        h: 'Por dónde se contactó' },
  { k: 'producto',     h: 'Producto' },
  { k: 'cantidad',     h: 'Cantidad' },
  { k: 'detalles',     h: 'Detalles (color, tamaño, personalización)' },
  { k: 'total',        h: 'Valor total' },
  { k: 'pago',         h: 'Pagó' },
  { k: 'debe',         h: 'Debe' },
  { k: 'estadoPago',   h: 'Estado del pago' },
  { k: 'metodoPago',   h: 'Método de pago' },
  { k: 'entregaFecha', h: 'Fecha de entrega' },
  { k: 'entregaTipo',  h: 'Envío o recogida' },
  { k: 'entregaVia',   h: 'Transportadora / punto de entrega' },
  { k: 'direccion',    h: 'Dirección y ciudad' },
  { k: 'estado',       h: 'Estado del pedido' },
  { k: 'notas',        h: 'Notas' },
  { k: 'registrado',   h: 'Registrado el' },
  { k: 'ref',          h: 'Ref (uso interno)' },
  // Desde la versión 3 (van al final para no mover nada de lo que ya tenías):
  { k: 'impresora',    h: 'Impresora' },
  { k: 'horas',        h: 'Horas de impresión' },
  { k: 'gramos',       h: 'Gramos de filamento' },
  { k: 'empaque',      h: 'Empaque ($)' },
  { k: 'envioNegocio', h: 'Envío que pagó el negocio ($)' },
  { k: 'otros',        h: 'Otros costos ($)' },
  { k: 'costoTotal',   h: 'Costo total ($)' },
  { k: 'ganancia',     h: 'Ganancia ($)' },
  { k: 'eventoId',     h: 'Calendario (uso interno)' }
];

const COL = {};
CAMPOS.forEach(function (c, i) { COL[c.k] = i + 1; });
const COLUMNAS_V2 = COL.ref;

const ESTADOS = ['Recibido', 'En producción', 'Listo para entrega', 'Enviado', 'Entregado', 'Cancelado'];
const CAMPOS_COSTO = ['impresora', 'horas', 'gramos', 'empaque', 'envioNegocio', 'otros'];
const NUMEROS_OPCIONALES = ['horas', 'gramos', 'empaque', 'envioNegocio', 'otros', 'costoTotal', 'ganancia'];

const CAMPOS_GASTO = [
  { k: 'id',         h: 'ID' },
  { k: 'fecha',      h: 'Fecha' },
  { k: 'concepto',   h: 'Concepto' },
  { k: 'categoria',  h: 'Categoría' },
  { k: 'monto',      h: 'Monto' },
  { k: 'metodo',     h: 'Método de pago' },
  { k: 'notas',      h: 'Notas' },
  { k: 'registrado', h: 'Registrado el' },
  { k: 'ref',        h: 'Ref (uso interno)' }
];
const COLG = {};
CAMPOS_GASTO.forEach(function (c, i) { COLG[c.k] = i + 1; });

// Una ficha guarda lo que lleva UNA unidad de un producto: horas, gramos y componentes.
// "Componentes (uso interno)" guarda la lista completa; "Componentes" es solo para leerla en la hoja.
const CAMPOS_FICHA = [
  { k: 'id',             h: 'ID' },
  { k: 'nombre',         h: 'Producto' },
  { k: 'categoria',      h: 'Categoría' },
  { k: 'impresora',      h: 'Impresora' },
  { k: 'horas',          h: 'Horas por unidad' },
  { k: 'gramos',         h: 'Gramos por unidad' },
  { k: 'componentesTxt', h: 'Componentes' },
  { k: 'notas',          h: 'Notas' },
  { k: 'catalogoId',     h: 'ID en el catálogo' },
  { k: 'actualizado',    h: 'Actualizado' },
  { k: 'componentes',    h: 'Componentes (uso interno)' }
];
const COLF = {};
CAMPOS_FICHA.forEach(function (c, i) { COLF[c.k] = i + 1; });

// Ajustes compartidos (los guarda la pestaña "Config"). Los costos arrancan en 0 a propósito:
// los llena Lorena en la app, aquí no se inventa ningún precio.
const CONFIG_BASE = {
  impresoras: [
    { nombre: 'Flashforge Creator 5', costoHora: 0 },
    { nombre: 'Bambu Lab P1S', costoHora: 0 }
  ],
  costoGramo: 0,
  luzKwh: 0,
  empaque: 0,
  componentes: [],
  listas: {},
  gastoCategorias: ['Filamento', 'Empaques', 'Envíos', 'Publicidad', 'Repuestos y mantenimiento',
    'Electricidad', 'Equipos y herramientas', 'Componentes electrónicos', 'Otros'],
  calendario: false,
  resumen: false,
  resumenHora: 7,
  resumenEmail: '',
  respaldo: false
};
const CONFIG_EDITABLE = ['impresoras', 'costoGramo', 'luzKwh', 'empaque', 'componentes', 'listas', 'gastoCategorias'];

/* Puntos de entrada */

function doGet() {
  return ContentService.createTextOutput('Yi Shu Studio: el servicio de pedidos está activo.');
}

function doPost(e) {
  var respuesta;
  try {
    if (CLAVE === 'CAMBIA-ESTA-CLAVE') {
      throw new Error('Falta cambiar la CLAVE dentro del script de Apps Script.');
    }
    var req;
    try {
      req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (errJson) {
      throw new Error('La solicitud llegó dañada. Intenta de nuevo.');
    }
    if (!req || typeof req !== 'object' || !iguales_(req.clave, CLAVE)) {
      throw new Error('La clave no coincide. Revisa que sea la misma en la app y en el script.');
    }
    var lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      respuesta = despachar_(req);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    respuesta = { ok: false, error: mensajeError_(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(respuesta))
    .setMimeType(ContentService.MimeType.JSON);
}

function despachar_(req) {
  var sh, cfg;
  switch (req.accion) {
    case 'ping':
      sh = hoja_();
      return { ok: true, version: VERSION, hoja: NOMBRE_HOJA, pedidos: Math.max(sh.getLastRow() - 1, 0) };
    case 'sincronizar':
      sh = hoja_();
      return {
        ok: true, version: VERSION, ahora: iso_(ahora_(), zona_(sh), true), zona: zona_(sh),
        pedidos: leerPedidos_(sh), gastos: leerGastos_(gastosHoja_()), fichas: leerFichas_(fichasHoja_()), config: leerConfig_()
      };
    case 'listar':
      return { ok: true, pedidos: leerPedidos_(hoja_()) };
    case 'crear':
      return { ok: true, pedido: crearPedido_(hoja_(), req.pedido || {}) };
    case 'actualizar':
      return { ok: true, pedido: actualizarPedido_(hoja_(), req) };
    case 'pagar':
      return { ok: true, pedido: registrarPago_(hoja_(), req) };
    case 'config_guardar':
      return { ok: true, config: guardarConfig_(req.config || {}) };
    case 'costos_recalcular':
      return recalcularCostos_(hoja_());
    case 'gasto_crear':
      return { ok: true, gasto: crearGasto_(gastosHoja_(), req.gasto || {}) };
    case 'gasto_actualizar':
      return { ok: true, gasto: actualizarGasto_(gastosHoja_(), req) };
    case 'gasto_eliminar':
      return eliminarGasto_(gastosHoja_(), req);
    case 'ficha_guardar':
      return { ok: true, ficha: guardarFicha_(fichasHoja_(), req.ficha || {}) };
    case 'ficha_eliminar':
      return eliminarFicha_(fichasHoja_(), req);
    case 'automatizaciones_estado':
      return { ok: true, estado: estadoAutomatizaciones_(leerConfig_()) };
    case 'automatizaciones_activar':
      return activarAutomatizaciones_(req.ajustes || {});
    case 'calendario_sincronizar':
      sh = hoja_();
      cfg = leerConfig_();
      if (!cfg.calendario) throw new Error('El calendario de Google está apagado. Actívalo primero en Ajustes.');
      return sincronizarCalendario_(sh);
    case 'resumen_probar':
      return enviarResumen_(leerConfig_(), true);
    case 'respaldo_ahora':
      var copia;
      registrarEjecucion_('ultimoRespaldo', function () { copia = respaldar_(); return copia; });
      return { ok: true, respaldo: copia };
    default:
      throw new Error('Acción desconocida: ' + req.accion);
  }
}

/* Funciones para ejecutar a mano desde el editor */

function configurarHoja() {
  var sh = hoja_();
  gastosHoja_();
  fichasHoja_();
  configHoja_();
  SpreadsheetApp.flush();
  Logger.log('Pestañas "' + sh.getName() + '", "' + NOMBRE_GASTOS + '", "' + NOMBRE_FICHAS + '" y "' + NOMBRE_CONFIG + '" listas.');
}

// Toca todos los servicios que usa el manager para que Google pida los permisos de una vez.
function autorizarPermisos() {
  configurarHoja();
  CalendarApp.getDefaultCalendar();
  MailApp.getRemainingDailyQuota();
  DriveApp.getRootFolder();
  ScriptApp.getProjectTriggers();
  PropertiesService.getScriptProperties().getKeys();
  Session.getEffectiveUser().getEmail();
  Logger.log('Permisos listos. Ahora crea una nueva versión de la implementación.');
}

/* Se ejecutan solas cuando se activan en Ajustes */

function resumenDiario() {
  conCandado_(function () {
    var cfg = leerConfig_();
    if (!cfg.resumen) return;
    registrarEjecucion_('ultimoResumen', function () { return enviarResumen_(cfg, false); });
  });
}

function respaldoSemanal() {
  conCandado_(function () {
    var cfg = leerConfig_();
    if (!cfg.respaldo) return;
    registrarEjecucion_('ultimoRespaldo', function () { return respaldar_(); });
  });
}

function conCandado_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { fn(); } finally { lock.releaseLock(); }
}

function registrarEjecucion_(clave, fn) {
  var props = PropertiesService.getScriptProperties();
  var tz = zonaLibro_();
  try {
    var r = fn();
    props.setProperty(clave, JSON.stringify({ fecha: iso_(ahora_(), tz, true), ok: true,
      msg: (r && r.enviado === false) ? (r.motivo || '') : '' }));
  } catch (err) {
    props.setProperty(clave, JSON.stringify({ fecha: iso_(ahora_(), tz, true), ok: false, msg: mensajeError_(err) }));
    throw err;
  }
}

/* Hojas */

function libro_() {
  return ID_HOJA ? SpreadsheetApp.openById(ID_HOJA) : SpreadsheetApp.getActiveSpreadsheet();
}

function zonaLibro_() {
  return libro_().getSpreadsheetTimeZone();
}

function zona_(sh) {
  return sh.getParent().getSpreadsheetTimeZone();
}

function ahora_() {
  return new Date();
}

function hoja_() {
  var ss = libro_();
  var sh = ss.getSheetByName(NOMBRE_HOJA);
  if (!sh) {
    var hojas = ss.getSheets();
    var vacia = hojas.length === 1 && hojas[0].getLastRow() === 0 && hojas[0].getLastColumn() === 0;
    sh = vacia ? hojas[0].setName(NOMBRE_HOJA) : ss.insertSheet(NOMBRE_HOJA);
  }
  if (sh.getLastRow() === 0) {
    prepararHoja_(sh);
    return sh;
  }
  var leer = Math.min(CAMPOS.length, sh.getMaxColumns());
  var enc = sh.getRange(1, 1, 1, leer).getValues()[0];
  while (enc.length < CAMPOS.length) enc.push('');
  if (enc[0] !== CAMPOS[0].h || enc[COL.ref - 1] !== CAMPOS[COL.ref - 1].h) {
    throw new Error('La pestaña "' + NOMBRE_HOJA + '" ya tiene otras columnas. Usa una pestaña nueva o cambia NOMBRE_HOJA.');
  }
  var primeraNueva = enc[COL.impresora - 1];
  var ultimaNueva = enc[COL.eventoId - 1];
  if (primeraNueva === '' && ultimaNueva === '') {
    migrarV3_(sh);
  } else if (primeraNueva !== CAMPOS[COL.impresora - 1].h || ultimaNueva !== CAMPOS[COL.eventoId - 1].h) {
    throw new Error('Las columnas nuevas de la pestaña "' + NOMBRE_HOJA + '" no coinciden con las que espera el script.');
  }
  return sh;
}

function letra_(k) {
  var n = typeof k === 'number' ? k : COL[k];
  var s = '';
  while (n > 0) {
    var r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function asegurarColumnas_(sh, n) {
  var max = sh.getMaxColumns();
  if (max < n) sh.insertColumnsAfter(max, n - max);
}

function estiloEncabezado_(rango) {
  rango.setFontWeight('bold').setFontColor('#ffffff').setBackground('#111111').setWrap(true).setVerticalAlignment('middle');
}

function formulaGanancia_(f) {
  return '=IF(' + letra_('costoTotal') + f + '>0,' + letra_('total') + f + '-' + letra_('costoTotal') + f + ',"")';
}

function formatosCostos_(sh, filas) {
  ['empaque', 'envioNegocio', 'otros', 'costoTotal', 'ganancia'].forEach(function (k) {
    sh.getRange(2, COL[k], filas, 1).setNumberFormat('$ #,##0');
  });
  sh.getRange(2, COL.horas, filas, 1).setNumberFormat('0.0#');
  sh.getRange(2, COL.gramos, filas, 1).setNumberFormat('#,##0.#');
}

function prepararHoja_(sh) {
  var n = CAMPOS.length;
  asegurarColumnas_(sh, n);
  estiloEncabezado_(sh.getRange(1, 1, 1, n).setValues([CAMPOS.map(function (c) { return c.h; })]));
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 48);

  var filas = Math.max(sh.getMaxRows() - 1, 1);
  sh.getRange(2, COL.fecha, filas, 1).setNumberFormat('dd/mm/yyyy');
  sh.getRange(2, COL.entregaFecha, filas, 1).setNumberFormat('dd/mm/yyyy');
  sh.getRange(2, COL.registrado, filas, 1).setNumberFormat('dd/mm/yyyy hh:mm');
  ['total', 'pago', 'debe'].forEach(function (k) {
    sh.getRange(2, COL[k], filas, 1).setNumberFormat('$ #,##0');
  });
  formatosCostos_(sh, filas);

  var anchos = { id: 80, fecha: 105, cliente: 170, contacto: 140, canal: 140, producto: 190, cantidad: 80,
    detalles: 240, total: 110, pago: 110, debe: 110, estadoPago: 110, metodoPago: 130, entregaFecha: 115,
    entregaTipo: 120, entregaVia: 190, direccion: 240, estado: 150, notas: 240, registrado: 140,
    impresora: 150, horas: 95, gramos: 95, empaque: 100, envioNegocio: 120, otros: 100, costoTotal: 110, ganancia: 110 };
  Object.keys(anchos).forEach(function (k) { sh.setColumnWidth(COL[k], anchos[k]); });

  sh.getRange(2, COL.estado, filas, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).setAllowInvalid(false).build()
  );

  var regla = function (rango, texto, fondo, letraColor) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(texto).setBackground(fondo).setFontColor(letraColor).setRanges([rango]).build();
  };
  var rPago = sh.getRange(2, COL.estadoPago, filas, 1);
  var rEstado = sh.getRange(2, COL.estado, filas, 1);
  sh.setConditionalFormatRules([
    regla(rPago, 'Pagado', '#d9f5e5', '#0b5a33'),
    regla(rPago, 'Abonó', '#fff0d1', '#7a4b00'),
    regla(rPago, 'Sin pago', '#ffe0e0', '#8a1111'),
    regla(rEstado, 'En producción', '#dce9ff', '#0b3d91'),
    regla(rEstado, 'Listo para entrega', '#efe0ff', '#4a1d8a'),
    regla(rEstado, 'Entregado', '#d9f5e5', '#0b5a33'),
    regla(rEstado, 'Cancelado', '#e6e6e6', '#555555')
  ]);

  sh.hideColumns(COL.ref);
  sh.hideColumns(COL.eventoId);
  if (!sh.getFilter()) {
    sh.getRange(1, 1, sh.getMaxRows(), n).createFilter();
  }
}

// Agrega las columnas nuevas al final de una hoja de la versión 2 sin tocar ningún dato.
function migrarV3_(sh) {
  var n = CAMPOS.length;
  asegurarColumnas_(sh, n);
  var nuevas = CAMPOS.slice(COLUMNAS_V2);
  estiloEncabezado_(sh.getRange(1, COLUMNAS_V2 + 1, 1, nuevas.length)
    .setValues([nuevas.map(function (c) { return c.h; })]));

  var filas = Math.max(sh.getMaxRows() - 1, 1);
  formatosCostos_(sh, filas);
  var anchos = { impresora: 150, horas: 95, gramos: 95, empaque: 100, envioNegocio: 120, otros: 100, costoTotal: 110, ganancia: 110 };
  Object.keys(anchos).forEach(function (k) { sh.setColumnWidth(COL[k], anchos[k]); });

  var ultima = sh.getLastRow();
  if (ultima > 1) {
    var ids = sh.getRange(2, COL.id, ultima - 1, 1).getValues();
    var formulas = ids.map(function (r, i) {
      return [r[0] !== '' && r[0] !== null ? formulaGanancia_(i + 2) : ''];
    });
    sh.getRange(2, COL.ganancia, ultima - 1, 1).setValues(formulas);
  }

  sh.hideColumns(COL.eventoId);
  var filtro = sh.getFilter();
  if (filtro) filtro.remove();
  sh.getRange(1, 1, sh.getMaxRows(), n).createFilter();
  SpreadsheetApp.flush();
}

function gastosHoja_() {
  var ss = libro_();
  var sh = ss.getSheetByName(NOMBRE_GASTOS);
  if (!sh) sh = ss.insertSheet(NOMBRE_GASTOS);
  if (sh.getLastRow() === 0) {
    var n = CAMPOS_GASTO.length;
    asegurarColumnas_(sh, n);
    estiloEncabezado_(sh.getRange(1, 1, 1, n).setValues([CAMPOS_GASTO.map(function (c) { return c.h; })]));
    sh.setFrozenRows(1);
    sh.setRowHeight(1, 40);
    var filas = Math.max(sh.getMaxRows() - 1, 1);
    sh.getRange(2, COLG.fecha, filas, 1).setNumberFormat('dd/mm/yyyy');
    sh.getRange(2, COLG.monto, filas, 1).setNumberFormat('$ #,##0');
    sh.getRange(2, COLG.registrado, filas, 1).setNumberFormat('dd/mm/yyyy hh:mm');
    var anchos = { id: 80, fecha: 105, concepto: 230, categoria: 170, monto: 110, metodo: 130, notas: 260, registrado: 140 };
    Object.keys(anchos).forEach(function (k) { sh.setColumnWidth(COLG[k], anchos[k]); });
    sh.hideColumns(COLG.ref);
  } else {
    var enc = sh.getRange(1, 1, 1, Math.min(CAMPOS_GASTO.length, sh.getMaxColumns())).getValues()[0];
    if (enc[0] !== CAMPOS_GASTO[0].h || enc[COLG.ref - 1] !== CAMPOS_GASTO[COLG.ref - 1].h) {
      throw new Error('La pestaña "' + NOMBRE_GASTOS + '" ya existe con otras columnas. Renómbrala para que el manager pueda crear la suya.');
    }
  }
  return sh;
}

function configHoja_() {
  var ss = libro_();
  var sh = ss.getSheetByName(NOMBRE_CONFIG);
  if (!sh) {
    sh = ss.insertSheet(NOMBRE_CONFIG);
    estiloEncabezado_(sh.getRange(1, 1, 1, 3).setValues([['Ajuste', 'Valor', 'Actualizado']]));
    sh.getRange(1, 5).setValue('Esta pestaña guarda los ajustes de la app (costos, listas, automatizaciones). Cámbialos desde la app, no aquí.');
    sh.getRange(2, 2, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
    sh.setColumnWidth(1, 150);
    sh.setColumnWidth(2, 420);
    sh.setColumnWidth(3, 140);
    sh.setFrozenRows(1);
  }
  return sh;
}

/* Ajustes compartidos */

function clonar_(o) {
  return JSON.parse(JSON.stringify(o));
}

function leerConfig_() {
  var sh = configHoja_();
  var cfg = clonar_(CONFIG_BASE);
  var n = sh.getLastRow() - 1;
  if (n >= 1) {
    sh.getRange(2, 1, n, 2).getValues().forEach(function (r) {
      var k = String(r[0]);
      if (!Object.prototype.hasOwnProperty.call(CONFIG_BASE, k)) return;
      try {
        var v = JSON.parse(String(r[1]));
        var base = CONFIG_BASE[k];
        var tipoOk = Array.isArray(base) ? Array.isArray(v) : typeof v === typeof base && v !== null;
        if (tipoOk) cfg[k] = v;
      } catch (e) { /* valor dañado: se queda el de fábrica */ }
    });
  }
  return cfg;
}

function escribirConfig_(sh, k, v) {
  var json = JSON.stringify(v);
  if (json.length > 40000) throw new Error('El ajuste "' + k + '" es demasiado grande.');
  var n = sh.getLastRow() - 1;
  var fila = 0;
  if (n >= 1) {
    var claves = sh.getRange(2, 1, n, 1).getValues();
    for (var i = 0; i < claves.length; i++) {
      if (String(claves[i][0]) === k) { fila = i + 2; break; }
    }
  }
  if (!fila) fila = Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(fila, 1, 1, 3).setValues([[k, json, new Date()]]);
  sh.getRange(fila, 2).setNumberFormat('@');
  sh.getRange(fila, 3).setNumberFormat('dd/mm/yyyy hh:mm');
}

function validarConfig_(k, v) {
  var cuenta;
  if (k === 'impresoras') {
    if (!Array.isArray(v) || v.length > 12) throw new Error('La lista de impresoras no es válida (máximo 12).');
    var vistos = {};
    return v.map(function (p) {
      var nombre = texto_(p && p.nombre, 40);
      if (!nombre) throw new Error('Cada impresora necesita un nombre.');
      if (vistos[nombre.toLowerCase()]) throw new Error('La impresora "' + nombre + '" está repetida.');
      vistos[nombre.toLowerCase()] = true;
      var costo = decimal_(p.costoHora, 2);
      if (costo < 0 || costo > 1000000) throw new Error('El costo por hora de "' + nombre + '" no es válido.');
      var imp = { nombre: nombre, costoHora: costo };
      // Datos con los que se calculó el costo por hora (opcionales; solo se guardan los que tienen valor).
      var datosImp = [['precio', 'el precio', 1000000000], ['vidaHoras', 'la vida útil', 1000000],
        ['vatios', 'los vatios', 10000], ['mantenimientoHora', 'el mantenimiento por hora', 1000000]];
      datosImp.forEach(function (d) {
        var x = p[d[0]];
        if (x === '' || x === null || x === undefined) return;
        x = decimal_(x, 2);
        if (x < 0 || x > d[2]) throw new Error('En "' + nombre + '", ' + d[1] + ' no es válido.');
        if (x > 0) imp[d[0]] = x;
      });
      return imp;
    });
  }
  if (k === 'costoGramo') {
    var g = decimal_(v, 2);
    if (g < 0 || g > 1000000) throw new Error('El costo por gramo no es válido.');
    return g;
  }
  if (k === 'luzKwh') {
    var kwh = decimal_(v, 2);
    if (kwh < 0 || kwh > 1000000) throw new Error('El precio de la luz por kWh no es válido.');
    return kwh;
  }
  if (k === 'componentes') {
    if (!Array.isArray(v) || v.length > 60) throw new Error('La lista de componentes no es válida (máximo 60).');
    var nombres = {};
    return v.map(function (c) {
      var nom = texto_(c && c.nombre, 60);
      if (!nom) throw new Error('Cada componente necesita un nombre.');
      if (nombres[nom.toLowerCase()]) throw new Error('El componente "' + nom + '" está repetido.');
      nombres[nom.toLowerCase()] = true;
      var comp = { nombre: nom };
      var precio = decimal_(c.precio, 2), unidades = decimal_(c.unidades, 2);
      if (precio < 0 || precio > 1000000000) throw new Error('El precio de "' + nom + '" no es válido.');
      if (unidades < 0 || unidades > 100000) throw new Error('Las unidades de "' + nom + '" no son válidas.');
      if (precio > 0) {
        // Con el precio del paquete y cuántas unidades trae, el costo de una unidad se calcula aquí.
        comp.precio = precio;
        comp.unidades = unidades > 0 ? unidades : 1;
        comp.costo = decimal_(precio / comp.unidades, 2);
      } else {
        comp.costo = decimal_(c.costo, 2);
        if (comp.costo < 0 || comp.costo > 1000000000) throw new Error('El costo de "' + nom + '" no es válido.');
      }
      return comp;
    });
  }
  if (k === 'empaque') {
    var e = Math.round(numero_(v));
    if (e < 0 || e > 100000000) throw new Error('El costo de empaque no es válido.');
    return e;
  }
  if (k === 'gastoCategorias') {
    if (!Array.isArray(v) || v.length > 40) throw new Error('La lista de categorías de gastos no es válida (máximo 40).');
    var cats = [];
    v.forEach(function (c) { var t = texto_(c, 40); if (t && cats.indexOf(t) < 0) cats.push(t); });
    if (!cats.length) throw new Error('Deja al menos una categoría de gastos.');
    return cats;
  }
  if (k === 'listas') {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Las listas no son válidas.');
    var out = {};
    cuenta = 0;
    Object.keys(v).forEach(function (nombre) {
      if (++cuenta > 20) throw new Error('Hay demasiadas listas.');
      if (!/^[A-Za-z0-9_]{1,30}$/.test(nombre)) throw new Error('Nombre de lista no válido: ' + nombre);
      if (!Array.isArray(v[nombre]) || v[nombre].length > 80) throw new Error('La lista "' + nombre + '" no es válida (máximo 80 opciones).');
      var items = [];
      v[nombre].forEach(function (it) { var t = texto_(it, 80); if (t && items.indexOf(t) < 0) items.push(t); });
      out[nombre] = items;
    });
    return out;
  }
  throw new Error('Ese ajuste no se puede cambiar desde aquí: ' + k);
}

function guardarConfig_(cambios) {
  var claves = Object.keys(cambios);
  var listos = {};
  claves.forEach(function (k) {
    if (CONFIG_EDITABLE.indexOf(k) < 0) throw new Error('Ese ajuste no se puede cambiar desde aquí: ' + k);
    listos[k] = validarConfig_(k, cambios[k]);
  });
  var sh = configHoja_();
  Object.keys(listos).forEach(function (k) { escribirConfig_(sh, k, listos[k]); });
  SpreadsheetApp.flush();
  return leerConfig_();
}

/* Pedidos */

function leerPedidos_(sh) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  var tz = zona_(sh);
  var datos = sh.getRange(2, 1, n, CAMPOS.length).getValues();
  var salida = [];
  for (var i = 0; i < datos.length; i++) {
    if (datos[i][0] !== '' && datos[i][0] !== null) salida.push(filaAObjeto_(datos[i], tz, i + 2));
  }
  return salida;
}

function normalizarCosto_(k, v) {
  if (v === '' || v === null || v === undefined) return '';
  if (k === 'impresora') return texto_(v, 60);
  if (k === 'horas') {
    var h = decimal_(v, 2);
    if (h < 0 || h > 1000) throw new Error('Las horas de impresión deben estar entre 0 y 1000.');
    return h;
  }
  if (k === 'gramos') {
    var g = decimal_(v, 1);
    if (g < 0 || g > 100000) throw new Error('Los gramos de filamento deben estar entre 0 y 100.000.');
    return g;
  }
  var m = Math.round(numero_(v));
  if (m < 0 || m > 100000000) throw new Error('Un costo no es válido: debe estar entre $0 y $100.000.000.');
  return m;
}

// Costo del pedido con los precios de este momento. Se guarda como número (no se recalcula solo
// si después cambian los precios), así los pedidos viejos conservan lo que de verdad costaron.
function calcularCosto_(c, cfg) {
  var tiene = ['horas', 'gramos', 'empaque', 'envioNegocio', 'otros'].some(function (k) { return numero_dec_(c[k]) > 0; });
  if (!tiene) return '';
  var precioHora = 0;
  (cfg.impresoras || []).forEach(function (p) { if (p.nombre === c.impresora) precioHora = numero_dec_(p.costoHora); });
  var total = numero_dec_(c.gramos) * numero_dec_(cfg.costoGramo) + numero_dec_(c.horas) * precioHora +
    numero_dec_(c.empaque) + numero_dec_(c.envioNegocio) + numero_dec_(c.otros);
  return Math.round(total);
}

function crearPedido_(sh, p) {
  var tz = zona_(sh);
  var cliente = texto_(p.cliente, 120);
  var producto = texto_(p.producto, 160);
  if (!cliente) throw new Error('Falta el nombre del cliente.');
  if (!producto) throw new Error('Falta el producto.');
  var total = numero_(p.total);
  var pago = numero_(p.pago);
  var cantidad = Math.max(1, Math.round(numero_(p.cantidad) || 1));
  if (!(total > 0)) throw new Error('El valor total debe ser mayor que cero.');
  if (pago < 0) throw new Error('Lo que pagó no puede ser negativo.');
  if (pago > total) throw new Error('Lo que pagó no puede ser mayor al valor total.');
  var costos = {};
  CAMPOS_COSTO.forEach(function (k) { costos[k] = normalizarCosto_(k, p[k]); });

  var ultima = sh.getLastRow();

  // Si la app reintenta un envío que ya había llegado, no se duplica el pedido.
  var ref = texto_(p.ref, 60);
  if (ref && ultima > 1) {
    var desde = Math.max(2, ultima - 99);
    var refs = sh.getRange(desde, COL.ref, ultima - desde + 1, 1).getValues();
    for (var i = refs.length - 1; i >= 0; i--) {
      if (refs[i][0] === ref) {
        var existente = objetoDeFila_(sh, desde + i);
        existente.duplicado = true;
        return existente;
      }
    }
  }

  var cfg = leerConfig_();
  var max = 0;
  if (ultima > 1) {
    sh.getRange(2, COL.id, ultima - 1, 1).getValues().forEach(function (r) {
      var m = String(r[0]).match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
  }
  var id = PREFIJO_ID + ('0000' + (max + 1)).slice(-4);

  var fila = ultima + 1;
  if (fila > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 500);

  var valores = CAMPOS.map(function () { return ''; });
  var poner = function (k, v) { valores[COL[k] - 1] = v; };
  poner('id', id);
  poner('fecha', fecha_(p.fecha, tz) || ahora_());
  poner('cliente', cliente);
  poner('contacto', texto_(p.contacto, 60));
  poner('canal', texto_(p.canal, 60));
  poner('producto', producto);
  poner('cantidad', cantidad);
  poner('detalles', texto_(p.detalles, 600));
  poner('total', total);
  poner('pago', pago);
  poner('debe', '=' + letra_('total') + fila + '-' + letra_('pago') + fila);
  poner('estadoPago', '=IF(' + letra_('pago') + fila + '>=' + letra_('total') + fila +
    ',"Pagado",IF(' + letra_('pago') + fila + '>0,"Abonó","Sin pago"))');
  poner('metodoPago', pago > 0 ? texto_(p.metodoPago, 60) : '');
  poner('entregaFecha', fecha_(p.entregaFecha, tz));
  poner('entregaTipo', p.entregaTipo === 'Envío' ? 'Envío' : 'Recogida');
  poner('entregaVia', texto_(p.entregaVia, 100));
  poner('direccion', texto_(p.direccion, 300));
  poner('estado', ESTADOS.indexOf(p.estado) >= 0 ? p.estado : 'Recibido');
  poner('notas', texto_(p.notas, 600));
  poner('registrado', ahora_());
  poner('ref', ref);
  CAMPOS_COSTO.forEach(function (k) { poner(k, costos[k]); });
  poner('costoTotal', calcularCosto_(costos, cfg));
  poner('ganancia', formulaGanancia_(fila));

  sh.getRange(fila, 1, 1, CAMPOS.length).setValues([valores]);
  SpreadsheetApp.flush();
  var pedido = objetoDeFila_(sh, fila);
  var avisos = sincronizarEventoFila_(sh, fila, pedido, cfg);
  if (avisos.length) pedido.avisos = avisos;
  return pedido;
}

// Campos que se pueden cambiar después de crear el pedido. El pago no está aquí a propósito:
// los pagos solo se suman con la acción "pagar", para que dos personas no se pisen.
const EDITABLES = ['estado', 'fecha', 'cliente', 'contacto', 'canal', 'producto', 'cantidad', 'detalles', 'total',
  'metodoPago', 'entregaFecha', 'entregaTipo', 'entregaVia', 'direccion', 'notas'].concat(CAMPOS_COSTO);
const AFECTAN_EVENTO = ['estado', 'cliente', 'contacto', 'producto', 'cantidad', 'detalles', 'total', 'entregaFecha',
  'entregaTipo', 'entregaVia', 'direccion', 'notas'];

function actualizarPedido_(sh, req) {
  var fila = buscarFila_(sh, req.id);
  var tz = zona_(sh);
  var cambios = req.cambios || {};
  var actual = objetoDeFila_(sh, fila);
  var listos = {};
  // Primero se revisa todo; solo si todo está bien se escribe. Así un cambio inválido no deja el pedido a medias.
  Object.keys(cambios).forEach(function (k) {
    if (EDITABLES.indexOf(k) < 0) throw new Error('No se puede cambiar el campo: ' + k);
    var v = cambios[k];
    if (k === 'estado') {
      if (ESTADOS.indexOf(v) < 0) throw new Error('Estado no válido: ' + v);
    } else if (k === 'fecha') {
      v = fecha_(v, tz);
      if (!v) throw new Error('La fecha del pedido no es válida.');
    } else if (k === 'entregaFecha') {
      var texto = v;
      v = fecha_(v, tz);
      if (texto && !v) throw new Error('La fecha de entrega no es válida.');
    } else if (k === 'entregaTipo') {
      v = v === 'Envío' ? 'Envío' : 'Recogida';
    } else if (k === 'cliente' || k === 'producto') {
      v = texto_(v, k === 'cliente' ? 120 : 160);
      if (!v) throw new Error(k === 'cliente' ? 'El cliente no puede quedar vacío.' : 'El producto no puede quedar vacío.');
    } else if (k === 'cantidad') {
      v = Math.round(numero_(v));
      if (!(v >= 1)) throw new Error('La cantidad debe ser al menos 1.');
    } else if (k === 'total') {
      v = numero_(v);
      if (!(v > 0)) throw new Error('El valor total debe ser mayor que cero.');
      if (v < actual.pago) throw new Error('El total no puede ser menor a lo que ya pagó (' + actual.pago + ').');
    } else if (CAMPOS_COSTO.indexOf(k) >= 0) {
      v = normalizarCosto_(k, v);
    } else {
      var max = { contacto: 60, canal: 60, detalles: 600, metodoPago: 60, entregaVia: 100, direccion: 600, notas: 600 }[k] || 100;
      v = texto_(v, max);
    }
    listos[k] = v;
  });

  var tocaCostos = Object.keys(listos).some(function (k) { return CAMPOS_COSTO.indexOf(k) >= 0; });
  if (tocaCostos) {
    var costos = {};
    CAMPOS_COSTO.forEach(function (k) { costos[k] = Object.prototype.hasOwnProperty.call(listos, k) ? listos[k] : actual[k]; });
    listos.costoTotal = calcularCosto_(costos, leerConfig_());
  }

  Object.keys(listos).forEach(function (k) {
    sh.getRange(fila, COL[k]).setValue(listos[k]);
  });
  SpreadsheetApp.flush();
  var pedido = objetoDeFila_(sh, fila);
  var avisos = [];
  if (Object.keys(listos).some(function (k) { return AFECTAN_EVENTO.indexOf(k) >= 0; })) {
    avisos = sincronizarEventoFila_(sh, fila, pedido, leerConfig_());
  }
  if (avisos.length) pedido.avisos = avisos;
  return pedido;
}

function registrarPago_(sh, req) {
  var fila = buscarFila_(sh, req.id);
  var monto = numero_(req.monto);
  if (!(monto > 0)) throw new Error('El pago debe ser mayor que cero.');
  var total = numero_(sh.getRange(fila, COL.total).getValue());
  var actual = numero_(sh.getRange(fila, COL.pago).getValue());
  if (actual + monto > total) {
    throw new Error('Ese pago supera lo que debe. Saldo pendiente: $' + (total - actual) + '.');
  }
  sh.getRange(fila, COL.pago).setValue(actual + monto);
  var metodo = texto_(req.metodo, 60);
  if (metodo) {
    var previo = String(sh.getRange(fila, COL.metodoPago).getValue() || '');
    if (previo.indexOf(metodo) < 0) {
      sh.getRange(fila, COL.metodoPago).setValue(previo ? previo + ', ' + metodo : metodo);
    }
  }
  SpreadsheetApp.flush();
  var pedido = objetoDeFila_(sh, fila);
  var avisos = sincronizarEventoFila_(sh, fila, pedido, leerConfig_());
  if (avisos.length) pedido.avisos = avisos;
  return pedido;
}

// Vuelve a calcular el costo de los pedidos que tienen datos de costo, con los precios de hoy.
function recalcularCostos_(sh) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return { ok: true, cambiados: 0 };
  var cfg = leerConfig_();
  var rango = sh.getRange(2, COL.impresora, n, COL.costoTotal - COL.impresora + 1);
  var datos = rango.getValues();
  var ids = sh.getRange(2, COL.id, n, 1).getValues();
  var cambiados = 0;
  datos.forEach(function (r, i) {
    if (ids[i][0] === '' || ids[i][0] === null) return;
    var c = {};
    CAMPOS_COSTO.forEach(function (k, j) { c[k] = r[j]; });
    var nuevo = calcularCosto_(c, cfg);
    var viejo = r[r.length - 1];
    if (nuevo !== '' && nuevo !== numero_dec_(viejo)) { r[r.length - 1] = nuevo; cambiados++; }
  });
  if (cambiados) {
    rango.setValues(datos);
    SpreadsheetApp.flush();
  }
  return { ok: true, cambiados: cambiados };
}

/* Gastos */

function leerGastos_(sh) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  var tz = zona_(sh);
  var datos = sh.getRange(2, 1, n, CAMPOS_GASTO.length).getValues();
  var salida = [];
  for (var i = 0; i < datos.length; i++) {
    if (datos[i][0] !== '' && datos[i][0] !== null) salida.push(gastoAObjeto_(datos[i], tz, i + 2));
  }
  return salida;
}

function gastoAObjeto_(vals, tz, fila) {
  var o = { fila: fila };
  CAMPOS_GASTO.forEach(function (c, i) {
    if (c.k === 'ref') return;
    var v = vals[i];
    if (esFecha_(v)) {
      v = Utilities.formatDate(v, tz, c.k === 'registrado' ? "yyyy-MM-dd'T'HH:mm" : 'yyyy-MM-dd');
    } else if (c.k === 'monto') {
      v = numero_(v);
    } else {
      v = (v === null || v === undefined) ? '' : String(v);
    }
    o[c.k] = v;
  });
  return o;
}

function validarGasto_(g, tz, parcial) {
  var out = {};
  if (!parcial || 'concepto' in g) {
    out.concepto = texto_(g.concepto, 120);
    if (!out.concepto) throw new Error('Falta decir en qué fue el gasto.');
  }
  if (!parcial || 'monto' in g) {
    out.monto = Math.round(numero_(g.monto));
    if (!(out.monto > 0)) throw new Error('El monto del gasto debe ser mayor que cero.');
    if (out.monto > 10000000000) throw new Error('El monto del gasto es demasiado grande.');
  }
  if (!parcial || 'fecha' in g) {
    out.fecha = fecha_(g.fecha, tz) || (parcial ? '' : ahora_());
    if (parcial && !out.fecha) throw new Error('La fecha del gasto no es válida.');
  }
  if (!parcial || 'categoria' in g) out.categoria = texto_(g.categoria, 40);
  if (!parcial || 'metodo' in g) out.metodo = texto_(g.metodo, 60);
  if (!parcial || 'notas' in g) out.notas = texto_(g.notas, 600);
  return out;
}

function crearGasto_(sh, g) {
  var tz = zona_(sh);
  var datos = validarGasto_(g, tz, false);
  var ultima = sh.getLastRow();
  var ref = texto_(g.ref, 60);
  if (ref && ultima > 1) {
    var desde = Math.max(2, ultima - 99);
    var refs = sh.getRange(desde, COLG.ref, ultima - desde + 1, 1).getValues();
    for (var i = refs.length - 1; i >= 0; i--) {
      if (refs[i][0] === ref) {
        var existente = gastoAObjeto_(sh.getRange(desde + i, 1, 1, CAMPOS_GASTO.length).getValues()[0], tz, desde + i);
        existente.duplicado = true;
        return existente;
      }
    }
  }
  var max = 0;
  if (ultima > 1) {
    sh.getRange(2, COLG.id, ultima - 1, 1).getValues().forEach(function (r) {
      var m = String(r[0]).match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
  }
  var fila = ultima + 1;
  if (fila > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 500);
  var valores = CAMPOS_GASTO.map(function () { return ''; });
  var poner = function (k, v) { valores[COLG[k] - 1] = v; };
  poner('id', PREFIJO_GASTO + ('0000' + (max + 1)).slice(-4));
  Object.keys(datos).forEach(function (k) { poner(k, datos[k]); });
  poner('registrado', ahora_());
  poner('ref', ref);
  sh.getRange(fila, 1, 1, CAMPOS_GASTO.length).setValues([valores]);
  SpreadsheetApp.flush();
  return gastoAObjeto_(sh.getRange(fila, 1, 1, CAMPOS_GASTO.length).getValues()[0], tz, fila);
}

function buscarFilaGasto_(sh, id) {
  var n = Math.max(sh.getLastRow() - 1, 1);
  var ids = sh.getRange(2, COLG.id, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  throw new Error('No encontré el gasto ' + id + ' en la hoja.');
}

function actualizarGasto_(sh, req) {
  var fila = buscarFilaGasto_(sh, req.id);
  var tz = zona_(sh);
  var cambios = req.cambios || {};
  Object.keys(cambios).forEach(function (k) {
    if (['fecha', 'concepto', 'categoria', 'monto', 'metodo', 'notas'].indexOf(k) < 0) {
      throw new Error('No se puede cambiar el campo: ' + k);
    }
  });
  var listos = validarGasto_(cambios, tz, true);
  Object.keys(listos).forEach(function (k) { sh.getRange(fila, COLG[k]).setValue(listos[k]); });
  SpreadsheetApp.flush();
  return gastoAObjeto_(sh.getRange(fila, 1, 1, CAMPOS_GASTO.length).getValues()[0], tz, fila);
}

function eliminarGasto_(sh, req) {
  var fila = buscarFilaGasto_(sh, req.id);
  sh.deleteRow(fila);
  SpreadsheetApp.flush();
  return { ok: true, id: String(req.id) };
}

/* Fichas de costo */

function fichasHoja_() {
  var ss = libro_();
  var sh = ss.getSheetByName(NOMBRE_FICHAS);
  if (!sh) sh = ss.insertSheet(NOMBRE_FICHAS);
  if (sh.getLastRow() === 0) {
    var n = CAMPOS_FICHA.length;
    asegurarColumnas_(sh, n);
    estiloEncabezado_(sh.getRange(1, 1, 1, n).setValues([CAMPOS_FICHA.map(function (c) { return c.h; })]));
    sh.setFrozenRows(1);
    sh.setRowHeight(1, 40);
    var filas = Math.max(sh.getMaxRows() - 1, 1);
    sh.getRange(2, COLF.horas, filas, 1).setNumberFormat('0.0#');
    sh.getRange(2, COLF.gramos, filas, 1).setNumberFormat('#,##0.#');
    sh.getRange(2, COLF.actualizado, filas, 1).setNumberFormat('dd/mm/yyyy hh:mm');
    var anchos = { id: 80, nombre: 240, categoria: 160, impresora: 150, horas: 110, gramos: 110, componentesTxt: 260, notas: 240, catalogoId: 110, actualizado: 140 };
    Object.keys(anchos).forEach(function (k) { sh.setColumnWidth(COLF[k], anchos[k]); });
    sh.hideColumns(COLF.componentes);
  } else {
    var enc = sh.getRange(1, 1, 1, Math.min(CAMPOS_FICHA.length, sh.getMaxColumns())).getValues()[0];
    if (enc[0] !== CAMPOS_FICHA[0].h || enc[COLF.componentes - 1] !== CAMPOS_FICHA[COLF.componentes - 1].h) {
      throw new Error('La pestaña "' + NOMBRE_FICHAS + '" ya existe con otras columnas. Renómbrala para que el manager pueda crear la suya.');
    }
  }
  return sh;
}

function fichaAObjeto_(vals, fila) {
  var o = { fila: fila };
  CAMPOS_FICHA.forEach(function (c, i) {
    var v = vals[i];
    if (c.k === 'componentesTxt' || c.k === 'actualizado') return;
    if (c.k === 'componentes') {
      var lista = [];
      try {
        var j = JSON.parse(String(v || '[]'));
        if (Array.isArray(j)) lista = j;
      } catch (e) { /* celda dañada: queda sin componentes */ }
      o.componentes = lista.filter(function (x) { return x && x.nombre; }).map(function (x) {
        return { nombre: String(x.nombre), cantidad: numero_dec_(x.cantidad) > 0 ? numero_dec_(x.cantidad) : 1 };
      });
    } else if (c.k === 'horas' || c.k === 'gramos') {
      o[c.k] = (v === '' || v === null || v === undefined || isNaN(Number(v))) ? '' : Number(v);
    } else if (c.k === 'catalogoId') {
      var id = numero_(v);
      o.catalogoId = id > 0 ? id : '';
    } else {
      o[c.k] = (v === null || v === undefined) ? '' : String(v);
    }
  });
  return o;
}

function leerFichas_(sh) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  var datos = sh.getRange(2, 1, n, CAMPOS_FICHA.length).getValues();
  var salida = [];
  for (var i = 0; i < datos.length; i++) {
    if (datos[i][0] !== '' && datos[i][0] !== null) salida.push(fichaAObjeto_(datos[i], i + 2));
  }
  return salida;
}

function validarFicha_(f) {
  var out = {};
  out.nombre = texto_(f.nombre, 80);
  if (!out.nombre) throw new Error('La ficha necesita el nombre del producto.');
  out.categoria = texto_(f.categoria, 60);
  out.impresora = texto_(f.impresora, 60);
  out.horas = (f.horas === '' || f.horas === null || f.horas === undefined) ? '' : decimal_(f.horas, 2);
  if (out.horas !== '' && (out.horas < 0 || out.horas > 1000)) throw new Error('Las horas de la ficha deben estar entre 0 y 1000.');
  out.gramos = (f.gramos === '' || f.gramos === null || f.gramos === undefined) ? '' : decimal_(f.gramos, 1);
  if (out.gramos !== '' && (out.gramos < 0 || out.gramos > 100000)) throw new Error('Los gramos de la ficha deben estar entre 0 y 100.000.');
  var comps = Array.isArray(f.componentes) ? f.componentes : [];
  if (comps.length > 20) throw new Error('Una ficha puede tener máximo 20 componentes distintos.');
  var vistos = {};
  out.componentes = comps.map(function (c) {
    var nom = texto_(c && c.nombre, 60);
    if (!nom) throw new Error('Cada componente de la ficha necesita un nombre.');
    if (vistos[nom.toLowerCase()]) throw new Error('El componente "' + nom + '" está repetido en la ficha.');
    vistos[nom.toLowerCase()] = true;
    var cant = decimal_(c.cantidad, 2);
    if (!(cant > 0) || cant > 1000) throw new Error('La cantidad de "' + nom + '" debe ser mayor que cero.');
    return { nombre: nom, cantidad: cant };
  });
  out.notas = texto_(f.notas, 300);
  var cid = numero_(f.catalogoId);
  out.catalogoId = cid > 0 ? cid : '';
  return out;
}

// Crea la ficha, o la actualiza si trae su ID. No puede haber dos fichas con el mismo nombre.
function guardarFicha_(sh, req) {
  var datos = validarFicha_(req);
  var id = texto_(req.id, 20);
  var ultima = sh.getLastRow();
  var existentes = ultima > 1 ? sh.getRange(2, 1, ultima - 1, CAMPOS_FICHA.length).getValues() : [];
  var fila = 0, max = 0, total = 0;
  existentes.forEach(function (r, i) {
    if (r[0] === '' || r[0] === null) return;
    total++;
    var m = String(r[0]).match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
    if (id && String(r[0]) === id) fila = i + 2;
  });
  if (id && !fila) throw new Error('No encontré la ficha ' + id + ' en la hoja.');
  existentes.forEach(function (r) {
    if (r[0] === '' || r[0] === null || String(r[0]) === id) return;
    if (String(r[COLF.nombre - 1]).toLowerCase() === datos.nombre.toLowerCase()) {
      throw new Error('Ya existe una ficha llamada "' + datos.nombre + '". Ábrela y edítala en vez de crear otra.');
    }
  });
  if (!fila) {
    if (total >= MAX_FICHAS) throw new Error('Llegaste al máximo de ' + MAX_FICHAS + ' fichas.');
    fila = ultima + 1;
    if (fila > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 100);
    id = PREFIJO_FICHA + ('0000' + (max + 1)).slice(-4);
  }
  var valores = CAMPOS_FICHA.map(function () { return ''; });
  var poner = function (k, v) { valores[COLF[k] - 1] = v; };
  poner('id', id);
  ['nombre', 'categoria', 'impresora', 'horas', 'gramos', 'notas', 'catalogoId'].forEach(function (k) { poner(k, datos[k]); });
  poner('componentesTxt', datos.componentes.map(function (c) { return c.nombre + ' x' + c.cantidad; }).join(', '));
  poner('componentes', JSON.stringify(datos.componentes));
  poner('actualizado', ahora_());
  sh.getRange(fila, 1, 1, CAMPOS_FICHA.length).setValues([valores]);
  SpreadsheetApp.flush();
  return fichaAObjeto_(sh.getRange(fila, 1, 1, CAMPOS_FICHA.length).getValues()[0], fila);
}

function eliminarFicha_(sh, req) {
  var n = Math.max(sh.getLastRow() - 1, 1);
  var ids = sh.getRange(2, COLF.id, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(req.id)) {
      sh.deleteRow(i + 2);
      SpreadsheetApp.flush();
      return { ok: true, id: String(req.id) };
    }
  }
  throw new Error('No encontré la ficha ' + req.id + ' en la hoja.');
}

/* Google Calendar */

function calendario_(crear) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('calendarId');
  var cal = null;
  if (id) {
    try { cal = CalendarApp.getCalendarById(id); } catch (e) { cal = null; }
  }
  if (!cal) {
    var lista = CalendarApp.getCalendarsByName(NOMBRE_CALENDARIO);
    if (lista && lista.length) {
      cal = lista[0];
    } else if (crear) {
      cal = CalendarApp.createCalendar(NOMBRE_CALENDARIO, {
        summary: 'Entregas de pedidos de Yi Shu Studio',
        timeZone: zonaLibro_()
      });
      try { cal.setSelected(true); cal.setHidden(false); } catch (e2) { /* no es grave */ }
    }
    if (cal) props.setProperty('calendarId', cal.getId());
  }
  return cal;
}

function esFecha_(v) {
  return Object.prototype.toString.call(v) === '[object Date]';
}

function fechaLocal_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

function tituloEvento_(p) {
  var cabeza = p.estado === 'Entregado' ? 'Entregado - ' : (p.entregaTipo === 'Envío' ? 'Envío - ' : 'Entrega - ');
  var prod = String(p.producto || '');
  if (prod.length > 60) prod = prod.slice(0, 57) + '...';
  return cabeza + p.cliente + ' - ' + prod;
}

function descripcionEvento_(p) {
  var l = ['Pedido ' + p.id + ' (' + p.estado + ')', 'Cliente: ' + p.cliente];
  if (p.contacto) l.push('Contacto: ' + p.contacto);
  l.push('Producto: ' + p.producto + (p.cantidad > 1 ? ' (' + p.cantidad + ' unidades)' : ''));
  if (p.detalles) l.push('Detalles: ' + p.detalles);
  l.push(p.debe > 0 ? 'Falta por pagar: ' + moneda_(p.debe) + ' de ' + moneda_(p.total) : 'Pagado: ' + moneda_(p.total));
  l.push((p.entregaTipo === 'Envío' ? 'Envío' : 'Recogida') + (p.entregaVia ? ': ' + p.entregaVia : ''));
  if (p.direccion) l.push('Dirección: ' + p.direccion);
  if (p.notas) l.push('Notas: ' + p.notas);
  return l.join('\n');
}

function firmaEvento_(p) {
  var s = tituloEvento_(p) + '|' + descripcionEvento_(p) + '|' + p.entregaFecha;
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function debeTenerEvento_(p, yaTiene) {
  if (!p.entregaFecha || p.estado === 'Cancelado') return false;
  if (p.estado === 'Entregado' && !yaTiene) return false;
  return true;
}

// Deja el evento del pedido como debe estar. Devuelve {id, firma} o null si no corresponde evento.
function aplicarEvento_(cal, p, evId, firmaPrev) {
  var ev = null;
  if (evId) {
    try { ev = cal.getEventById(evId); } catch (e) { ev = null; }
  }
  if (!debeTenerEvento_(p, !!evId)) {
    if (ev) ev.deleteEvent();
    return null;
  }
  var firma = firmaEvento_(p);
  if (ev && firma === firmaPrev) return { id: evId, firma: firma };
  var fecha = fechaLocal_(p.entregaFecha);
  var titulo = tituloEvento_(p);
  var desc = descripcionEvento_(p);
  if (!ev) {
    ev = cal.createAllDayEvent(titulo, fecha, { description: desc });
    try {
      ev.removeAllReminders();
      ev.addPopupReminder(900); // 15 horas antes de la medianoche del día: avisa a las 9:00 am del día anterior
    } catch (e2) { /* sin recordatorio, pero el evento queda */ }
  } else {
    ev.setTitle(titulo);
    ev.setDescription(desc);
    ev.setAllDayDate(fecha);
  }
  return { id: ev.getId(), firma: firma };
}

function sincronizarEventoFila_(sh, fila, p, cfg) {
  if (!cfg || !cfg.calendario) return [];
  try {
    var celda = String(sh.getRange(fila, COL.eventoId).getValue() || '');
    var partes = celda.split('|');
    var cal = calendario_(true);
    var nuevo = aplicarEvento_(cal, p, partes[0], partes[1] || '');
    var valor = nuevo ? nuevo.id + '|' + nuevo.firma : '';
    if (valor !== celda) sh.getRange(fila, COL.eventoId).setValue(valor);
    return [];
  } catch (err) {
    return ['El pedido quedó guardado, pero no pude actualizar Google Calendar: ' + mensajeError_(err)];
  }
}

function sincronizarCalendario_(sh) {
  var inicio = Date.now();
  var cal = calendario_(true);
  var pedidos = leerPedidos_(sh);
  var celdas = pedidos.length ? sh.getRange(2, COL.eventoId, sh.getLastRow() - 1, 1).getValues() : [];
  var r = { ok: true, creados: 0, actualizados: 0, borrados: 0, sinCambios: 0, errores: [], pendientes: 0 };
  for (var i = 0; i < pedidos.length; i++) {
    var p = pedidos[i];
    if (Date.now() - inicio > 240000) { r.pendientes = pedidos.length - i; break; }
    var celda = String(celdas[p.fila - 2][0] || '');
    var partes = celda.split('|');
    try {
      var nuevo = aplicarEvento_(cal, p, partes[0], partes[1] || '');
      var valor = nuevo ? nuevo.id + '|' + nuevo.firma : '';
      if (valor === celda) {
        r.sinCambios++;
      } else {
        sh.getRange(p.fila, COL.eventoId).setValue(valor);
        if (!celda && valor) r.creados++;
        else if (celda && !valor) r.borrados++;
        else r.actualizados++;
      }
    } catch (err) {
      r.errores.push(p.id + ': ' + mensajeError_(err));
    }
  }
  SpreadsheetApp.flush();
  return r;
}

/* Resumen diario por correo */

function sumarDias_(iso, n) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

function diasEntre_(desde, hasta) {
  var a = /^(\d{4})-(\d{2})-(\d{2})/.exec(desde);
  var b = /^(\d{4})-(\d{2})-(\d{2})/.exec(hasta);
  return Math.round((Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3])) / 86400000);
}

function fmt_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}

function moneda_(n) {
  return '$ ' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function escapar_(s) {
  return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function plural_(n, uno, varios) {
  return n + ' ' + (n === 1 ? uno : varios);
}

function armarResumen_(pedidos, hoy) {
  var activos = pedidos.filter(function (p) { return p.estado !== 'Entregado' && p.estado !== 'Cancelado'; });
  var conFecha = activos.filter(function (p) { return p.entregaFecha; });
  var porFecha = function (a, b) { return a.entregaFecha < b.entregaFecha ? -1 : a.entregaFecha > b.entregaFecha ? 1 : 0; };
  var limite = sumarDias_(hoy, 3);
  var deHoy = conFecha.filter(function (p) { return p.entregaFecha === hoy; });
  var atrasados = conFecha.filter(function (p) { return p.entregaFecha < hoy; }).sort(porFecha);
  var proximos = conFecha.filter(function (p) { return p.entregaFecha > hoy && p.entregaFecha <= limite; }).sort(porFecha);
  var porEmpezar = activos.filter(function (p) { return p.estado === 'Recibido'; });
  var enProduccion = activos.filter(function (p) { return p.estado === 'En producción'; });
  var porImprimir = porEmpezar.concat(enProduccion);
  var horas = 0;
  var sinHoras = 0;
  porImprimir.forEach(function (p) { if (numero_dec_(p.horas) > 0) horas += numero_dec_(p.horas); else sinHoras++; });
  var porCobrar = pedidos.filter(function (p) { return p.estado !== 'Cancelado' && p.debe > 0; })
    .sort(function (a, b) { return b.debe - a.debe; });
  var totalCobrar = 0;
  porCobrar.forEach(function (p) { totalCobrar += p.debe; });

  var linea = function (p, extra) {
    var prod = String(p.producto || '');
    if (prod.length > 70) prod = prod.slice(0, 67) + '...';
    var t = p.cliente + ' - ' + prod + ' (' + p.entregaTipo.toLowerCase() + ')';
    if (extra) t += ' - ' + extra;
    if (p.debe > 0) t += ' - debe ' + moneda_(p.debe);
    return t + ' [' + p.id + ']';
  };

  var secciones = [];
  if (atrasados.length) secciones.push({ titulo: 'Atrasados (' + atrasados.length + ')', tono: 'alerta', filas: atrasados.map(function (p) {
    var d = diasEntre_(p.entregaFecha, hoy);
    return linea(p, 'era para el ' + fmt_(p.entregaFecha) + ', hace ' + plural_(d, 'día', 'días'));
  }) });
  if (deHoy.length) secciones.push({ titulo: 'Para entregar hoy (' + deHoy.length + ')', tono: 'hoy', filas: deHoy.map(function (p) { return linea(p, p.estado); }) });
  if (proximos.length) secciones.push({ titulo: 'En los próximos 3 días (' + proximos.length + ')', tono: 'normal', filas: proximos.map(function (p) {
    return linea(p, fmt_(p.entregaFecha));
  }) });
  var lineaProduccion = [];
  if (porEmpezar.length) lineaProduccion.push(plural_(porEmpezar.length, 'pedido por empezar', 'pedidos por empezar'));
  if (enProduccion.length) lineaProduccion.push(plural_(enProduccion.length, 'en producción', 'en producción'));
  if (lineaProduccion.length) {
    var txt = lineaProduccion.join(' y ') + '.';
    if (horas > 0) txt += ' Horas de impresión anotadas: ' + String(Math.round(horas * 10) / 10).replace('.', ',') + ' h' +
      (sinHoras ? ' (a ' + plural_(sinHoras, 'pedido', 'pedidos') + ' le faltan las horas)' : '') + '.';
    secciones.push({ titulo: 'Cola de producción', tono: 'normal', filas: [txt] });
  }
  if (porCobrar.length) {
    var filasCobro = porCobrar.slice(0, 5).map(function (p) { return p.cliente + ' - ' + moneda_(p.debe) + ' [' + p.id + ']'; });
    if (porCobrar.length > 5) filasCobro.push('y ' + (porCobrar.length - 5) + ' más');
    secciones.push({ titulo: 'Por cobrar: ' + moneda_(totalCobrar) + ' en ' + plural_(porCobrar.length, 'pedido', 'pedidos'), tono: 'normal', filas: filasCobro });
  }

  var partes = [];
  if (deHoy.length) partes.push(plural_(deHoy.length, 'entrega hoy', 'entregas hoy'));
  if (atrasados.length) partes.push(plural_(atrasados.length, 'atrasado', 'atrasados'));
  if (!partes.length) partes.push('sin entregas para hoy');
  var asunto = 'Yi Shu - ' + fmt_(hoy) + ': ' + partes.join(', ');

  var saludo = 'Buen día. Así está la tienda hoy, ' + fmt_(hoy) + ':';
  var texto = saludo + '\n\n' + (secciones.length ? secciones.map(function (s) {
    return s.titulo + '\n' + s.filas.map(function (f) { return '- ' + f; }).join('\n');
  }).join('\n\n') : 'Por ahora no hay nada pendiente.') + '\n\nQue tengas un buen día.\nYi Shu Manager';

  var colores = { alerta: '#ffe3e3', hoy: '#fff3d6', normal: '#f3f3f3' };
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111;">' +
    '<div style="background:#111;color:#fff;padding:18px 20px;border-radius:12px 12px 0 0;font-size:20px;font-weight:bold;letter-spacing:1px;">YI SHU STUDIO</div>' +
    '<div style="background:#ffffff;padding:18px 20px 8px 20px;font-size:15px;">' + escapar_(saludo) + '</div>' +
    secciones.map(function (s) {
      return '<div style="background:' + colores[s.tono] + ';margin:10px 0;padding:12px 16px;border-radius:10px;">' +
        '<div style="font-weight:bold;font-size:15px;margin-bottom:6px;">' + escapar_(s.titulo) + '</div>' +
        s.filas.map(function (f) { return '<div style="font-size:14px;line-height:1.5;padding:2px 0;">' + escapar_(f) + '</div>'; }).join('') +
        '</div>';
    }).join('') +
    (secciones.length ? '' : '<div style="padding:10px 20px;font-size:14px;">Por ahora no hay nada pendiente.</div>') +
    '<div style="padding:14px 20px;font-size:13px;color:#666;">Que tengas un buen día. Este correo lo envía tu Yi Shu Manager; lo apagas desde Ajustes en la app.</div>' +
    '</div>';

  return { asunto: asunto, texto: texto, html: html, hayAlgo: secciones.length > 0 };
}

function correoDueno_() {
  try { return Session.getEffectiveUser().getEmail() || ''; } catch (e) { return ''; }
}

function destinatarios_(cfg) {
  var lista = String(cfg.resumenEmail || '').split(/[,;\s]+/).filter(function (x) { return x; });
  if (!lista.length) {
    var dueno = correoDueno_();
    if (dueno) lista = [dueno];
  }
  if (!lista.length) throw new Error('No encontré a qué correo enviar el resumen. Escríbelo en Ajustes.');
  return lista;
}

function enviarResumen_(cfg, manual) {
  var sh = hoja_();
  var hoy = iso_(ahora_(), zona_(sh), false);
  var r = armarResumen_(leerPedidos_(sh), hoy);
  if (!r.hayAlgo && !manual) return { ok: true, enviado: false, motivo: 'No había nada que avisar.' };
  var para = destinatarios_(cfg);
  MailApp.sendEmail({ to: para.join(','), subject: r.asunto, body: r.texto, htmlBody: r.html, name: 'Yi Shu Manager' });
  return { ok: true, enviado: true, para: para, asunto: r.asunto };
}

/* Respaldo en Drive */

function respaldar_() {
  var ss = libro_();
  var tz = ss.getSpreadsheetTimeZone();
  var archivo = DriveApp.getFileById(ss.getId());
  var carpetas = DriveApp.getFoldersByName(NOMBRE_CARPETA_RESPALDO);
  var carpeta = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder(NOMBRE_CARPETA_RESPALDO);
  var nombre = PREFIJO_RESPALDO + Utilities.formatDate(ahora_(), tz, 'yyyy-MM-dd HH.mm');
  archivo.makeCopy(nombre, carpeta);
  var copias = [];
  var it = carpeta.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf(PREFIJO_RESPALDO) === 0) copias.push(f);
  }
  copias.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  var borradas = 0;
  for (var i = RESPALDOS_A_CONSERVAR; i < copias.length; i++) {
    copias[i].setTrashed(true);
    borradas++;
  }
  return { ok: true, nombre: nombre, carpeta: NOMBRE_CARPETA_RESPALDO, guardadas: Math.min(copias.length, RESPALDOS_A_CONSERVAR), borradas: borradas };
}

/* Automatizaciones: ajustes y disparadores */

function gatillos_() {
  return ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
}

function quitarGatillos_(funcion) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === funcion) ScriptApp.deleteTrigger(t);
  });
}

function leerEjecucion_(clave) {
  var s = PropertiesService.getScriptProperties().getProperty(clave);
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

function estadoAutomatizaciones_(cfg) {
  var estado = {
    version: VERSION,
    zonaHoja: zonaLibro_(),
    zonaScript: Session.getScriptTimeZone(),
    correoDueno: correoDueno_(),
    permisos: true,
    calendario: { activo: !!cfg.calendario, nombre: NOMBRE_CALENDARIO },
    resumen: { activo: false, hora: cfg.resumenHora, correo: cfg.resumenEmail || '', ultimo: leerEjecucion_('ultimoResumen') },
    respaldo: { activo: false, carpeta: NOMBRE_CARPETA_RESPALDO, conserva: RESPALDOS_A_CONSERVAR, ultimo: leerEjecucion_('ultimoRespaldo') }
  };
  try {
    var g = gatillos_();
    estado.resumen.activo = !!cfg.resumen && g.indexOf('resumenDiario') >= 0;
    estado.respaldo.activo = !!cfg.respaldo && g.indexOf('respaldoSemanal') >= 0;
    estado.resumen.faltaGatillo = !!cfg.resumen && g.indexOf('resumenDiario') < 0;
    estado.respaldo.faltaGatillo = !!cfg.respaldo && g.indexOf('respaldoSemanal') < 0;
  } catch (err) {
    estado.permisos = false;
    estado.permisosMensaje = mensajeError_(err);
  }
  return estado;
}

function activarAutomatizaciones_(a) {
  var cfg = leerConfig_();
  var sh = configHoja_();
  var tz = zonaLibro_();
  var nuevo = {};
  if ('calendario' in a) nuevo.calendario = !!a.calendario;
  if ('resumen' in a) nuevo.resumen = !!a.resumen;
  if ('respaldo' in a) nuevo.respaldo = !!a.respaldo;
  if ('resumenHora' in a) {
    var h = Math.round(numero_(a.resumenHora));
    if (!(h >= 0 && h <= 23)) throw new Error('La hora del resumen debe estar entre 0 y 23.');
    nuevo.resumenHora = h;
  }
  if ('resumenEmail' in a) {
    var correos = [];
    String(a.resumenEmail || '').split(/[,;\s]+/).forEach(function (x) {
      if (x && correos.map(function (c) { return c.toLowerCase(); }).indexOf(x.toLowerCase()) < 0) correos.push(x);
    });
    if (correos.length > 3) throw new Error('Pon máximo 3 correos.');
    correos.forEach(function (c) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c) || c.length > 120) throw new Error('El correo "' + c + '" no parece válido.');
    });
    nuevo.resumenEmail = correos.join(', ');
  }
  var efectivo = {};
  Object.keys(cfg).forEach(function (k) { efectivo[k] = k in nuevo ? nuevo[k] : cfg[k]; });

  // Primero se instalan los disparadores (si falta un permiso falla aquí y no se guarda nada a medias).
  if ('resumen' in nuevo || 'resumenHora' in nuevo) {
    quitarGatillos_('resumenDiario');
    if (efectivo.resumen) {
      ScriptApp.newTrigger('resumenDiario').timeBased().everyDays(1).atHour(efectivo.resumenHora).inTimezone(tz).create();
    }
  }
  if ('respaldo' in nuevo) {
    quitarGatillos_('respaldoSemanal');
    if (efectivo.respaldo) {
      ScriptApp.newTrigger('respaldoSemanal').timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(3).inTimezone(tz).create();
    }
  }
  if (nuevo.calendario) calendario_(true);

  Object.keys(nuevo).forEach(function (k) { escribirConfig_(sh, k, nuevo[k]); });
  SpreadsheetApp.flush();
  var cfgFinal = leerConfig_();
  return { ok: true, config: cfgFinal, estado: estadoAutomatizaciones_(cfgFinal) };
}

/* Utilidades */

function buscarFila_(sh, id) {
  var n = Math.max(sh.getLastRow() - 1, 1);
  var ids = sh.getRange(2, COL.id, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  throw new Error('No encontré el pedido ' + id + ' en la hoja.');
}

function objetoDeFila_(sh, fila) {
  var vals = sh.getRange(fila, 1, 1, CAMPOS.length).getValues()[0];
  return filaAObjeto_(vals, zona_(sh), fila);
}

function filaAObjeto_(vals, tz, fila) {
  var o = { fila: fila };
  CAMPOS.forEach(function (c, i) {
    if (c.k === 'ref' || c.k === 'eventoId') return;
    var v = vals[i];
    if (esFecha_(v)) {
      v = Utilities.formatDate(v, tz, c.k === 'registrado' ? "yyyy-MM-dd'T'HH:mm" : 'yyyy-MM-dd');
    } else if (['cantidad', 'total', 'pago', 'debe'].indexOf(c.k) >= 0) {
      v = numero_(v);
    } else if (NUMEROS_OPCIONALES.indexOf(c.k) >= 0) {
      v = (v === '' || v === null || v === undefined || isNaN(Number(v))) ? '' : Number(v);
    } else {
      v = (v === null || v === undefined) ? '' : String(v);
    }
    o[c.k] = v;
  });
  return o;
}

function iso_(fecha, tz, conHora) {
  return Utilities.formatDate(fecha, tz, conHora ? "yyyy-MM-dd'T'HH:mm" : 'yyyy-MM-dd');
}

function mensajeError_(err) {
  var m = String(err && err.message ? err.message : err);
  if (/authoriz|permission|permiso|scope|not granted|no tienes acceso/i.test(m)) {
    m += ' (Parece que falta autorizar permisos: en el editor de Apps Script elige la función autorizarPermisos, toca Ejecutar y acepta. Después crea una nueva versión de la implementación.)';
  }
  return m;
}

function iguales_(a, b) {
  a = String(a === undefined || a === null ? '' : a);
  b = String(b === undefined || b === null ? '' : b);
  var d = a.length ^ b.length;
  var n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

function texto_(v, max) {
  var s = (v === null || v === undefined) ? '' : String(v);
  s = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, max || 200);
  // Evita que un texto que empiece con = + - @ se interprete como fórmula.
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function numero_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var n = parseInt(String(v === null || v === undefined ? '' : v).replace(/[^\d-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

// Número con decimales ("3,5" y "3.5" valen lo mismo). Para horas, gramos y precios por unidad.
function decimal_(v, decimales) {
  var n;
  if (typeof v === 'number') {
    n = v;
  } else {
    var s = String(v === null || v === undefined ? '' : v).replace(',', '.').replace(/[^\d.\-]/g, '');
    n = parseFloat(s);
  }
  if (!isFinite(n)) return 0;
  var f = Math.pow(10, decimales === undefined ? 2 : decimales);
  return Math.round(n * f) / f;
}

function numero_dec_(v) {
  var n = typeof v === 'number' ? v : parseFloat(v);
  return isFinite(n) ? n : 0;
}

function fecha_(s, tz) {
  if (!s) return '';
  try {
    return Utilities.parseDate(String(s).slice(0, 10), tz, 'yyyy-MM-dd');
  } catch (e) {
    return '';
  }
}

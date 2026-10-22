/*
  Yi Shu Studio - Registro de pedidos (Google Apps Script)

  Cómo instalarlo (se hace una sola vez):
  1. Abre script.google.com con la MISMA cuenta de Google dueña de la hoja y toca "Nuevo proyecto"
     (o desde la hoja: Extensiones > Apps Script, si te abre sin error).
  2. Borra lo que haya en el editor y pega todo este código.
  3. Cambia la CLAVE de abajo por una frase tuya. La misma la vas a pegar en la app.
  4. Arriba, elige la función "configurarHoja" y toca Ejecutar. Acepta los permisos.
     Eso crea la pestaña "Pedidos" con sus columnas.
  5. Implementar > Nueva implementación > tipo "Aplicación web".
     Ejecutar como: Yo. Quién tiene acceso: Cualquier persona. Toca Implementar.
  6. Copia la URL que termina en /exec y pégala en la app (ícono de ajustes) junto con la clave.

  Si más adelante cambias este código: Implementar > Administrar implementaciones >
  lápiz > Versión: Nueva versión > Implementar. La URL se mantiene igual.
*/

const CLAVE = 'CAMBIA-ESTA-CLAVE';
const NOMBRE_HOJA = 'Pedidos';
const PREFIJO_ID = 'YS-';

// ID de tu hoja de Google (la parte larga de su dirección, entre /d/ y /edit).
// Déjalo vacío si el script está dentro de la hoja (Extensiones > Apps Script).
// Si creaste el script aparte en script.google.com, pega aquí el ID de tu hoja.
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
  { k: 'ref',          h: 'Ref (uso interno)' }
];

const COL = {};
CAMPOS.forEach(function (c, i) { COL[c.k] = i + 1; });

const ESTADOS = ['Recibido', 'En producción', 'Listo para entrega', 'Enviado', 'Entregado', 'Cancelado'];

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
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (req.clave !== CLAVE) {
      throw new Error('La clave no coincide. Revisa que sea la misma en la app y en el script.');
    }
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sh = hoja_();
      switch (req.accion) {
        case 'ping':
          respuesta = { ok: true, hoja: NOMBRE_HOJA, pedidos: Math.max(sh.getLastRow() - 1, 0) };
          break;
        case 'listar':
          respuesta = { ok: true, pedidos: leerPedidos_(sh) };
          break;
        case 'crear':
          respuesta = { ok: true, pedido: crearPedido_(sh, req.pedido || {}) };
          break;
        case 'actualizar':
          respuesta = { ok: true, pedido: actualizarPedido_(sh, req) };
          break;
        case 'pagar':
          respuesta = { ok: true, pedido: registrarPago_(sh, req) };
          break;
        default:
          throw new Error('Acción desconocida: ' + req.accion);
      }
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    respuesta = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(respuesta))
    .setMimeType(ContentService.MimeType.JSON);
}

/* Ejecútala una vez desde el editor para crear la pestaña y dar permisos. */
function configurarHoja() {
  var sh = hoja_();
  SpreadsheetApp.flush();
  Logger.log('Hoja "' + sh.getName() + '" lista.');
}

/* Hoja */

function hoja_() {
  var ss = ID_HOJA ? SpreadsheetApp.openById(ID_HOJA) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(NOMBRE_HOJA);
  if (!sh) {
    var hojas = ss.getSheets();
    var vacia = hojas.length === 1 && hojas[0].getLastRow() === 0 && hojas[0].getLastColumn() === 0;
    sh = vacia ? hojas[0].setName(NOMBRE_HOJA) : ss.insertSheet(NOMBRE_HOJA);
  }
  if (sh.getLastRow() === 0) {
    prepararHoja_(sh);
  } else {
    var enc = sh.getRange(1, 1, 1, CAMPOS.length).getValues()[0];
    if (enc[0] !== CAMPOS[0].h || enc[CAMPOS.length - 1] !== CAMPOS[CAMPOS.length - 1].h) {
      throw new Error('La pestaña "' + NOMBRE_HOJA + '" ya tiene otras columnas. Usa una pestaña nueva o cambia NOMBRE_HOJA.');
    }
  }
  return sh;
}

function zona_(sh) {
  return sh.getParent().getSpreadsheetTimeZone();
}

function letra_(k) {
  return String.fromCharCode(64 + COL[k]);
}

function prepararHoja_(sh) {
  var n = CAMPOS.length;
  sh.getRange(1, 1, 1, n)
    .setValues([CAMPOS.map(function (c) { return c.h; })])
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#111111')
    .setWrap(true)
    .setVerticalAlignment('middle');
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 48);

  var filas = Math.max(sh.getMaxRows() - 1, 1);
  sh.getRange(2, COL.fecha, filas, 1).setNumberFormat('dd/mm/yyyy');
  sh.getRange(2, COL.entregaFecha, filas, 1).setNumberFormat('dd/mm/yyyy');
  sh.getRange(2, COL.registrado, filas, 1).setNumberFormat('dd/mm/yyyy hh:mm');
  ['total', 'pago', 'debe'].forEach(function (k) {
    sh.getRange(2, COL[k], filas, 1).setNumberFormat('$ #,##0');
  });

  var anchos = { id: 80, fecha: 105, cliente: 170, contacto: 140, canal: 140, producto: 190, cantidad: 80,
    detalles: 240, total: 110, pago: 110, debe: 110, estadoPago: 110, metodoPago: 130, entregaFecha: 115,
    entregaTipo: 120, entregaVia: 190, direccion: 240, estado: 150, notas: 240, registrado: 140 };
  Object.keys(anchos).forEach(function (k) { sh.setColumnWidth(COL[k], anchos[k]); });

  sh.getRange(2, COL.estado, filas, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).setAllowInvalid(false).build()
  );

  var regla = function (rango, texto, fondo, letra) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(texto).setBackground(fondo).setFontColor(letra).setRanges([rango]).build();
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
  if (!sh.getFilter()) {
    sh.getRange(1, 1, sh.getMaxRows(), n).createFilter();
  }
}

/* Acciones */

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
  poner('fecha', fecha_(p.fecha, tz) || new Date());
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
  poner('registrado', new Date());
  poner('ref', ref);

  sh.getRange(fila, 1, 1, CAMPOS.length).setValues([valores]);
  SpreadsheetApp.flush();
  return objetoDeFila_(sh, fila);
}

function actualizarPedido_(sh, req) {
  var fila = buscarFila_(sh, req.id);
  var tz = zona_(sh);
  var cambios = req.cambios || {};
  var permitidos = ['estado', 'fecha', 'entregaFecha', 'entregaTipo', 'entregaVia', 'direccion', 'notas'];
  var listos = {};
  // Primero se revisa todo; solo si todo está bien se escribe. Así un cambio inválido no deja el pedido a medias.
  Object.keys(cambios).forEach(function (k) {
    if (permitidos.indexOf(k) < 0) throw new Error('No se puede cambiar el campo: ' + k);
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
    } else {
      v = texto_(v, k === 'direccion' || k === 'notas' ? 600 : 100);
    }
    listos[k] = v;
  });
  Object.keys(listos).forEach(function (k) {
    sh.getRange(fila, COL[k]).setValue(listos[k]);
  });
  SpreadsheetApp.flush();
  return objetoDeFila_(sh, fila);
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
  return objetoDeFila_(sh, fila);
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
    if (c.k === 'ref') return;
    var v = vals[i];
    if (v instanceof Date) {
      v = Utilities.formatDate(v, tz, c.k === 'registrado' ? "yyyy-MM-dd'T'HH:mm" : 'yyyy-MM-dd');
    } else if (['cantidad', 'total', 'pago', 'debe'].indexOf(c.k) >= 0) {
      v = numero_(v);
    } else {
      v = (v === null || v === undefined) ? '' : String(v);
    }
    o[c.k] = v;
  });
  return o;
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

function fecha_(s, tz) {
  if (!s) return '';
  try {
    return Utilities.parseDate(String(s).slice(0, 10), tz, 'yyyy-MM-dd');
  } catch (e) {
    return '';
  }
}

/* Listas, chips y selects */
function pintarChips(contId, nombre, items, otroId, conOtro) {
  var cont = $('#' + contId);
  var previo = cont.querySelector('input:checked'); previo = previo ? previo.value : '';
  var todos = items.map(function (v) { return [v, v]; });
  if (conOtro) todos.push([OTRO, 'Otro']);
  cont.innerHTML = todos.map(function (p) {
    return '<label class="chip"><input type="radio" name="' + nombre + '" value="' + esc(p[0]) + '"><span>' + esc(p[1]) + '</span></label>';
  }).join('');
  if (previo) $$('input', cont).forEach(function (i) { if (i.value === previo) i.checked = true; });
  cont.onchange = function () {
    var sel = cont.querySelector('input:checked');
    if (otroId) $('#' + otroId).hidden = !(sel && sel.value === OTRO);
    if (otroId && sel && sel.value === OTRO) $('#' + otroId).focus();
  };
}
function pintarSelect(selId, items, placeholder) {
  var sel = $('#' + selId), previo = sel.value;
  sel.innerHTML = '<option value="">' + esc(placeholder) + '</option>' +
    items.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('') +
    '<option value="' + OTRO + '">Otro…</option>';
  if (previo && (previo === OTRO || items.indexOf(previo) >= 0)) sel.value = previo;
  sel.onchange = function () {
    var o = $('#' + selId + '-otro');
    o.hidden = sel.value !== OTRO;
    if (!o.hidden) o.focus();
  };
}
function valorChips(nombre, otroId) {
  var s = document.querySelector('input[name="' + nombre + '"]:checked');
  if (!s) return '';
  return s.value === OTRO ? $('#' + otroId).value.trim() : s.value;
}
function valorSelect(selId) {
  var sel = $('#' + selId);
  return sel.value === OTRO ? $('#' + selId + '-otro').value.trim() : sel.value;
}
function pintarListas() {
  repoblarItems();
  pintarChips('chips-canal', 'canal', S.listas.canales, 'canal-otro', true);
  pintarChips('chips-metodo', 'metodo', S.listas.metodos, 'metodo-otro', true);
  pintarSelect('transportadora', S.listas.transportadoras, 'Elige una opción');
  pintarChips('chips-pago-metodo', 'pagoMetodo', S.listas.metodos, 'pago-metodo-otro', true);
  var estadoPrevio = $('#estado').value;
  $('#estado').innerHTML = ESTADOS.map(function (e) { return '<option>' + esc(e) + '</option>'; }).join('');
  if (estadoPrevio) $('#estado').value = estadoPrevio;
  $('#dl-canales').innerHTML = S.listas.canales.map(function (v) { return '<option value="' + esc(v) + '">'; }).join('');
  $('#dl-transportadoras').innerHTML = S.listas.transportadoras.map(function (v) { return '<option value="' + esc(v) + '">'; }).join('');
  $('#dl-metodos').innerHTML = S.listas.metodos.map(function (v) { return '<option value="' + esc(v) + '">'; }).join('');
  pintarImpresoras('c-'); pintarImpresoras('ed-c-');
  pintarDatalistFichas();
}

/* Campos de dinero con puntos de miles mientras se escribe */
function ligarDinero(inp, alCambiar) {
  inp.addEventListener('input', function () {
    var pos = inp.selectionStart;
    var antes = inp.value.slice(0, pos == null ? inp.value.length : pos).replace(/\D/g, '').length;
    var d = inp.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    inp.value = d ? miles(parseInt(d, 10)) : '';
    var n = 0, i = 0;
    while (i < inp.value.length && n < antes) { if (/\d/.test(inp.value[i])) n++; i++; }
    try { inp.setSelectionRange(i, i); } catch (e) {}
    if (alCambiar) alCambiar();
  });
}
function ponerDinero(inp, n) { inp.value = n > 0 ? miles(n) : ''; }

/* Formulario: productos del pedido (uno o varios) */
var itemSeq = 0;
function poblarProducto(el) {
  var sel = $('.it-producto', el), actual = sel.value;
  sel.innerHTML = '<option value="">Elige la categoría</option>' +
    S.listas.productos.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('') +
    '<option value="' + OTRO + '">Otra…</option>';
  if (actual && (actual === OTRO || S.listas.productos.indexOf(actual) >= 0)) sel.value = actual;
  etiquetaCual(el);
  sel.onchange = function () { etiquetaCual(el); if (sel.value === OTRO) $('.it-cual', el).focus(); };
}
function etiquetaCual(el) {
  var otra = $('.it-producto', el).value === OTRO, i = $('.it-cual', el);
  $('.it-cual-lbl', el).innerHTML = otra ? '¿Qué producto es? <span class="req">*</span>' : '¿Cuál es? <span class="opc">(si quieres anotarlo)</span>';
  i.placeholder = otra ? 'Escribe el producto' : 'Ej: oni rojos, Stitch, ola japonesa';
}
function repoblarItems() { $$('#items [data-item]').forEach(poblarProducto); }
function actualizarItems() {
  var els = $$('#items [data-item]');
  $('#items').classList.toggle('multi', els.length > 1);
  els.forEach(function (el, i) {
    $('.item-titulo', el).textContent = 'Producto ' + (i + 1);
    $('.item-quitar', el).hidden = els.length < 2;
  });
}
function agregarItem() {
  var k = ++itemSeq, el = document.createElement('div');
  el.className = 'item'; el.setAttribute('data-item', '');
  el.innerHTML =
    '<div class="item-head"><span class="item-titulo">Producto</span><button type="button" class="btn small ghost item-quitar">Quitar</button></div>' +
    '<div class="grid2 collapse">' +
      '<div class="field"><label for="it-prod-' + k + '">Categoría <span class="req">*</span></label>' +
        '<select class="it-producto" id="it-prod-' + k + '"></select></div>' +
      '<div class="field"><span class="lbl" id="it-lbl-' + k + '">Cantidad</span>' +
        '<div class="stepper"><button type="button" class="it-menos" aria-label="Una menos">&minus;</button>' +
        '<input type="number" class="it-cant" min="1" max="999" value="1" inputmode="numeric" aria-labelledby="it-lbl-' + k + '">' +
        '<button type="button" class="it-mas" aria-label="Una más">+</button></div></div>' +
    '</div>' +
    '<div class="field"><label for="it-cual-' + k + '" class="it-cual-lbl">¿Cuál es?</label>' +
      '<input type="text" class="it-cual" id="it-cual-' + k + '" autocomplete="off" maxlength="80">' +
      '<p class="err it-err"></p></div>' +
    '<div class="field"><label for="it-det-' + k + '">Detalles (color, tamaño, personalización)</label>' +
      '<textarea class="it-detalles" id="it-det-' + k + '" rows="2"></textarea></div>';
  $('#items').appendChild(el);
  poblarProducto(el); actualizarItems();
  return el;
}
function leerItems() {
  return $$('#items [data-item]').map(function (el) {
    var cat = $('.it-producto', el).value, cual = $('.it-cual', el).value.trim(), cant = parseInt($('.it-cant', el).value, 10);
    return {
      el: el, cat: cat, cual: cual,
      nombre: cat === OTRO ? cual : (cual ? cat + ' (' + cual + ')' : cat),
      cantidad: cant > 0 ? cant : 1,
      detalles: $('.it-detalles', el).value.trim()
    };
  });
}
/* Un pedido siempre es una sola fila en la hoja. Con varios productos se unen con " + ". */
function componerProductos(items) {
  if (items.length === 1) return { producto: items[0].nombre, cantidad: items[0].cantidad, detalles: items[0].detalles };
  return {
    producto: items.map(function (i) { return i.nombre + (i.cantidad > 1 ? ' x' + i.cantidad : ''); }).join(' + '),
    cantidad: items.reduce(function (a, i) { return a + i.cantidad; }, 0),
    detalles: items.filter(function (i) { return i.detalles; }).map(function (i) { return i.nombre + ': ' + i.detalles; }).join(' | ')
  };
}
function textoProducto(p) {
  var t = String(p.producto || '');
  return t.indexOf(' + ') >= 0 ? t : t + (p.cantidad > 1 ? ' × ' + p.cantidad : '');
}
function onItemsClick(ev) {
  var b = ev.target.closest('button'); if (!b) return;
  var el = b.closest('[data-item]'); if (!el) return;
  var cant = $('.it-cant', el);
  if (b.classList.contains('it-menos')) cant.value = Math.max(1, (parseInt(cant.value, 10) || 1) - 1);
  else if (b.classList.contains('it-mas')) cant.value = Math.min(999, (parseInt(cant.value, 10) || 1) + 1);
  else if (b.classList.contains('item-quitar')) {
    var it = leerItems().filter(function (x) { return x.el === el; })[0];
    if ($$('#items [data-item]').length < 2) return;
    if ((it.nombre || it.detalles) && !confirm('¿Quitar este producto del pedido?')) return;
    el.remove(); actualizarItems();
  }
}

/* Formulario: saldo */
function actualizarSaldo() {
  var total = soloNumero($('#total').value), pago = soloNumero($('#pago').value);
  var box = $('#saldo'), t = $('#saldo-t'), v = $('#saldo-v');
  if (!total) { box.setAttribute('data-estado', 'vacio'); t.textContent = 'Saldo pendiente'; v.textContent = '—'; return; }
  if (pago > total) { box.setAttribute('data-estado', 'exceso'); t.textContent = 'Revisa los valores'; v.textContent = 'Lo pagado supera el total'; return; }
  if (pago === total) { box.setAttribute('data-estado', 'pagado'); t.textContent = 'Estado del pago'; v.textContent = 'Pagado completo'; return; }
  box.setAttribute('data-estado', 'debe'); t.textContent = pago > 0 ? 'Todavía debe' : 'Debe todo'; v.textContent = dinero(total - pago);
}

/* Formulario: entrega */
function actualizarEntrega() {
  var r = document.querySelector('input[name="entregaTipo"]:checked');
  var tipo = r ? r.value : '';
  $('#bloque-envio').hidden = tipo !== 'Envío';
  $('#bloque-recogida').hidden = tipo !== 'Recogida';
}

/* Formulario: leer y validar */
function leerFormulario(items) {
  var f = $('#form');
  var comp = componerProductos(items);
  var v = function (n) { return (f.elements[n] ? f.elements[n].value : '').trim(); };
  var tipo = (document.querySelector('input[name="entregaTipo"]:checked') || {}).value || '';
  return {
    cliente: v('cliente'), contacto: v('contacto'),
    canal: valorChips('canal', 'canal-otro'),
    producto: comp.producto, cantidad: comp.cantidad, detalles: comp.detalles,
    total: soloNumero($('#total').value), pago: soloNumero($('#pago').value),
    metodoPago: valorChips('metodo', 'metodo-otro'),
    entregaFecha: isoDeTexto(v('entregaFecha')) || '', entregaTipo: tipo,
    entregaVia: tipo === 'Envío' ? valorSelect('transportadora') : (tipo === 'Recogida' ? v('puntoRecogida') : ''),
    direccion: tipo === 'Envío' ? v('direccion') : '',
    fecha: isoDeTexto(v('fecha')) || hoyISO(), estado: v('estado') || 'Recibido', notas: v('notas')
  };
}
function leerFormularioCompleto(items) {
  var d = leerFormulario(items);
  if (esV3()) {
    var c = leerCostos('c-');
    Object.keys(c).forEach(function (k) { if (c[k] !== '') d[k] = c[k]; });
  }
  return d;
}
function validar(d, items) {
  var e = [];
  if (!d.cliente) e.push({ campo: 'cliente', msg: 'Escribe el nombre del cliente.' });
  if (!d.canal) e.push({ campo: 'canal', msg: 'Elige por dónde nos contactó.' });
  items.forEach(function (it, i) {
    var n = items.length > 1 ? ' del producto ' + (i + 1) : '';
    if (!it.cat) e.push({ campo: 'producto', itemEl: it.el, donde: 'cat', msg: 'Elige la categoría' + n + '.' });
    else if (it.cat === OTRO && !it.cual) e.push({ campo: 'producto', itemEl: it.el, donde: 'cual', msg: 'Escribe qué producto es' + n + '.' });
  });
  if (d.producto.length > 160 || d.detalles.length > 600) e.push({ campo: 'items', msg: 'Son demasiados productos o detalles para una sola fila de la hoja. Divide el pedido en dos.' });
  if (!d.total) e.push({ campo: 'total', msg: 'Escribe el valor total.' });
  if (d.pago > d.total && d.total) e.push({ campo: 'pago', msg: 'Lo pagado no puede ser más que el total.' });
  var ftxt = $('#fecha').value.trim(), etxt = $('#entregaFecha').value.trim();
  var msgFecha = 'Escribe la fecha como día/mes/año, por ejemplo 21/10/2026.';
  if (ftxt && !isoDeTexto(ftxt)) e.push({ campo: 'fecha', msg: msgFecha });
  if (!etxt) e.push({ campo: 'entregaFecha', msg: 'Elige la fecha de entrega.' });
  else if (!isoDeTexto(etxt)) e.push({ campo: 'entregaFecha', msg: msgFecha });
  if (!d.entregaTipo) e.push({ campo: 'entregaTipo', msg: 'Elige si es envío o recogida.' });
  if (d.entregaTipo === 'Envío' && !d.entregaVia) e.push({ campo: 'transportadora', msg: 'Elige por dónde se envía.' });
  if (esV3()) {
    if (!decimalOk($('#c-horas').value)) e.push({ campo: 'c-horas', msg: 'Escribe solo el número, por ejemplo 3,5.' });
    if (!decimalOk($('#c-gramos').value)) e.push({ campo: 'c-gramos', msg: 'Escribe solo el número, por ejemplo 120.' });
  }
  return e;
}
function mostrarErrores(errs) {
  $$('.err[data-for], .it-err').forEach(function (p) { p.textContent = ''; });
  $$('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
  errs.forEach(function (x) {
    if (x.itemEl) {
      $('.it-err', x.itemEl).textContent = x.msg;
      $(x.donde === 'cual' ? '.it-cual' : '.it-producto', x.itemEl).setAttribute('aria-invalid', 'true');
      return;
    }
    var p = $('.err[data-for="' + x.campo + '"]'); if (p) p.textContent = x.msg;
    var el = $('#' + x.campo); if (el && el.matches('input,select,textarea')) el.setAttribute('aria-invalid', 'true');
  });
  if (errs.length) {
    var x0 = errs[0], primero;
    if (x0.itemEl) primero = $(x0.donde === 'cual' ? '.it-cual' : '.it-producto', x0.itemEl);
    else primero = $('#' + x0.campo) || $('.err[data-for="' + x0.campo + '"]');
    var det = primero && primero.closest ? primero.closest('details') : null; if (det) det.open = true;
    if (primero) { primero.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (primero.focus) primero.focus({ preventScroll: true }); }
  }
}
function limpiarFormulario() {
  $('#form').reset();
  ['canal-otro', 'metodo-otro', 'transportadora-otro'].forEach(function (id) { $('#' + id).hidden = true; });
  $('#items').innerHTML = ''; agregarItem();
  ponerFecha('fecha', hoyISO());
  limpiarCostos('c-'); prellenarEmpaque();
  actualizarSaldo(); actualizarEntrega(); mostrarErrores([]);
}

/* Costos del pedido (versión 3). El mismo bloque sirve en "Nuevo pedido" y en "Editar". */
function htmlCostos(p) {
  var dinero_ = function (id, etiqueta) {
    return '<div class="field"><label for="' + p + id + '">' + etiqueta + '</label><div class="money"><input id="' + p + id + '" type="text" inputmode="numeric" autocomplete="off"></div></div>';
  };
  return '<div class="stack">' +
    '<div class="field" id="' + p + 'fichas-box" hidden>' +
      '<span class="lbl">Rellenar con una ficha de producto</span>' +
      '<div class="stack" id="' + p + 'fichas"></div>' +
      '<div class="acciones"><button type="button" class="btn small" id="' + p + 'ficha-add">+ Usar una ficha</button>' +
      '<button type="button" class="btn small ghost" id="' + p + 'ficha-guardar">Guardar estos números como ficha</button></div>' +
      '<p class="hint" id="' + p + 'ficha-hint"></p>' +
    '</div>' +
    '<div class="field"><label for="' + p + 'impresora">Impresora</label><select id="' + p + 'impresora"></select></div>' +
    '<div class="grid2">' +
      '<div class="field"><label for="' + p + 'horas">Horas de impresión</label><input id="' + p + 'horas" type="text" inputmode="decimal" placeholder="Ej: 3,5" autocomplete="off"><p class="err" data-for="' + p + 'horas"></p></div>' +
      '<div class="field"><label for="' + p + 'gramos">Gramos de filamento</label><input id="' + p + 'gramos" type="text" inputmode="decimal" placeholder="Ej: 120" autocomplete="off"><p class="err" data-for="' + p + 'gramos"></p></div>' +
    '</div>' +
    '<div class="grid2">' + dinero_('empaque', 'Empaque') + dinero_('envio', 'Envío que pagó el negocio') + '</div>' +
    dinero_('otros', 'Otros costos') +
    '<div class="saldo" id="' + p + 'resumen" data-estado="vacio" aria-live="polite"><span class="t">Costo y ganancia</span><span class="v">&mdash;</span></div>' +
    '<p class="hint" id="' + p + 'aviso"></p>' +
    '</div>';
}
function ligarCostos(p, totalFn) {
  var refrescar = function () { pintarResumenCostos(p, totalFn()); };
  TOTAL_FN[p] = totalFn;
  ['empaque', 'envio', 'otros'].forEach(function (k) { ligarDinero($('#' + p + k), refrescar); });
  ['horas', 'gramos'].forEach(function (k) { $('#' + p + k).addEventListener('input', refrescar); });
  $('#' + p + 'impresora').addEventListener('change', refrescar);
  $('#' + p + 'empaque').addEventListener('input', function () { this.dataset.tocado = '1'; });
  ligarFichasEnCostos(p);
}
function pintarImpresoras(p, actual) {
  var sel = $('#' + p + 'impresora'); if (!sel) return;
  var previo = actual !== undefined ? actual : sel.value;
  var nombres = (S.config.impresoras || []).map(function (i) { return i.nombre; });
  if (previo && nombres.indexOf(previo) < 0) nombres.push(previo);
  sel.innerHTML = '<option value="">Sin asignar</option>' + nombres.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
  sel.value = previo || '';
}
function leerCostos(p) {
  var m = function (id) { var d = $('#' + p + id).value.replace(/\D/g, ''); return d ? parseInt(d, 10) : ''; };
  var dec = function (id) { var t = $('#' + p + id).value.trim(); return t === '' ? '' : decimalDe(t); };
  return { impresora: $('#' + p + 'impresora').value, horas: dec('horas'), gramos: dec('gramos'),
    empaque: m('empaque'), envioNegocio: m('envio'), otros: m('otros') };
}
function ponerCostos(p, o) {
  o = o || {};
  reiniciarFichasEnCostos(p);                   // los valores que llegan son los definitivos: ninguna ficha los está llenando
  pintarImpresoras(p, o.impresora || '');
  $('#' + p + 'horas').value = o.horas === '' || o.horas == null ? '' : numTxt(o.horas);
  $('#' + p + 'gramos').value = o.gramos === '' || o.gramos == null ? '' : numTxt(o.gramos);
  ponerDinero($('#' + p + 'empaque'), Number(o.empaque) || 0);
  ponerDinero($('#' + p + 'envio'), Number(o.envioNegocio) || 0);
  ponerDinero($('#' + p + 'otros'), Number(o.otros) || 0);
}
function limpiarCostos(p) { ponerCostos(p, {}); $('#' + p + 'empaque').dataset.tocado = ''; pintarResumenCostos(p, soloNumero($('#total').value)); }
/* Si definiste un empaque por defecto, aparece ya escrito en cada pedido nuevo (lo puedes cambiar). */
function prellenarEmpaque() {
  var inp = $('#c-empaque'); if (!inp || !esV3()) return;
  if (inp.value === '' && !inp.dataset.tocado && Number(S.config.empaque) > 0) { ponerDinero(inp, Number(S.config.empaque)); pintarResumenCostos('c-', soloNumero($('#total').value)); }
}
/* Misma cuenta que hace el script al guardar. Aquí solo sirve para mostrarla mientras escribes. */
function calcularCostoLocal(c) {
  var n = function (v) { var x = parseFloat(v); return isFinite(x) ? x : 0; };
  if (!(n(c.horas) > 0 || n(c.gramos) > 0 || n(c.empaque) > 0 || n(c.envioNegocio) > 0 || n(c.otros) > 0)) return null;
  var ph = 0;
  (S.config.impresoras || []).forEach(function (i) { if (i.nombre === c.impresora) ph = n(i.costoHora); });
  return Math.round(n(c.gramos) * n(S.config.costoGramo) + n(c.horas) * ph + n(c.empaque) + n(c.envioNegocio) + n(c.otros));
}
function pintarResumenCostos(p, total) {
  var box = $('#' + p + 'resumen'), v = $('.v', box), av = $('#' + p + 'aviso');
  if (!box) return;
  var c = leerCostos(p), costo = calcularCostoLocal(c);
  var faltan = [];
  if (c.gramos > 0 && !(Number(S.config.costoGramo) > 0)) faltan.push('el costo por gramo');
  if (c.horas > 0) {
    var imp = (S.config.impresoras || []).filter(function (i) { return i.nombre === c.impresora; })[0];
    if (!c.impresora) faltan.push('la impresora');
    else if (!imp || !(Number(imp.costoHora) > 0)) faltan.push('el costo por hora de ' + c.impresora);
  }
  av.textContent = faltan.length ? 'Para que el costo sea real falta poner ' + faltan.join(' y ') + (c.impresora || c.gramos > 0 ? ' en Ajustes.' : '.') :
    'Todo esto es opcional. Lo puedes llenar después, cuando tengas las horas y los gramos reales.';
  if (costo === null) { box.setAttribute('data-estado', 'vacio'); v.textContent = '—'; return; }
  if (!total) { box.setAttribute('data-estado', 'debe'); v.textContent = 'Costo ' + dinero(costo); return; }
  var g = total - costo;
  box.setAttribute('data-estado', g >= 0 ? 'pagado' : 'exceso');
  v.textContent = (g >= 0 ? 'Ganancia ' : 'Pérdida ') + dinero(Math.abs(g)) + (g >= 0 ? ' · ' + Math.round(g * 100 / total) + '%' : '') + '  (costo ' + dinero(costo) + ')';
}

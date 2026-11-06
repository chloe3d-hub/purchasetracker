/* Fichas de costo: lo que lleva UNA unidad de cada producto (horas, gramos, impresora y componentes).
   Se guardan una vez y se usan en cada pedido, así no hay que volver a calcular lo mismo.
   Nada de esto inventa números: una ficha nueva arranca vacía y los precios salen de Ajustes. */

var TOTAL_FN = {};                              // prefijo del bloque de costos -> función que da el total del pedido

/* ---------- Lectura y cálculo ---------- */
function buscarFicha(id) { return S.fichas.filter(function (f) { return f.id === id; })[0] || null; }
function fichaPorNombre(nombre) {
  var n = String(nombre || '').trim().toLowerCase();
  return n ? (S.fichas.filter(function (f) { return String(f.nombre).toLowerCase() === n; })[0] || null) : null;
}
function precioHoraDe(impresora) {
  var r = 0;
  (S.config.impresoras || []).forEach(function (i) { if (i.nombre === impresora) r = Number(i.costoHora) || 0; });
  return r;
}
function costoDeComponente(nombre) {
  var c = (S.config.componentes || []).filter(function (x) { return x.nombre === nombre; })[0];
  return c ? (Number(c.costo) || 0) : null;
}
/* Costo de los componentes de UNA unidad. "faltan" son los que ya no están en la lista de Ajustes. */
function costoComponentes(f) {
  var total = 0, faltan = [];
  (f.componentes || []).forEach(function (c) {
    var u = costoDeComponente(c.nombre);
    if (u === null) faltan.push(c.nombre); else total += u * (Number(c.cantidad) || 1);
  });
  return { total: total, faltan: faltan };
}
/* Desglose del costo de UNA unidad con los precios de hoy */
function costoFicha(f) {
  var cg = Number(S.config.costoGramo) || 0, ph = precioHoraDe(f.impresora), cc = costoComponentes(f);
  var fil = (Number(f.gramos) || 0) * cg, imp = (Number(f.horas) || 0) * ph;
  return {
    filamento: fil, impresora: imp, componentes: cc.total, total: Math.round(fil + imp + cc.total), faltan: cc.faltan,
    sinGramo: Number(f.gramos) > 0 && !(cg > 0),
    sinHora: Number(f.horas) > 0 && !(ph > 0)
  };
}
function avisosCosto(c, f) {
  var a = [];
  if (c.sinGramo) a.push('falta el costo por gramo (Ajustes > Costos)');
  if (c.sinHora) a.push(f.impresora ? 'falta el costo por hora de ' + f.impresora : 'falta elegir la impresora para contar sus horas');
  if (Number(f.horas) > 0 && !(Number(f.gramos) > 0)) a.push('faltan los gramos');
  if (Number(f.gramos) > 0 && !(Number(f.horas) > 0)) a.push('faltan las horas');
  c.faltan.forEach(function (n) { a.push('"' + n + '" ya no está en la lista de componentes'); });
  return a;
}
function redondear(n, d) { var k = Math.pow(10, d); return Math.round((Number(n) || 0) * k) / k; }

/* ---------- Catálogo (solo para sugerir nombres) ---------- */
function limpiarCategoriaCatalogo(t) { return String(t || '').replace(/\s*\(\+18\)\s*/, '').trim(); }
function cargarCatalogo(forzar) {
  var c = S.catalogo;
  if (!forzar && c.productos && c.productos.length && Date.now() - (c.ts || 0) < 86400000) { pintarDatalistFichas(); return Promise.resolve(); }
  if (typeof fetch === 'undefined') return Promise.resolve();
  return fetch(CATALOGO_URL, { cache: 'no-cache' }).then(function (r) {
    if (!r.ok) throw new Error('http');
    return r.json();
  }).then(function (d) {
    var lista = [];
    (d.sections || []).forEach(function (s) {
      (s.products || []).forEach(function (p) {
        if (p && p.name) lista.push({ id: p.id, nombre: String(p.name), categoria: limpiarCategoriaCatalogo(s.label), precio: String(p.price || '') });
      });
    });
    if (lista.length) { S.catalogo = { ts: Date.now(), productos: lista }; guardar(LS.catalogo, S.catalogo); }
  }).catch(function () { /* sin conexión: se queda la última lista guardada */ }).then(function () {
    pintarDatalistFichas();
    if (S.vista === 'ajustes') pintarFichas();
  });
}
function productoCatalogoPorNombre(nombre) {
  var n = String(nombre || '').trim().toLowerCase();
  return n ? ((S.catalogo.productos || []).filter(function (p) { return p.nombre.toLowerCase() === n; })[0] || null) : null;
}
function productoCatalogoPorId(id) {
  return (S.catalogo.productos || []).filter(function (p) { return String(p.id) === String(id); })[0] || null;
}
function pintarDatalistFichas() {
  var dc = $('#dl-catalogo'), dp = $('#dl-cat-prod');
  if (dc) dc.innerHTML = (S.catalogo.productos || []).map(function (p) { return '<option value="' + esc(p.nombre) + '">'; }).join('');
  if (dp) dp.innerHTML = (S.listas.productos || []).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('');
}

/* ---------- Dentro de un pedido (nuevo y editar): filas de fichas ---------- */
function opcionesFichas(sel) {
  var previo = sel.value;
  var fs = S.fichas.slice().sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre), 'es'); });
  sel.innerHTML = '<option value="">Elige una ficha</option>' + fs.map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.nombre) + '</option>'; }).join('');
  if (previo && buscarFicha(previo)) sel.value = previo;
}
function agregarFilaFicha(p, fichaId, cant) {
  var fila = document.createElement('div'); fila.className = 'ficha-fila';
  fila.innerHTML = '<select class="ff-sel" aria-label="Ficha de producto"></select>' +
    '<label class="ff-cant-l"><span>×</span><input class="ff-cant" type="number" min="1" max="999" step="1" value="' + (cant || 1) + '" inputmode="numeric" aria-label="Cuántas unidades"></label>' +
    '<button type="button" class="btn small ghost ff-quitar" aria-label="Quitar esta ficha">Quitar</button>';
  $('#' + p + 'fichas').appendChild(fila);
  var sel = $('.ff-sel', fila); opcionesFichas(sel); if (fichaId) sel.value = fichaId;
  return fila;
}
function textoAyudaFichas(p) {
  var h = $('#' + p + 'ficha-hint'); if (!h || $$('#' + p + 'fichas .ficha-fila').length) return;
  h.textContent = S.fichas.length
    ? 'Elige una ficha y se llenan solas las horas, los gramos y los componentes. Después puedes cambiar los números.'
    : 'Todavía no tienes fichas. Crea la primera con "Guardar estos números como ficha" o en Ajustes.';
}
function pintarBloqueFichas(p) {
  var box = $('#' + p + 'fichas-box'); if (!box) return;
  box.hidden = !esV4();
  $$('#' + p + 'fichas .ff-sel').forEach(opcionesFichas);
  textoAyudaFichas(p);
}
function pintarBloquesFichas() { pintarBloqueFichas('c-'); pintarBloqueFichas('ed-c-'); }

/* Un campo que llena la ficha recuerda cuánto puso ella (data-auto). Si después se cambia de ficha, lo que escribiste
   a mano encima se conserva. Si todavía ninguna ficha lo había llenado y no hay nada que poner, el campo no se toca. */
function ponerAuto(el, nuevo, esDinero) {
  var tiene = el.dataset.auto !== undefined && el.dataset.auto !== '';
  if (!tiene && !(nuevo > 0)) return;
  var actual = esDinero ? soloNumero(el.value) : decimalDe(el.value);
  var manual = tiene ? Math.max(0, actual - Number(el.dataset.auto)) : 0;
  var total = redondear(nuevo + manual, 2);
  el.dataset.auto = String(nuevo);
  if (esDinero) ponerDinero(el, Math.round(total)); else el.value = total > 0 ? numTxt(total) : '';
}
function reiniciarFichasEnCostos(p) {
  var cont = $('#' + p + 'fichas'); if (cont) cont.innerHTML = '';
  ['horas', 'gramos', 'otros', 'impresora'].forEach(function (k) { var el = $('#' + p + k); if (el) delete el.dataset.auto; });
  textoAyudaFichas(p);
}
function aplicarFichas(p) {
  var filas = $$('#' + p + 'fichas .ficha-fila'), tot = { horas: 0, gramos: 0, otros: 0 }, porImp = {}, notas = [], usadas = 0;
  filas.forEach(function (fi) {
    var f = buscarFicha($('.ff-sel', fi).value); if (!f) return;
    var q = Math.max(1, parseInt($('.ff-cant', fi).value, 10) || 1);
    var h = (Number(f.horas) || 0) * q, cc = costoComponentes(f);
    usadas++;
    tot.horas += h; tot.gramos += (Number(f.gramos) || 0) * q; tot.otros += cc.total * q;
    if (f.impresora) porImp[f.impresora] = (porImp[f.impresora] || 0) + h;
    if (!(Number(f.horas) > 0) && !(Number(f.gramos) > 0)) notas.push('La ficha "' + f.nombre + '" todavía no tiene horas ni gramos.');
    cc.faltan.forEach(function (n) { notas.push('"' + n + '" ya no está en tu lista de componentes y no se sumó.'); });
  });
  ponerAuto($('#' + p + 'horas'), redondear(tot.horas, 2), false);
  ponerAuto($('#' + p + 'gramos'), redondear(tot.gramos, 1), false);
  ponerAuto($('#' + p + 'otros'), Math.round(tot.otros), true);
  var impEl = $('#' + p + 'impresora'), nombres = Object.keys(porImp);
  if (nombres.length) {
    var mejor = nombres.sort(function (a, b) { return porImp[b] - porImp[a]; })[0];
    if (impEl.value === '' || impEl.value === (impEl.dataset.auto || '')) { pintarImpresoras(p, mejor); impEl.dataset.auto = mejor; }
    if (nombres.length > 1) notas.push('Las fichas usan impresoras distintas (' + nombres.join(' y ') + '). Dejé ' + impEl.value + ': revisa que sea la correcta.');
  } else if (impEl.dataset.auto && impEl.value === impEl.dataset.auto) { impEl.value = ''; impEl.dataset.auto = ''; }
  var h = $('#' + p + 'ficha-hint');
  if (usadas) {
    h.textContent = 'Con las fichas: ' + numTxt(redondear(tot.horas, 2)) + ' h, ' + numTxt(redondear(tot.gramos, 1)) + ' g' +
      (tot.otros > 0 ? ' y componentes por ' + dinero(tot.otros) + ' (van en "Otros costos")' : '') + '. Puedes cambiar los números.' + (notas.length ? ' ' + notas.join(' ') : '');
  } else textoAyudaFichas(p);
  var tf = TOTAL_FN[p]; pintarResumenCostos(p, tf ? tf() : 0);
}
function ligarFichasEnCostos(p) {
  $('#' + p + 'ficha-add').addEventListener('click', function () {
    var fila = agregarFilaFicha(p); $('.ff-sel', fila).focus();
  });
  var cont = $('#' + p + 'fichas');
  cont.addEventListener('change', function (ev) { if (ev.target.matches('.ff-sel, .ff-cant')) aplicarFichas(p); });
  cont.addEventListener('input', function (ev) { if (ev.target.matches('.ff-cant')) aplicarFichas(p); });
  cont.addEventListener('click', function (ev) {
    var b = ev.target.closest('.ff-quitar'); if (!b) return;
    b.closest('.ficha-fila').remove(); aplicarFichas(p);
  });
  $('#' + p + 'ficha-guardar').addEventListener('click', function () { guardarNumerosComoFicha(p); });
}

/* Convierte lo que hay escrito en un pedido en la base de una ficha (dividido entre las unidades del pedido) */
function categoriaDeProducto(texto) {
  var m = /^(.*?)\s*\(/.exec(String(texto || '')), cat = (m ? m[1] : String(texto || '')).trim();
  return (S.listas.productos || []).indexOf(cat) >= 0 ? cat : '';
}
function baseFicha(nombre, categoria, impresora, horasTotal, gramosTotal, unidades) {
  var u = Math.max(1, unidades || 1);
  return { nombre: nombre, categoria: categoria, impresora: impresora || '',
    horas: horasTotal > 0 ? redondear(horasTotal / u, 2) : '', gramos: gramosTotal > 0 ? redondear(gramosTotal / u, 1) : '', unidades: u };
}
function guardarNumerosComoFicha(p) {
  var c = leerCostos(p), base;
  if (!(Number(c.horas) > 0) && !(Number(c.gramos) > 0)) { toast('Primero escribe las horas o los gramos de la impresión.', 'error'); return; }
  if (p === 'c-') {
    var items = leerItems(), uno = items.length === 1;
    base = baseFicha(uno ? items[0].nombre : '', uno && items[0].cat !== OTRO ? items[0].cat : '', c.impresora, Number(c.horas) || 0, Number(c.gramos) || 0, uno ? items[0].cantidad : 1);
    base.nota = uno ? '' : 'Este pedido tiene varios productos: pon el nombre del producto y revisa las horas y los gramos de una sola unidad.';
  } else {
    var prod = $('#ed-producto').value.trim(), solo = prod && prod.indexOf(' + ') < 0, cant = parseInt($('#ed-cantidad').value, 10) || 1;
    base = baseFicha(solo ? prod : '', solo ? categoriaDeProducto(prod) : '', c.impresora, Number(c.horas) || 0, Number(c.gramos) || 0, solo ? cant : 1);
    base.nota = solo ? '' : 'Este pedido tiene varios productos: pon el nombre del producto y revisa las horas y los gramos de una sola unidad.';
  }
  abrirFicha(base);
}

/* Al guardar un pedido de un solo producto con horas o gramos que no tiene ficha, se ofrece guardarla */
function sugerirFicha(d, items) {
  if (!esV4() || items.length !== 1 || $$('#c-fichas .ficha-fila').length) return null;
  var h = Number(d.horas) || 0, g = Number(d.gramos) || 0;
  if (!(h > 0) && !(g > 0)) return null;
  var nombre = items[0].nombre; if (!nombre || fichaPorNombre(nombre)) return null;
  var cp = productoCatalogoPorNombre(nombre);
  var b = baseFicha(nombre, items[0].cat !== OTRO ? items[0].cat : (cp ? cp.categoria : ''), d.impresora, h, g, items[0].cantidad);
  if (cp) b.catalogoId = cp.id;
  return b;
}

/* ---------- Diálogo de ficha ---------- */
var FICHA = { id: '', catalogoId: '' };
function opcionesComponentes(sel, actual) {
  var nombres = (S.config.componentes || []).map(function (c) { return c.nombre; });
  if (actual && nombres.indexOf(actual) < 0) nombres.push(actual);
  sel.innerHTML = '<option value="">Elige un componente</option>' + nombres.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
  sel.value = actual || '';
}
function agregarFilaCompFicha(nombre, cantidad) {
  var fila = document.createElement('div'); fila.className = 'ficha-fila fc-fila';
  fila.innerHTML = '<select class="fc-sel" aria-label="Componente"></select>' +
    '<label class="ff-cant-l"><span>×</span><input class="fc-cant" type="text" inputmode="decimal" value="' + esc(numTxt(cantidad || 1)) + '" aria-label="Cuántos lleva cada unidad"></label>' +
    '<button type="button" class="btn small ghost fc-quitar" aria-label="Quitar este componente">Quitar</button>';
  $('#f-comps').appendChild(fila);
  opcionesComponentes($('.fc-sel', fila), nombre || '');
  return fila;
}
function leerCompsFicha() {
  return $$('#f-comps .fc-fila').map(function (fi) {
    return { nombre: $('.fc-sel', fi).value, cantidad: decimalDe($('.fc-cant', fi).value), crudo: $('.fc-cant', fi).value };
  });
}
function fichaDelFormulario() {
  return {
    id: FICHA.id, nombre: $('#f-nombre').value.trim(), categoria: $('#f-categoria').value.trim(), impresora: $('#f-impresora').value,
    horas: $('#f-horas').value.trim() === '' ? '' : decimalDe($('#f-horas').value),
    gramos: $('#f-gramos').value.trim() === '' ? '' : decimalDe($('#f-gramos').value),
    minutos: $('#f-minutos').value.trim() === '' ? '' : decimalDe($('#f-minutos').value),
    componentes: leerCompsFicha().filter(function (c) { return c.nombre; }).map(function (c) { return { nombre: c.nombre, cantidad: c.cantidad > 0 ? c.cantidad : 1 }; }),
    notas: $('#f-notas').value.trim(), catalogoId: FICHA.catalogoId
  };
}
function pintarInfoCatalogo() {
  var p = FICHA.catalogoId ? productoCatalogoPorId(FICHA.catalogoId) : productoCatalogoPorNombre($('#f-nombre').value);
  $('#f-catalogo-info').textContent = p ? 'En el catálogo: ' + p.nombre + (p.precio ? ' · ' + p.precio : '') : '';
}
function pintarResumenFicha() {
  var f = fichaDelFormulario(), c = costoFicha(f), box = $('#f-resumen'), det = $('#f-resumen-det');
  var hay = (Number(f.horas) > 0) || (Number(f.gramos) > 0) || f.componentes.length;
  if (!hay) { box.setAttribute('data-estado', 'vacio'); $('.v', box).textContent = '—'; det.textContent = 'Escribe las horas, los gramos o los componentes para ver cuánto cuesta una unidad.'; return; }
  box.setAttribute('data-estado', 'debe'); $('.v', box).textContent = dinero(c.total);
  var av = avisosCosto(c, f);
  det.textContent = 'Filamento ' + dinero(c.filamento) + ' + impresora ' + dinero(c.impresora) + ' + componentes ' + dinero(c.componentes) + '.' +
    (av.length ? ' Ojo: ' + av.join('; ') + '. Eso cuenta como $0 hasta que lo llenes.' : '') + ' No incluye empaque ni envío.';
  var pp = calcularPrecio(entradaDeFicha(f, 1), preciosGuardados());
  if (!pp.error) det.textContent += ' Precio sugerido hoy: ' + dinero(pp.precio) + ' (con tus porcentajes de Ajustes > Precios y margen).';
}
function abrirFicha(datos) {
  datos = datos || {};
  var f = datos.id ? buscarFicha(datos.id) : null;
  FICHA = { id: f ? f.id : '', catalogoId: datos.catalogoId || (f ? f.catalogoId : '') || '' };
  $('#ficha-titulo').textContent = f ? 'Editar ficha' : 'Nueva ficha';
  var sub = $('#ficha-sub'); sub.textContent = '';
  if (!f && datos.unidades > 1) sub.textContent = 'Dividí los números entre las ' + datos.unidades + ' unidades del pedido. Una ficha guarda lo de UNA unidad.';
  if (datos.nota) sub.textContent = (sub.textContent ? sub.textContent + ' ' : '') + datos.nota;
  var src = f || datos;
  $('#f-nombre').value = src.nombre || ''; $('#f-categoria').value = src.categoria || '';
  var sel = $('#f-impresora'), nombres = (S.config.impresoras || []).map(function (i) { return i.nombre; });
  if (src.impresora && nombres.indexOf(src.impresora) < 0) nombres.push(src.impresora);
  sel.innerHTML = '<option value="">Sin asignar</option>' + nombres.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
  sel.value = src.impresora || '';
  $('#f-horas').value = src.horas === '' || src.horas == null ? '' : numTxt(src.horas);
  $('#f-gramos').value = src.gramos === '' || src.gramos == null ? '' : numTxt(src.gramos);
  $('#f-minutos').value = src.minutos === '' || src.minutos == null ? '' : numTxt(src.minutos);
  $('#f-minutos').disabled = !esV5(); $('#f-minutos-v4').hidden = esV5();
  $('#f-comps').innerHTML = '';
  (f ? f.componentes : []).forEach(function (c) { agregarFilaCompFicha(c.nombre, c.cantidad); });
  $('#f-comp-hint').textContent = (S.config.componentes || []).length ? '' : 'Todavía no tienes componentes. Créalos en Ajustes > Componentes y vuelve aquí.';
  $('#f-notas').value = src.notas || '';
  $('#f-eliminar').hidden = !f; $('#f-err').textContent = '';
  pintarDatalistFichas(); pintarInfoCatalogo(); pintarResumenFicha();
  abrir($('#dlg-ficha'));
  setTimeout(function () { $(src.nombre ? '#f-horas' : '#f-nombre').focus(); }, 50);
}
function onFichaNombre() {
  var p = productoCatalogoPorNombre($('#f-nombre').value);
  if (p) { FICHA.catalogoId = p.id; if (!$('#f-categoria').value.trim()) $('#f-categoria').value = p.categoria; }
  else FICHA.catalogoId = '';
  pintarInfoCatalogo(); pintarResumenFicha();
}
function onFicha(ev) {
  ev.preventDefault();
  var err = $('#f-err'), f = fichaDelFormulario(), msgs = [];
  if (!f.nombre) msgs.push('Escribe el nombre del producto.');
  var otra = fichaPorNombre(f.nombre); if (otra && otra.id !== FICHA.id) msgs.push('Ya existe una ficha con ese nombre. Ábrela desde la lista y edítala en vez de crear otra.');
  if (!decimalOk($('#f-horas').value)) msgs.push('Horas: escribe solo el número, por ejemplo 3,5.');
  if (!decimalOk($('#f-gramos').value)) msgs.push('Gramos: escribe solo el número, por ejemplo 120.');
  if (!decimalOk($('#f-minutos').value)) msgs.push('Minutos de trabajo: escribe solo el número, por ejemplo 30.');
  var vistos = {};
  leerCompsFicha().forEach(function (c) {
    if (!c.nombre) return;
    if (vistos[c.nombre]) msgs.push('El componente "' + c.nombre + '" está repetido.');
    vistos[c.nombre] = 1;
    if (!decimalOk(c.crudo) || !(decimalDe(c.crudo) > 0)) msgs.push('Cantidad de "' + c.nombre + '": escribe un número mayor que cero.');
  });
  err.textContent = msgs.join('\n'); if (msgs.length) return;
  var btn = $('#f-ok'); btn.disabled = true;
  api('ficha_guardar', { ficha: f }).then(function (r) {
    upsertFicha(r.ficha); cerrar($('#dlg-ficha')); toast('Ficha "' + r.ficha.nombre + '" guardada.');
    pintarBloquesFichas(); renderTodo(); if (S.vista === 'ajustes') pintarFichas();
  }, function (e) {
    err.textContent = scriptViejo(e) ? 'Tu hoja todavía tiene una versión anterior del script y no guarda fichas. Actualízalo (Ajustes > Cómo actualizar el script).' : e.message;
  }).then(function () { btn.disabled = false; });
}
function eliminarFichaActual() {
  var f = buscarFicha(FICHA.id); if (!f) return;
  if (!confirm('¿Borrar la ficha "' + f.nombre + '"? Los pedidos que ya la usaron conservan sus costos.')) return;
  api('ficha_eliminar', { id: f.id }).then(function () {
    S.fichas = S.fichas.filter(function (x) { return x.id !== f.id; }); guardarDatos();
    cerrar($('#dlg-ficha')); toast('Ficha borrada.'); pintarBloquesFichas(); renderTodo(); if (S.vista === 'ajustes') pintarFichas();
  }, function (e) { $('#f-err').textContent = e.message; });
}

/* ---------- Ajustes: lista de fichas, productos del catálogo sin ficha y sugerencias del historial ---------- */
function coincideBusqueda(txt, q) { return !q || String(txt).toLowerCase().indexOf(q) >= 0; }
function itemFicha(f) {
  var c = costoFicha(f), av = avisosCosto(c, f);
  var partes = [];
  var pp = (Number(f.horas) > 0 || Number(f.gramos) > 0 || (f.componentes || []).length) ? precioDeFicha(f) : null, cat = precioCatalogo(f);
  if (f.categoria) partes.push(f.categoria);
  if (f.impresora) partes.push(f.impresora);
  if (Number(f.horas) > 0) partes.push(numTxt(f.horas) + ' h');
  if (Number(f.gramos) > 0) partes.push(numTxt(f.gramos) + ' g');
  if (Number(f.minutos) > 0) partes.push(numTxt(f.minutos) + ' min de trabajo');
  var comp = (f.componentes || []).map(function (x) { return x.nombre + (Number(x.cantidad) !== 1 ? ' ×' + numTxt(x.cantidad) : ''); }).join(', ');
  var vacio = !(Number(f.horas) > 0) && !(Number(f.gramos) > 0) && !(f.componentes || []).length;
  return '<div class="ficha-item"><div class="fi-txt"><b>' + esc(f.nombre) + '</b>' +
    '<span class="hint">' + (partes.length ? esc(partes.join(' · ')) : 'Sin datos todavía') + (comp ? ' · ' + esc(comp) : '') + '</span>' +
    (vacio ? '' : '<span class="hint">Costo de una unidad hoy: <b>' + dinero(c.total) + '</b>' + (av.length ? ' (incompleto: ' + esc(av[0]) + ')' : '') + '</span>') +
    (pp && !pp.error ? '<span class="hint">Precio sugerido hoy: <b>' + dinero(pp.precio) + '</b>' + (cat ? ' · en el catálogo ' + dinero(cat) : '') + (preciosGuardados().propios ? '' : ' · con porcentajes de partida') + '</span>' : '') + '</div>' +
    '<div class="fi-acc">' + (vacio ? '' : '<button class="btn small" type="button" data-ficha-precio="' + esc(f.id) + '">Precio</button>') +
    '<button class="btn small ghost" type="button" data-ficha-editar="' + esc(f.id) + '">Editar</button></div></div>';
}
/* Pedidos anteriores con un solo producto y con horas o gramos anotados: se promedian por unidad */
function sugerenciasHistorial() {
  var grupos = {};
  S.cache.forEach(function (p) {
    var prod = String(p.producto || '').trim();
    if (!prod || prod.indexOf(' + ') >= 0 || p.estado === 'Cancelado') return;
    var h = Number(p.horas) || 0, g = Number(p.gramos) || 0; if (!(h > 0) && !(g > 0)) return;
    var k = prod.toLowerCase(), u = Math.max(1, Number(p.cantidad) || 1);
    var G = grupos[k] || (grupos[k] = { nombre: prod, n: 0, h: 0, nh: 0, g: 0, ng: 0, imps: {} });
    G.n++; if (h > 0) { G.h += h / u; G.nh++; } if (g > 0) { G.g += g / u; G.ng++; }
    if (p.impresora) G.imps[p.impresora] = (G.imps[p.impresora] || 0) + 1;
  });
  return Object.keys(grupos).map(function (k) {
    var G = grupos[k], imp = Object.keys(G.imps).sort(function (a, b) { return G.imps[b] - G.imps[a]; })[0] || '';
    return { nombre: G.nombre, n: G.n, horas: G.nh ? redondear(G.h / G.nh, 2) : '', gramos: G.ng ? redondear(G.g / G.ng, 1) : '', impresora: imp };
  }).filter(function (s) { return !fichaPorNombre(s.nombre); }).sort(function (a, b) { return b.n - a.n; });
}
function pintarFichas() {
  var v4 = esV4(), conectado = !!S.cfg.url;
  $('#aj-fichas-v3').hidden = v4 || !conectado;
  $('#aj-fichas-ok').hidden = !v4 && conectado;
  $('#aj-comp-v3').hidden = v4 || !conectado;
  $('#aj-comp-ok').hidden = !v4 && conectado;
  if (!v4 && conectado) return;
  var q = ($('#fichas-buscar').value || '').trim().toLowerCase();
  var lista = S.fichas.slice().sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre), 'es'); })
    .filter(function (f) { return coincideBusqueda(f.nombre + ' ' + f.categoria, q); });
  $('#fichas-lista').innerHTML = lista.length ? lista.map(itemFicha).join('') :
    '<div class="vacio">' + (S.fichas.length ? 'Ninguna ficha coincide con esa búsqueda.' : 'Todavía no hay fichas. Crea la primera con "Nueva ficha", o elige un producto del catálogo más abajo.') + '</div>';

  var hist = sugerenciasHistorial().filter(function (s) { return coincideBusqueda(s.nombre, q); });
  $('#fichas-hist-n').textContent = hist.length ? '(' + hist.length + ')' : '';
  $('#fichas-hist').innerHTML = hist.length ? '<p class="hint">Calculadas con los pedidos en los que anotaste horas o gramos (dividido entre las unidades de cada pedido). Revísalas antes de guardar.</p>' +
    hist.slice(0, 40).map(function (s, i) {
      var d = []; if (s.horas !== '') d.push(numTxt(s.horas) + ' h'); if (s.gramos !== '') d.push(numTxt(s.gramos) + ' g');
      return '<div class="ficha-item"><div class="fi-txt"><b>' + esc(s.nombre) + '</b><span class="hint">' + esc(plural(s.n, 'pedido', 'pedidos')) + ' · ' + esc(d.join(' y ')) + ' por unidad' + (s.impresora ? ' · ' + esc(s.impresora) : '') + '</span></div>' +
        '<button class="btn small" type="button" data-ficha-hist="' + i + '">Crear ficha</button></div>';
    }).join('') : '<p class="hint">' + (q ? 'Nada coincide con la búsqueda.' : 'Cuando anotes horas o gramos en tus pedidos, aquí aparecen sugerencias de fichas.') + '</p>';
  FICHAS_HIST = hist;

  var sin = (S.catalogo.productos || []).filter(function (p) {
    return !S.fichas.some(function (f) { return String(f.catalogoId) === String(p.id) || String(f.nombre).toLowerCase() === p.nombre.toLowerCase(); }) && coincideBusqueda(p.nombre + ' ' + p.categoria, q);
  });
  $('#fichas-sin-n').textContent = (S.catalogo.productos || []).length ? '(' + sin.length + ')' : '';
  $('#fichas-sin').innerHTML = !(S.catalogo.productos || []).length ? '<p class="hint">No pude traer la lista del catálogo (puede faltar internet). Puedes crear fichas escribiendo el nombre a mano.</p>' :
    (sin.length ? sin.slice(0, 80).map(function (p) {
      return '<div class="ficha-item"><div class="fi-txt"><b>' + esc(p.nombre) + '</b><span class="hint">' + esc(p.categoria) + (p.precio ? ' · ' + esc(p.precio) : '') + '</span></div>' +
        '<button class="btn small" type="button" data-ficha-cat="' + esc(p.id) + '">Crear ficha</button></div>';
    }).join('') + (sin.length > 80 ? '<p class="hint">Se muestran 80. Usa el buscador para encontrar los demás.</p>' : '') : '<p class="hint">Ya hay ficha para todos los productos' + (q ? ' que coinciden con la búsqueda' : ' del catálogo') + '.</p>');
}
var FICHAS_HIST = [];

/* ---------- Ajustes: componentes (luces, conectores, switches) ---------- */
function filaComponente(c) {
  c = c || {};
  var precio = c.precio != null ? c.precio : c.costo, unid = c.unidades != null ? c.unidades : (precio > 0 ? 1 : '');
  return '<div class="comp-fila" data-comp>' +
    '<div class="field"><label>Nombre<input type="text" class="cp-nombre" maxlength="60" autocomplete="off" value="' + esc(c.nombre || '') + '" placeholder="Ej: LED cálido"></label></div>' +
    '<div class="field"><label>Precio pagado<span class="money"><input type="text" class="cp-precio" inputmode="numeric" autocomplete="off" value="' + (Number(precio) > 0 ? miles(precio) : '') + '"></span></label></div>' +
    '<div class="field"><label>Unidades<input type="text" class="cp-unid" inputmode="decimal" autocomplete="off" value="' + (unid === '' ? '' : esc(numTxt(unid))) + '" placeholder="1"></label></div>' +
    '<button type="button" class="btn small ghost cp-quitar">Quitar</button>' +
    '<p class="hint cp-costo" role="status"></p></div>';
}
function textoCostoComp(fila) {
  var precio = soloNumero($('.cp-precio', fila).value), u = decimalDe($('.cp-unid', fila).value) || 1;
  $('.cp-costo', fila).textContent = precio > 0 ? 'Cada una cuesta ' + dinero(redondear(precio / u, 2)) + (redondear(precio / u, 2) % 1 ? ' (aprox.)' : '') : '';
}
function ligarFilaComp(fila) {
  ligarDinero($('.cp-precio', fila), function () { textoCostoComp(fila); });
  $('.cp-unid', fila).addEventListener('input', function () { textoCostoComp(fila); });
  textoCostoComp(fila);
}
function pintarComponentes() {
  var cont = $('#comp-lista');
  cont.innerHTML = (S.config.componentes || []).map(filaComponente).join('');
  $$('[data-comp]', cont).forEach(ligarFilaComp);
}
function guardarComponentes() {
  var filas = $$('#comp-lista [data-comp]'), comps = [], vistos = {}, mal = '';
  filas.forEach(function (f) {
    var nombre = $('.cp-nombre', f).value.trim(), pr = $('.cp-precio', f).value, un = $('.cp-unid', f).value;
    if (!nombre && !pr && !un) return;                                // fila vacía: se ignora
    if (!nombre) mal = 'Cada componente necesita un nombre.';
    else if (vistos[nombre.toLowerCase()]) mal = 'El componente "' + nombre + '" está repetido.';
    else if (!decimalOk(un) || (un.trim() !== '' && !(decimalDe(un) > 0))) mal = 'Unidades de "' + nombre + '": escribe un número mayor que cero.';
    else if (!soloNumero(pr)) mal = 'Escribe cuánto pagaste por "' + nombre + '".';
    vistos[nombre.toLowerCase()] = 1;
    comps.push({ nombre: nombre, precio: soloNumero(pr), unidades: decimalDe(un) || 1 });
  });
  if (mal) { toast(mal, 'error'); return Promise.resolve(); }
  return trabajando($('#comp-guardar'), 'Guardando…', function () {
    return api('config_guardar', { config: { componentes: comps } }).then(function (r) {
      S.config = Object.assign(clonar(CONFIG_BASE), r.config || {}); guardarDatos(); pintarComponentes(); pintarFichas();
      toast('Componentes guardados.');
    });
  }).catch(function (e) { toast(mensajeDe(e), 'error'); });
}
function quitarComponente(fila) {
  var nombre = $('.cp-nombre', fila).value.trim();
  var usan = nombre ? S.fichas.filter(function (f) { return (f.componentes || []).some(function (c) { return c.nombre === nombre; }); }).length : 0;
  if (usan && !confirm('"' + nombre + '" lo usan ' + plural(usan, 'ficha', 'fichas') + '. Si lo quitas, esas fichas dejan de contarlo hasta que lo vuelvas a crear. ¿Quitarlo?')) return;
  fila.remove();
}

/* ---------- Conexión de eventos ---------- */
function ligarFichas() {
  $('#ficha-nueva').addEventListener('click', function () { abrirFicha({}); });
  $('#fichas-buscar').addEventListener('input', pintarFichas);
  $('#fichas-lista').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-ficha-editar]'); if (b) abrirFicha({ id: b.dataset.fichaEditar });
  });
  $('#fichas-hist').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-ficha-hist]'); if (!b) return;
    var s = FICHAS_HIST[parseInt(b.dataset.fichaHist, 10)]; if (!s) return;
    var cp = productoCatalogoPorNombre(s.nombre);
    abrirFicha({ nombre: s.nombre, categoria: categoriaDeProducto(s.nombre) || (cp ? cp.categoria : ''), impresora: s.impresora, horas: s.horas, gramos: s.gramos, catalogoId: cp ? cp.id : '' });
  });
  $('#fichas-sin').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-ficha-cat]'); if (!b) return;
    var p = productoCatalogoPorId(b.dataset.fichaCat); if (p) abrirFicha({ nombre: p.nombre, categoria: p.categoria, catalogoId: p.id });
  });
  $('#form-ficha').addEventListener('submit', onFicha);
  $('#f-cancelar').addEventListener('click', function () { cerrar($('#dlg-ficha')); });
  $('#f-eliminar').addEventListener('click', eliminarFichaActual);
  $('#f-nombre').addEventListener('input', onFichaNombre);
  $('#f-nombre').addEventListener('change', onFichaNombre);
  ['f-horas', 'f-gramos', 'f-minutos'].forEach(function (id) { $('#' + id).addEventListener('input', pintarResumenFicha); });
  $('#f-impresora').addEventListener('change', pintarResumenFicha);
  $('#f-comp-add').addEventListener('click', function () { var fila = agregarFilaCompFicha(); $('.fc-sel', fila).focus(); pintarResumenFicha(); });
  $('#f-comps').addEventListener('change', pintarResumenFicha);
  $('#f-comps').addEventListener('input', pintarResumenFicha);
  $('#f-comps').addEventListener('click', function (ev) { var b = ev.target.closest('.fc-quitar'); if (b) { b.closest('.fc-fila').remove(); pintarResumenFicha(); } });
  /* Componentes (Ajustes) */
  $('#comp-agregar').addEventListener('click', function () {
    var d = document.createElement('div'); d.innerHTML = filaComponente({});
    var fila = d.firstChild; $('#comp-lista').appendChild(fila); ligarFilaComp(fila); $('.cp-nombre', fila).focus();
  });
  $('#comp-lista').addEventListener('click', function (ev) { var b = ev.target.closest('.cp-quitar'); if (b) quitarComponente(b.closest('[data-comp]')); });
  $('#comp-guardar').addEventListener('click', guardarComponentes);
  /* Sugerencia al guardar un pedido */
  $('#ok-ficha-btn').addEventListener('click', function () {
    var s = S.fichaSugerida; if (!s) return;
    cerrar($('#dlg-ok')); abrirFicha(s);
  });
  ligarListaFichas();
  cargarCatalogo(false);
}

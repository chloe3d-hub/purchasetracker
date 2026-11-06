/* Pegar una lista de productos ("Batman 250,55 g 8,5 h") y crear varias fichas de una vez.
   Usa la misma acción ficha_guardar que el diálogo de una ficha, así que no necesita script nuevo. */

var LISTA_FICHAS = { n: 0 };

/* Saca el primer "número + unidad" que encuentre y lo borra del texto. Devuelve [número o '', texto sin eso]. */
function tomarMedida(texto, reUnidad) {
  var m = reUnidad.exec(texto);
  if (!m) return ['', texto];
  return [parseFloat(m[1].replace(',', '.')), (texto.slice(0, m.index) + ' ' + texto.slice(m.index + m[0].length))];
}

/* Una línea como "Máscara carnaval 3h 35.76g" o "Lámpara 8h 30m" -> { nombre, gramos, horas } (vacío si no lo dice) */
function leerLineaProducto(linea) {
  var t = String(linea || '').replace(/^\s*(?:[-•*·]|\d+[.)])\s+/, '').trim();
  if (!t) return null;
  var NUM = '(\\d+(?:[.,]\\d+)?)', FIN = '(?![A-Za-zÁÉÍÓÚáéíóúÑñ])';
  var g = tomarMedida(t, new RegExp(NUM + '\\s*(?:gramos?|grs?|g)' + FIN, 'i')); t = g[1];
  var h = tomarMedida(t, new RegExp(NUM + '\\s*(?:horas?|hrs?|h)' + FIN, 'i')); t = h[1];
  var mi = tomarMedida(t, new RegExp(NUM + '\\s*(?:minutos?|mins?|m)' + FIN, 'i')); t = mi[1];
  var horas = '';
  if (h[0] !== '' || mi[0] !== '') horas = Math.round(((h[0] === '' ? 0 : h[0]) + (mi[0] === '' ? 0 : mi[0] / 60)) * 100) / 100;
  var nombre = t.replace(/[\s,;:|·\-–]+$/, '').replace(/^[\s,;:|·\-–]+/, '').replace(/\s{2,}/g, ' ').trim();
  if (nombre) nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1);
  return { nombre: nombre, gramos: g[0], horas: horas };
}

function horasEnTexto(h) {            // 9,3 -> "9 h 18 min", para que ella vea cómo se leyó
  h = Number(h); if (!(h > 0)) return '';
  var total = Math.round(h * 60), hh = Math.floor(total / 60), mm = total % 60;
  return (hh ? hh + ' h' : '') + (hh && mm ? ' ' : '') + (mm ? mm + ' min' : '');
}

function opcionesImpresorasLista(sel, valor) {
  var nombres = (S.config.impresoras || []).map(function (i) { return i.nombre; });
  sel.innerHTML = '<option value="">Sin elegir todavía</option>' + nombres.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
  sel.value = valor || '';
}

function filaLista(f) {
  var el = document.createElement('div'); el.className = 'fl-fila'; el.dataset.fl = String(++LISTA_FICHAS.n);
  el.innerHTML =
    '<input class="fl-nombre" type="text" value="' + esc(f.nombre) + '" aria-label="Nombre del producto" autocomplete="off">' +
    '<div class="fl-num">' +
      '<label>Gramos (1 unidad)<input class="fl-g" type="text" inputmode="decimal" value="' + esc(f.gramos === '' ? '' : numTxt(f.gramos)) + '"></label>' +
      '<label>Horas (1 unidad)<input class="fl-h" type="text" inputmode="decimal" value="' + esc(f.horas === '' ? '' : numTxt(f.horas)) + '"></label>' +
    '</div>' +
    '<div class="fl-hh hint"></div>' +
    '<select class="fl-imp" aria-label="Impresora"></select>' +
    '<div class="fl-pie"><span class="fl-st" role="status"></span><button type="button" class="btn small ghost fl-quitar">Quitar</button></div>';
  opcionesImpresorasLista($('.fl-imp', el), f.impresora || '');
  return el;
}

/* Revisa una fila y escribe su estado. Devuelve true si se puede guardar. */
function estadoFilaLista(el, vistos) {
  var nombre = $('.fl-nombre', el).value.trim(), gt = $('.fl-g', el).value, ht = $('.fl-h', el).value;
  var st = $('.fl-st', el), hh = $('.fl-hh', el), msgs = [], bloquea = false;
  var h = decimalDe(ht);
  hh.textContent = decimalOk(ht) && h > 0 ? 'Leí ' + numTxt(h) + ' h, o sea ' + horasEnTexto(h) + '.' : '';
  if (!nombre) { msgs.push('Falta el nombre.'); bloquea = true; }
  else if (fichaPorNombre(nombre)) { msgs.push('Ya existe una ficha con este nombre: se deja como está. Si cambió, edítala en la lista.'); bloquea = true; }
  else if (vistos[nombre.toLowerCase()]) { msgs.push('Este nombre está repetido en la lista.'); bloquea = true; }
  if (nombre) vistos[nombre.toLowerCase()] = 1;
  if (!decimalOk(gt) || !decimalOk(ht)) { msgs.push('Gramos y horas: escribe solo el número, por ejemplo 3,5.'); bloquea = true; }
  else if (gt.trim() === '' && ht.trim() === '') { msgs.push('No encontré horas ni gramos en esta línea.'); bloquea = true; }
  else {
    if (gt.trim() === '') msgs.push('Sin gramos: el filamento no se cuenta hasta que los agregues.');
    if (ht.trim() === '') msgs.push('Sin horas: el costo por hora no se cuenta hasta que las agregues.');
    if (decimalDe(gt) > 1000) msgs.push('Más de 1.000 g: revisa que el punto no sea de miles.');
  }
  st.textContent = msgs.join(' ');
  el.classList.toggle('fl-no', bloquea);
  return !bloquea;
}

function revisarListaPegada() {
  var lineas = $('#fl-texto').value.split(/\r?\n/), filas = [], prev = $('#fl-prev'), cont = $('#fl-filas');
  lineas.forEach(function (l) { var f = leerLineaProducto(l); if (f) filas.push(f); });
  cont.innerHTML = '';
  if (!filas.length) { prev.hidden = true; toast('Pega primero tu lista, una línea por producto.', 'error'); return; }
  filas.forEach(function (f) { cont.appendChild(filaLista(f)); });
  opcionesImpresorasLista($('#fl-imp-todas'), '');
  prev.hidden = false; refrescarListaPegada();
  prev.scrollIntoView({ block: 'nearest' });
}

function refrescarListaPegada() {
  var vistos = {}, buenas = 0, todas = $$('#fl-filas .fl-fila');
  todas.forEach(function (el) { if (estadoFilaLista(el, vistos)) buenas++; });
  var b = $('#fl-guardar');
  b.disabled = !buenas;
  b.textContent = buenas ? (buenas === 1 ? 'Guardar 1 ficha' : 'Guardar ' + buenas + ' fichas') : 'No hay fichas para guardar';
  $('#fl-resumen').textContent = todas.length + (todas.length === 1 ? ' línea leída. ' : ' líneas leídas. ') +
    'Revisa que los números estén bien: lo que no tiene horas ni gramos no se guarda.';
}

function guardarListaPegada() {
  var vistos = {}, trabajo = [];
  $$('#fl-filas .fl-fila').forEach(function (el) { if (estadoFilaLista(el, vistos)) trabajo.push(el); });
  if (!trabajo.length) return;
  var btn = $('#fl-guardar'), ok = 0, fallo = '';
  btn.disabled = true;
  var cadena = Promise.resolve();
  trabajo.forEach(function (el) {
    cadena = cadena.then(function () {
      if (fallo) return;
      var nombre = $('.fl-nombre', el).value.trim(), cp = productoCatalogoPorNombre(nombre);
      var gt = $('.fl-g', el).value.trim(), ht = $('.fl-h', el).value.trim();
      var ficha = { id: '', nombre: nombre, categoria: cp ? cp.categoria : categoriaDeProducto(nombre), impresora: $('.fl-imp', el).value,
        horas: ht === '' ? '' : decimalDe(ht), gramos: gt === '' ? '' : decimalDe(gt), componentes: [], notas: '', catalogoId: cp ? cp.id : '' };
      $('.fl-st', el).textContent = 'Guardando…';
      return api('ficha_guardar', { ficha: ficha }).then(function (r) {
        upsertFicha(r.ficha); ok++; el.remove();
      }, function (e) {
        $('.fl-st', el).textContent = scriptViejo(e) ? 'Tu hoja todavía tiene una versión anterior del script y no guarda fichas.' : e.message;
        if (scriptViejo(e) || e.codigo !== 'SERVIDOR') fallo = e.message;   // sin internet o script viejo: no sigas intentando
      });
    });
  });
  cadena.then(function () {
    pintarBloquesFichas(); renderTodo(); if (S.vista === 'ajustes') pintarFichas();
    if (ok) toast(ok === 1 ? 'Ficha guardada.' : ok + ' fichas guardadas.');
    if (!$$('#fl-filas .fl-fila').length) { $('#fl-prev').hidden = true; $('#fl-texto').value = ''; }
    else refrescarListaPegada();
    if (fallo) toast('No pude guardar todas: ' + fallo, 'error');
  });
}

function ligarListaFichas() {
  $('#fl-revisar').addEventListener('click', revisarListaPegada);
  $('#fl-guardar').addEventListener('click', guardarListaPegada);
  $('#fl-imp-todas').addEventListener('change', function (ev) {
    $$('#fl-filas .fl-imp').forEach(function (s) { s.value = ev.target.value; });
  });
  var cont = $('#fl-filas');
  cont.addEventListener('input', function (ev) { if (ev.target.matches('.fl-nombre, .fl-g, .fl-h')) refrescarListaPegada(); });
  cont.addEventListener('click', function (ev) {
    var b = ev.target.closest('.fl-quitar'); if (!b) return;
    b.closest('.fl-fila').remove();
    if ($$('#fl-filas .fl-fila').length) refrescarListaPegada(); else $('#fl-prev').hidden = true;
  });
}

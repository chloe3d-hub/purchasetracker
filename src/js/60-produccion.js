/* Producción: la cola de lo que hay que imprimir */
var ESTADOS_COLA = ['Recibido', 'En producción'];
function colaProduccion() {
  return S.cache.filter(function (p) { return ESTADOS_COLA.indexOf(p.estado) >= 0; });
}
function porUrgencia(a, b) {
  var fa = a.entregaFecha || '9999-12-31', fb = b.entregaFecha || '9999-12-31';
  return fa < fb ? -1 : fa > fb ? 1 : String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
}
function horasDe(lista) {
  var h = 0, sin = 0;
  lista.forEach(function (p) { if (typeof p.horas === 'number' && p.horas > 0) h += p.horas; else sin++; });
  return { horas: Math.round(h * 10) / 10, sin: sin };
}
function pintarResumenProd() {
  var cola = colaProduccion(), t = horasDe(cola);
  var porEmpezar = cola.filter(function (p) { return p.estado === 'Recibido'; }).length;
  var enProd = cola.length - porEmpezar;
  var listos = S.cache.filter(function (p) { return p.estado === 'Listo para entrega'; }).length;
  $('#prod-stats').innerHTML =
    '<div class="stat"><span class="t">Por empezar</span><span class="v">' + porEmpezar + '</span></div>' +
    '<div class="stat"><span class="t">En producción</span><span class="v">' + enProd + '</span></div>' +
    '<div class="stat"><span class="t">Horas pendientes</span><span class="v">' + numTxt(t.horas) + ' h</span>' + (t.sin && cola.length ? '<span class="s n">' + plural(t.sin, 'pedido sin horas', 'pedidos sin horas') + '</span>' : '') + '</div>' +
    '<div class="stat"><span class="t">Listos para entregar</span><span class="v">' + listos + '</span></div>';
}
function tarjetaProd(p) {
  var cu = cuandoEntrega(p), v3 = esV3();
  var nombres = (S.config.impresoras || []).map(function (i) { return i.nombre; });
  if (p.impresora && nombres.indexOf(p.impresora) < 0) nombres.push(p.impresora);
  var opts = '<option value="">Sin asignar</option>' + nombres.map(function (n) { return '<option' + (n === p.impresora ? ' selected' : '') + ' value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
  var dis = v3 ? '' : ' disabled';
  var boton = p.estado === 'Recibido'
    ? '<button class="btn small primary" type="button" data-prod-estado="En producción" data-id="' + esc(p.id) + '">Empezar a imprimir</button>'
    : '<button class="btn small primary" type="button" data-prod-estado="Listo para entrega" data-id="' + esc(p.id) + '">Ya está listo</button>';
  return '<article class="pedido" data-prod-id="' + esc(p.id) + '"><div class="pedido-top"><div><p class="id">' + esc(p.id) + ' · ' + esc(fechaCorta(p.entregaFecha) || 'sin fecha') + ' · <span class="badge ' + cu.clase + '">' + esc(cu.txt) + '</span></p>' +
    '<h3>' + esc(p.cliente) + '</h3><p class="prod">' + esc(textoProducto(p)) + '</p></div><div class="badges">' + badgeEstado(p) + '</div></div>' +
    (p.detalles ? '<p class="hint">' + esc(p.detalles) + '</p>' : '') +
    '<div class="prod-campos">' +
      '<div class="field"><label>Impresora<select data-prod="impresora"' + dis + '>' + opts + '</select></label></div>' +
      '<div class="field"><label>Horas<input data-prod="horas" type="text" inputmode="decimal" placeholder="Ej: 3,5" value="' + (typeof p.horas === 'number' ? esc(numTxt(p.horas)) : '') + '"' + dis + '></label></div>' +
      '<div class="field"><label>Gramos<input data-prod="gramos" type="text" inputmode="decimal" placeholder="Ej: 120" value="' + (typeof p.gramos === 'number' ? esc(numTxt(p.gramos)) : '') + '"' + dis + '></label></div>' +
    '</div>' + htmlFichaProd(p) +
    '<div class="acciones">' + boton + '<button class="btn small ghost" type="button" data-accion="editar" data-id="' + esc(p.id) + '">Editar</button></div></article>';
}
/* Fichas dentro de la cola: llenar impresora, horas y gramos con un toque, y guardar lo nuevo como ficha */
function unidadesDe(p) { return String(p.producto || '').indexOf(' + ') >= 0 ? 1 : Math.max(1, Number(p.cantidad) || 1); }
function htmlFichaProd(p) {
  if (!esV4()) return '';
  var fs = S.fichas.slice().sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre), 'es'); });
  var opts = '<option value="">' + (fs.length ? 'Usar una ficha…' : 'Aún no hay fichas') + '</option>' + fs.map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.nombre) + '</option>'; }).join('');
  var solo = String(p.producto || '').indexOf(' + ') < 0;
  var puede = solo && (Number(p.horas) > 0 || Number(p.gramos) > 0) && !fichaPorNombre(p.producto);
  return '<div class="prod-ficha"><select data-prod-ficha aria-label="Usar una ficha de producto"' + (fs.length ? '' : ' disabled') + '>' + opts + '</select>' +
    (puede ? '<button class="btn small ghost" type="button" data-prod-ficha-guardar data-id="' + esc(p.id) + '">Guardar como ficha</button>' : '') + '</div>';
}
function usarFichaEnProduccion(id, fichaId, el) {
  var p = buscarPedido(id), f = buscarFicha(fichaId); if (!p || !f) return;
  var q = unidadesDe(p), cc = costoComponentes(f), cambios = {}, notas = [];
  if (Number(f.horas) > 0) cambios.horas = redondear(f.horas * q, 2);
  if (Number(f.gramos) > 0) cambios.gramos = redondear(f.gramos * q, 1);
  if (f.impresora) cambios.impresora = f.impresora;
  if (cc.total > 0) {
    if (!(Number(p.otros) > 0)) cambios.otros = Math.round(cc.total * q);
    else notas.push('No toqué "Otros costos" porque ya tenía ' + dinero(p.otros) + ' (los componentes de la ficha suman ' + dinero(cc.total * q) + ').');
  }
  cc.faltan.forEach(function (n) { notas.push('"' + n + '" ya no está en tu lista de componentes y no se sumó.'); });
  if (!Object.keys(cambios).length) { toast('Esa ficha todavía no tiene horas, gramos ni componentes.', 'error'); el.value = ''; return; }
  if (String(p.producto || '').indexOf(' + ') >= 0) notas.push('El pedido tiene varios productos: usé 1 unidad de la ficha. Ajusta los números si hace falta.');
  el.disabled = true;
  api('actualizar', { id: id, cambios: cambios }).then(function (r) {
    upsertCache(r.pedido); toast(id + ': ficha "' + f.nombre + '" aplicada.' + (notas.length ? ' ' + notas.join(' ') : '')); renderTodo();
  }, function (e) {
    toast(scriptViejo(e) ? 'Tu hoja usa una versión anterior del script. Actualízalo para guardar esto.' : e.message, 'error'); el.value = ''; el.disabled = false;
  });
}
function guardarFichaDePedido(id) {
  var p = buscarPedido(id); if (!p) return;
  var solo = String(p.producto || '').indexOf(' + ') < 0, cp = solo ? productoCatalogoPorNombre(p.producto) : null;
  var base = baseFicha(solo ? p.producto : '', solo ? (categoriaDeProducto(p.producto) || (cp ? cp.categoria : '')) : '', p.impresora, Number(p.horas) || 0, Number(p.gramos) || 0, unidadesDe(p));
  if (cp) base.catalogoId = cp.id;
  if (!solo) base.nota = 'Este pedido tiene varios productos: pon el nombre del producto y revisa los números de una sola unidad.';
  abrirFicha(base);
}
function renderProduccion() {
  pintarResumenProd();
  var cola = colaProduccion(), v3 = esV3();
  $('#prod-v2').hidden = v3 || !S.cfg.url;
  /* Filtro por impresora */
  var nombres = (S.config.impresoras || []).map(function (i) { return i.nombre; });
  cola.forEach(function (p) { if (p.impresora && nombres.indexOf(p.impresora) < 0) nombres.push(p.impresora); });
  if (S.prod.imp !== 'todas' && S.prod.imp !== '' && nombres.indexOf(S.prod.imp) < 0) S.prod.imp = 'todas';
  var carga = function (nombre) { var l = cola.filter(function (p) { return (p.impresora || '') === nombre; }); var t = horasDe(l); return { n: l.length, h: horasDe(l).horas, t: t }; };
  var chips = [['todas', 'Todas (' + cola.length + ')']];
  nombres.forEach(function (n) { var c = carga(n); chips.push([n, n + ' (' + c.n + (c.h ? ' · ' + numTxt(c.h) + ' h' : '') + ')']); });
  var sinAsignar = cola.filter(function (p) { return !p.impresora; }).length;
  chips.push(['', 'Sin asignar (' + sinAsignar + ')']);
  $('#prod-imp').innerHTML = v3 ? chips.map(function (c) {
    return '<label class="chip"><input type="radio" name="prod-imp" value="' + esc(c[0]) + '"' + (S.prod.imp === c[0] ? ' checked' : '') + '><span>' + esc(c[1]) + '</span></label>';
  }).join('') : '';
  var visibles = cola.filter(function (p) { return S.prod.imp === 'todas' || (p.impresora || '') === S.prod.imp; }).sort(porUrgencia);
  var enProd = visibles.filter(function (p) { return p.estado === 'En producción'; });
  var porEmp = visibles.filter(function (p) { return p.estado === 'Recibido'; });
  var listos = S.cache.filter(function (p) { return p.estado === 'Listo para entrega'; }).sort(porUrgencia);
  var html = '';
  if (enProd.length) html += '<h3 class="grupo">En producción</h3>' + enProd.map(tarjetaProd).join('');
  if (porEmp.length) html += '<h3 class="grupo">Por empezar, los más urgentes primero</h3>' + porEmp.map(tarjetaProd).join('');
  if (!enProd.length && !porEmp.length) html += '<div class="vacio">' + (cola.length ? 'No hay pedidos en esa impresora.' : 'No hay nada por imprimir. Cuando llegue un pedido nuevo aparece aquí.') + '</div>';
  if (listos.length) {
    html += '<h3 class="grupo">Listos para entregar (' + listos.length + ')</h3>' + listos.map(function (p) {
      var cu = cuandoEntrega(p);
      return '<div class="mini"><span><b>' + esc(p.cliente) + '</b> · ' + esc(textoProducto(p)) + '</span><span class="badge ' + cu.clase + '">' + esc(cu.txt) + '</span></div>';
    }).join('');
  }
  $('#prod-lista').innerHTML = html;
}
function guardarProd(id, campo, valor, el) {
  var p = buscarPedido(id); if (!p) return;
  if (campo !== 'impresora' && !decimalOk(valor)) {
    toast('Escribe solo el número, por ejemplo ' + (campo === 'horas' ? '3,5' : '120') + '.', 'error');
    el.value = typeof p[campo] === 'number' ? numTxt(p[campo]) : ''; return;
  }
  var nuevo = campo === 'impresora' ? valor : (valor.trim() === '' ? '' : decimalDe(valor));
  var antes = p[campo] == null ? '' : p[campo];
  if (!distinto(nuevo, antes)) return;
  var cambios = {}; cambios[campo] = nuevo;
  el.classList.add('guardando');
  api('actualizar', { id: id, cambios: cambios }).then(function (r) {
    upsertCache(r.pedido); pintarResumenProd();
    toast(id + ': ' + (campo === 'impresora' ? (nuevo || 'sin impresora') : (campo === 'horas' ? numTxt(nuevo) + ' h' : numTxt(nuevo) + ' g')) + ' guardado.');
    if (campo === 'impresora') renderProduccion();
  }, function (e) {
    toast(scriptViejo(e) ? 'Tu hoja usa una versión anterior del script. Actualízalo para guardar esto.' : e.message, 'error');
    el.value = campo === 'impresora' ? (p.impresora || '') : (typeof p[campo] === 'number' ? numTxt(p[campo]) : '');
  }).then(function () { el.classList.remove('guardando'); });
}
function ligarProduccion() {
  var lista = $('#prod-lista');
  lista.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.dataset && 'prodFicha' in el.dataset) {
      var card = el.closest('[data-prod-id]'); if (card && el.value) usarFichaEnProduccion(card.dataset.prodId, el.value, el);
      return;
    }
    var campo = el.dataset && el.dataset.prod; if (!campo) return;
    var art = el.closest('[data-prod-id]'); if (art) guardarProd(art.dataset.prodId, campo, el.value, el);
  });
  lista.addEventListener('click', function (ev) {
    var g = ev.target.closest('[data-prod-ficha-guardar]');
    if (g) { guardarFichaDePedido(g.dataset.id); return; }
    var b = ev.target.closest('[data-prod-estado]');
    if (b) { cambiarEstado(b.dataset.id, b.dataset.prodEstado); return; }
    onListaClick(ev);
  });
  $('#prod-imp').addEventListener('change', function (ev) { if (ev.target.name === 'prod-imp') { S.prod.imp = ev.target.value; renderProduccion(); } });
}

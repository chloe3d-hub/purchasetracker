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
    '</div>' +
    '<div class="acciones">' + boton + '<button class="btn small ghost" type="button" data-accion="editar" data-id="' + esc(p.id) + '">Editar</button></div></article>';
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
    var el = ev.target, campo = el.dataset && el.dataset.prod; if (!campo) return;
    var art = el.closest('[data-prod-id]'); if (art) guardarProd(art.dataset.prodId, campo, el.value, el);
  });
  lista.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-prod-estado]');
    if (b) { cambiarEstado(b.dataset.id, b.dataset.prodEstado); return; }
    onListaClick(ev);
  });
  $('#prod-imp').addEventListener('change', function (ev) { if (ev.target.name === 'prod-imp') { S.prod.imp = ev.target.value; renderProduccion(); } });
}

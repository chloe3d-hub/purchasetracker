/* Inicio: accesos directos, la calculadora de precio y lo que viene en entregas. */

function filaEntrega(p) {
  var cu = cuandoEntrega(p);
  var debe = (p.debe || 0) > 0 ? '<span class="badge b-warn">Debe ' + dinero(p.debe) + '</span>' : '';
  return '<div class="ent-fila"><div class="ent-t"><b>' + esc(p.cliente) + '</b><span>' + esc(textoProducto(p)) + '</span></div>' +
    '<div class="ent-d"><span class="badge ' + cu.clase + '">' + esc(cu.txt) + '</span>' + debe + '</div></div>';
}

function pintarInicio() {
  var activos = todosLosPedidos().filter(esActivo);
  var n = $('#ini-activos'); n.textContent = activos.length; n.hidden = !activos.length;
  var conFecha = activos.filter(function (p) { return p.entregaFecha && diasHasta(p.entregaFecha) !== null; })
    .sort(function (a, b) { return diasHasta(a.entregaFecha) - diasHasta(b.entregaFecha); });
  var cont = $('#ini-entregas');
  if (!activos.length) {
    cont.innerHTML = '<p class="hint">' + (S.cfg.url && S.cfg.clave
      ? 'No tienes pedidos por entregar. Cuando registres uno, aquí aparece lo que viene.'
      : 'Cuando conectes tu hoja y registres pedidos, aquí aparece lo que hay que entregar.') + '</p>';
    return;
  }
  var sinFecha = activos.length - conFecha.length;
  cont.innerHTML = conFecha.slice(0, 4).map(filaEntrega).join('') +
    (sinFecha ? '<p class="hint">' + (sinFecha === 1 ? '1 pedido activo no tiene fecha de entrega.' : sinFecha + ' pedidos activos no tienen fecha de entrega.') + '</p>' : '') +
    '<div class="acciones ini-pie"><button class="btn small" type="button" data-ir="pedidos">Ver ' + (activos.length === 1 ? 'el pedido activo' : 'los ' + activos.length + ' pedidos activos') + '</button></div>';
}

function ligarInicio() {
  $('#vista-inicio').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-ir]'); if (b) irA(b.dataset.ir);
  });
}

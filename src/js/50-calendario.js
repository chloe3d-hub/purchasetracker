/* Calendario de entregas (mes a mes, empieza en lunes) */
function entregasPorDia() {
  var mapa = {};
  S.cache.forEach(function (p) {
    if (!p.entregaFecha || p.estado === 'Cancelado') return;
    var k = String(p.entregaFecha).slice(0, 10);
    (mapa[k] = mapa[k] || []).push(p);
  });
  return mapa;
}
function renderCalendario() {
  var hoy = hoyISO();
  if (!S.cal.mes) S.cal.mes = hoy.slice(0, 7);
  if (!S.cal.dia) S.cal.dia = S.cal.mes === hoy.slice(0, 7) ? hoy : '';
  var ym = S.cal.mes, mapa = entregasPorDia();
  var primero = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1), desfase = (primero.getDay() + 6) % 7, n = diasDelMes(ym);
  $('#cal-titulo').textContent = nombreMes(ym);
  var celdas = '', total = Math.ceil((desfase + n) / 7) * 7, delMes = 0, pendientes = 0;
  for (var i = 0; i < total; i++) {
    var dia = i - desfase + 1;
    if (dia < 1 || dia > n) { celdas += '<span class="cal-vacio"></span>'; continue; }
    var iso = ym + '-' + pad(dia), lista = mapa[iso] || [], clases = 'cal-dia';
    if (iso === hoy) clases += ' hoy';
    if (iso === S.cal.dia) clases += ' sel';
    var pill = '';
    if (lista.length) {
      var activos = lista.filter(esActivo).length;
      var tipo = !activos ? 'hecho' : (iso < hoy ? 'tarde' : (iso === hoy ? 'hoy' : 'norm'));
      pill = '<span class="pill ' + tipo + '">' + lista.length + '</span>';
      delMes += lista.length; pendientes += activos;
    }
    var etiqueta = fechaLarga(iso) + (lista.length ? ', ' + plural(lista.length, 'entrega', 'entregas') : ', sin entregas');
    celdas += '<button type="button" class="' + clases + '" data-dia="' + iso + '" aria-label="' + esc(etiqueta) + '"' + (iso === S.cal.dia ? ' aria-pressed="true"' : ' aria-pressed="false"') + '><span class="num">' + dia + '</span>' + pill + '</button>';
  }
  $('#cal-grid').innerHTML = celdas;
  $('#cal-resumen').textContent = delMes ? plural(delMes, 'entrega', 'entregas') + ' este mes' + (pendientes ? ', ' + plural(pendientes, 'pendiente', 'pendientes') : ', todas hechas') + '.' : 'No hay entregas este mes.';

  var sel = S.cal.dia, lista2 = sel ? (mapa[sel] || []).slice() : [];
  lista2.sort(function (a, b) { return (esActivo(b) ? 1 : 0) - (esActivo(a) ? 1 : 0) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }); });
  $('#cal-dia-titulo').textContent = sel ? fechaLarga(sel) : 'Toca un día para ver sus entregas';
  $('#cal-lista').innerHTML = !sel ? '' : (lista2.length ? lista2.map(tarjeta).join('') : '<div class="vacio">No hay entregas este día.</div>');

  var sinFecha = S.cache.filter(function (p) { return esActivo(p) && !p.entregaFecha; }).length;
  var notas = [];
  if (sinFecha) notas.push(plural(sinFecha, 'pedido en curso no tiene', 'pedidos en curso no tienen') + ' fecha de entrega, por eso no salen aquí.');
  if (esV3()) notas.push(S.config.calendario ? 'Estas entregas también están en tu Google Calendar, en el calendario "Entregas Yi Shu".' : 'Puedes llevar estas entregas a tu Google Calendar para que te avise en el celular (Ajustes > Automatizaciones).');
  $('#cal-notas').innerHTML = notas.map(function (t) { return '<p class="hint">' + esc(t) + '</p>'; }).join('');
}
function moverMes(n) {
  S.cal.mes = sumarMeses(S.cal.mes || mesActualYM(), n);
  S.cal.dia = S.cal.mes === hoyISO().slice(0, 7) ? hoyISO() : '';
  renderCalendario();
}
function ligarCalendario() {
  $('#cal-ant').addEventListener('click', function () { moverMes(-1); });
  $('#cal-sig').addEventListener('click', function () { moverMes(1); });
  $('#cal-hoy').addEventListener('click', function () { S.cal.mes = hoyISO().slice(0, 7); S.cal.dia = hoyISO(); renderCalendario(); });
  $('#cal-grid').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-dia]'); if (!b) return;
    S.cal.dia = b.dataset.dia; renderCalendario();
    var t = $('#cal-dia-titulo'); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  ligarAcciones('#cal-lista');
}

/* Números: panel de ventas y gastos del negocio */

/* Información al pasar el dedo o el mouse. Todo lo que muestra también está en la vista de tabla. */
function tipRows(el) { try { return JSON.parse(el.getAttribute('data-tip')); } catch (e) { return null; } }
function mostrarTip(el, x, y) {
  var filas = tipRows(el); if (!filas) return;
  var tip = $('#tip'); tip.innerHTML = '';
  filas.forEach(function (f, i) {
    var d = document.createElement('div'); d.className = i === 0 ? 'tip-t' : 'tip-f';
    if (f[2]) { var k = document.createElement('i'); k.className = 'tip-k ' + f[2]; d.appendChild(k); }
    var a = document.createElement('span'); a.textContent = f[0]; d.appendChild(a);
    if (f[1] != null && f[1] !== '') { var b = document.createElement('strong'); b.textContent = f[1]; d.appendChild(b); }
    tip.appendChild(d);
  });
  tip.hidden = false;
  var w = tip.offsetWidth, h = tip.offsetHeight, vw = window.innerWidth;
  var left = Math.min(Math.max(8, x - w / 2), vw - w - 8), top = y - h - 14; if (top < 8) top = y + 18;
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}
function ocultarTip() { var t = $('#tip'); if (t) t.hidden = true; }
function ligarTips(cont) {
  var sobre = function (ev) { var el = ev.target.closest && ev.target.closest('[data-tip]'); if (el) mostrarTip(el, ev.clientX, ev.clientY); else ocultarTip(); };
  cont.addEventListener('pointermove', sobre); cont.addEventListener('pointerdown', sobre);
  cont.addEventListener('pointerleave', ocultarTip);
  cont.addEventListener('focusin', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-tip]'); if (!el) return;
    var r = el.getBoundingClientRect(); mostrarTip(el, r.left + r.width / 2, r.top + Math.min(r.height, 40) / 2);
  });
  cont.addEventListener('focusout', ocultarTip);
}

/* Periodo */
function enPeriodo(iso) {
  var p = S.num.periodo; iso = String(iso || '');
  if (p === 'todo') return true;
  if (p === 'anio') return iso.slice(0, 4) === hoyISO().slice(0, 4);
  return mesDeIso(iso) === p;
}
function nombrePeriodo(p) { return p === 'todo' ? 'todo el tiempo' : (p === 'anio' ? 'este año' : nombreMes(p)); }
function pintarPeriodos() {
  var vistos = {};
  S.cache.forEach(function (p) { var m = mesDeIso(p.fecha); if (m) vistos[m] = 1; });
  S.gastos.forEach(function (g) { var m = mesDeIso(g.fecha); if (m) vistos[m] = 1; });
  vistos[mesActualYM()] = 1;
  if (/^\d{4}-\d{2}$/.test(S.num.periodo)) vistos[S.num.periodo] = 1;
  var meses = Object.keys(vistos).sort().reverse(), sel = $('#panel-periodo'), firma = meses.join(',');
  if (sel.dataset.firma !== firma) {
    sel.innerHTML = '<option value="todo">Todo el tiempo</option><option value="anio">Este año (' + hoyISO().slice(0, 4) + ')</option>' +
      meses.map(function (m) { return '<option value="' + m + '">' + esc(nombreMes(m)) + '</option>'; }).join('');
    sel.dataset.firma = firma;
  }
  sel.value = S.num.periodo;
}

/* Cálculos */
function suma(l, f) { return l.reduce(function (a, x) { return a + (Number(f(x)) || 0); }, 0); }
function agrupar(lista, clave, valor) {
  var m = {};
  lista.forEach(function (x) {
    var k = clave(x) || 'Sin dato', kk = k.toLowerCase();
    if (!m[kk]) m[kk] = { nombre: k, valor: 0, n: 0 };
    m[kk].valor += Number(valor(x)) || 0; m[kk].n++;
  });
  return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.valor - a.valor; });
}
function unidadesPorCategoria(pedidos) {
  var acc = {};
  pedidos.forEach(function (p) {
    var partes = String(p.producto || '').split(' + ');
    partes.forEach(function (seg) {
      var m = /^(.*?)(?:\s+x(\d+))?$/.exec(seg.trim());
      var cant = m[2] ? parseInt(m[2], 10) : (partes.length === 1 ? (p.cantidad || 1) : 1);
      var nombre = m[1].replace(/\s*\(.*\)\s*$/, '').trim();
      if (!nombre) return;
      var k = nombre.toLowerCase();
      if (!acc[k]) acc[k] = { nombre: nombre, valor: 0, n: 0 };
      acc[k].valor += cant; acc[k].n++;
    });
  });
  return Object.keys(acc).map(function (k) { return acc[k]; }).sort(function (a, b) { return b.valor - a.valor; });
}
function topConOtros(items, max) {
  if (items.length <= max) return items;
  var top = items.slice(0, max - 1), resto = items.slice(max - 1);
  top.push({ otros: true, nombre: 'Otros (' + resto.length + ')', valor: suma(resto, function (x) { return x.valor; }), n: suma(resto, function (x) { return x.n; }) });
  return top;
}

/* Gráficas */
function escalaNice(max) {
  if (!(max > 0)) return { top: 4, pasos: [0, 1, 2, 3, 4] };
  var exp = Math.pow(10, Math.floor(Math.log(max) / Math.LN10)), f = max / exp;
  var nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10, top = nice * exp;
  return { top: top, pasos: [0, top / 4, top / 2, top * 3 / 4, top] };
}
function trazoBarraV(x, base, w, h, r) {
  r = Math.min(r, h / 2, w / 2); var y = base - h;
  return 'M' + x + ',' + base + 'L' + x + ',' + (y + r) + 'A' + r + ',' + r + ' 0 0 1 ' + (x + r) + ',' + y + 'L' + (x + w - r) + ',' + y + 'A' + r + ',' + r + ' 0 0 1 ' + (x + w) + ',' + (y + r) + 'L' + (x + w) + ',' + base + 'Z';
}
function ultimosMeses(n) { var out = [], hoy = mesActualYM(); for (var i = n - 1; i >= 0; i--) out.push(sumarMeses(hoy, -i)); return out; }
function datosMensuales() {
  var meses = ultimosMeses(6);
  var vivos = S.cache.filter(function (p) { return p.estado !== 'Cancelado'; });
  return meses.map(function (m) {
    return { mes: m, ventas: suma(vivos.filter(function (p) { return mesDe(p) === m; }), function (p) { return p.total; }),
      gastos: esV3() ? suma(S.gastos.filter(function (g) { return mesDeIso(g.fecha) === m; }), function (g) { return g.monto; }) : 0 };
  });
}
function svgMensual(datos) {
  var W = 340, H = 214, ml = 52, mr = 8, mt = 12, mb = 34, pw = W - ml - mr, ph = H - mt - mb, base = mt + ph;
  var max = 0; datos.forEach(function (d) { max = Math.max(max, d.ventas, d.gastos); });
  var esc_ = escalaNice(max), gw = pw / datos.length, bw = 16;
  var idxMax = -1, mv = 0; datos.forEach(function (d, i) { if (d.ventas > mv) { mv = d.ventas; idxMax = i; } });
  var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Ventas y gastos por mes, últimos 6 meses">';
  esc_.pasos.forEach(function (v) {
    var y = base - (v / esc_.top) * ph;
    s += '<line class="gr" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + y + '" y2="' + y + '"/><text class="ax" x="' + (ml - 6) + '" y="' + (y + 3.5) + '" text-anchor="end">' + (v ? '$' + compacto(v) : '0') + '</text>';
  });
  s += '<line class="base" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + base + '" y2="' + base + '"/>';
  datos.forEach(function (d, i) {
    var cx = ml + gw * i + gw / 2, hv = (d.ventas / esc_.top) * ph, hg = (d.gastos / esc_.top) * ph;
    if (d.ventas > 0) s += '<path class="b-v" d="' + trazoBarraV(cx - bw - 1, base, bw, Math.max(hv, 2), 4) + '"/>';
    if (d.gastos > 0) s += '<path class="b-g" d="' + trazoBarraV(cx + 1, base, bw, Math.max(hg, 2), 4) + '"/>';
    if (i === idxMax) s += '<text class="lb" x="' + (cx - bw / 2 - 1) + '" y="' + (base - hv - 5) + '" text-anchor="middle">$' + compacto(d.ventas) + '</text>';
    s += '<text class="ax" x="' + cx + '" y="' + (H - 14) + '" text-anchor="middle">' + esc(mesCorto(d.mes)) + '</text>';
    var tip = [[nombreMes(d.mes)], ['Ventas', dinero(d.ventas), 'k-v']]; if (esV3()) tip.push(['Gastos', dinero(d.gastos), 'k-g']);
    s += '<rect class="hit" tabindex="0" x="' + (ml + gw * i) + '" y="' + mt + '" width="' + gw + '" height="' + ph + '" data-tip="' + esc(JSON.stringify(tip)) + '" aria-label="' + esc(nombreMes(d.mes) + ': ventas ' + dinero(d.ventas) + (esV3() ? ', gastos ' + dinero(d.gastos) : '')) + '"/>';
  });
  return s + '</svg>';
}
function barrasH(items, formato, clase) {
  if (!items.length) return '<p class="hint">Sin datos en este periodo.</p>';
  var max = Math.max.apply(null, items.map(function (i) { return i.valor; })) || 1;
  return '<div class="hb">' + items.map(function (it) {
    var pct = Math.max(1.5, it.valor / max * 100), tip = [[it.nombre, formato(it)]];
    return '<div class="hb-fila" tabindex="0" data-tip="' + esc(JSON.stringify(tip)) + '" aria-label="' + esc(it.nombre + ': ' + formato(it)) + '">' +
      '<div class="hb-t"><span class="hb-n">' + esc(it.nombre) + '</span><span class="hb-v">' + esc(formato(it)) + '</span></div>' +
      '<span class="hb-pista"><i class="hb-barra ' + (clase || '') + (it.otros ? ' otros' : '') + '" style="width:' + pct.toFixed(1) + '%"></i></span></div>';
  }).join('') + '</div>';
}
function tablaDatos(cabeceras, filas) {
  return '<div class="tabla-wrap"><table class="tabla"><thead><tr>' + cabeceras.map(function (c, i) { return '<th' + (i ? ' class="num"' : '') + '>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    filas.map(function (f) { return '<tr>' + f.map(function (c, i) { return '<td' + (i ? ' class="num"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
}
function tarjetaGrafica(titulo, sub, cuerpo) {
  return '<section class="card grafica"><h2>' + esc(titulo) + '</h2>' + (sub ? '<p class="hint sub-g">' + esc(sub) + '</p>' : '') + cuerpo + '</section>';
}

function renderPanel() {
  pintarPeriodos();
  var tabla = S.num.tabla, v3 = esV3();
  $('#panel-tabla').textContent = tabla ? 'Ver gráficas' : 'Ver como tabla';
  $('#panel-tabla').setAttribute('aria-pressed', String(tabla));
  var vivos = S.cache.filter(function (p) { return p.estado !== 'Cancelado' && enPeriodo(p.fecha); });
  var ventas = suma(vivos, function (p) { return p.total; }), cobrado = suma(vivos, function (p) { return p.pago; });
  var porCobrar = suma(vivos, function (p) { return p.debe; });
  var gastosP = v3 ? S.gastos.filter(function (g) { return enPeriodo(g.fecha); }) : [], gastos = suma(gastosP, function (g) { return g.monto; });
  var conCosto = vivos.filter(function (p) { return typeof p.costoTotal === 'number' && p.costoTotal > 0; });
  var ganancia = suma(conCosto, function (p) { return p.total - p.costoTotal; });
  var ticket = vivos.length ? Math.round(ventas / vivos.length) : 0;
  var caja = cobrado - gastos;

  var kpi = '<div class="kpis">' +
    '<div class="stat hero"><span class="t">Ventas de ' + esc(nombrePeriodo(S.num.periodo)) + '</span><span class="v">' + dinero(ventas) + '</span><span class="s n">' + plural(vivos.length, 'pedido', 'pedidos') + (vivos.length ? ' · ticket promedio ' + dinero(ticket) : '') + '. No cuenta los cancelados.</span></div>' +
    '<div class="stat"><span class="t">Ya cobrado</span><span class="v">' + dinero(cobrado) + '</span><span class="s n">' + (ventas ? Math.round(cobrado * 100 / ventas) + '% de lo vendido' : 'Sin ventas') + '</span></div>' +
    '<div class="stat"><span class="t">Por cobrar</span><span class="v">' + dinero(porCobrar) + '</span></div>' +
    (v3 ? '<div class="stat"><span class="t">Gastos</span><span class="v">' + dinero(gastos) + '</span><span class="s n">' + plural(gastosP.length, 'gasto', 'gastos') + '</span></div>' +
      '<div class="stat"><span class="t">Cobrado menos gastos</span><span class="v">' + (caja < 0 ? '-' : '') + dinero(Math.abs(caja)) + '</span><span class="s n">' + (caja < 0 ? 'Salió más de lo que entró' : 'Lo que entró menos lo que gastaste') + '</span></div>' : '') +
    (v3 ? '<div class="stat"><span class="t">Ganancia de pedidos con costos</span><span class="v">' + (ganancia < 0 ? '-' : '') + dinero(Math.abs(ganancia)) + '</span><span class="s n">' + (conCosto.length ? conCosto.length + ' de ' + plural(vivos.length, 'pedido', 'pedidos') + ' tienen costos anotados' : 'Aún no anotas costos en los pedidos') + '</span></div>' : '') +
    '</div>' + (v3 ? '<p class="hint">Los gastos (por ejemplo comprar filamento) y los costos de cada pedido (el filamento que usó) cuentan lo mismo desde dos lados. Por eso no se restan juntos.</p>' : '');

  var mens = datosMensuales(), hayMens = mens.some(function (d) { return d.ventas || d.gastos; });
  var cuerpoMens = !hayMens ? '<p class="hint">Todavía no hay ventas ni gastos en los últimos 6 meses.</p>' :
    (tabla ? tablaDatos(['Mes', 'Ventas'].concat(v3 ? ['Gastos'] : []), mens.map(function (d) { return [nombreMes(d.mes), dinero(d.ventas)].concat(v3 ? [dinero(d.gastos)] : []); })) :
      '<div class="leyenda"><span><i class="sw-v"></i>Ventas</span>' + (v3 ? '<span><i class="sw-g"></i>Gastos</span>' : '') + '</div>' + svgMensual(mens));
  var canales = agrupar(vivos, function (p) { return p.canal; }, function (p) { return p.total; });
  var cats = topConOtros(unidadesPorCategoria(vivos), 8);
  var clientes = agrupar(vivos, function (p) { return p.cliente; }, function (p) { return p.total; }).slice(0, 5);
  var fmtDin = function (i) { return dinero(i.valor); }, fmtUni = function (i) { return String(i.valor) + (i.valor === 1 ? ' unidad' : ' unidades'); };
  var fmtCli = function (i) { return dinero(i.valor) + ' · ' + plural(i.n, 'pedido', 'pedidos'); };
  var vista = function (items, fmt, cab, clase) {
    return !items.length ? '<p class="hint">Sin datos en este periodo.</p>' : (tabla ? tablaDatos(cab, items.map(function (i) { return [i.nombre, fmt(i)]; })) : barrasH(items, fmt, clase));
  };
  $('#panel-cuerpo').innerHTML = kpi +
    tarjetaGrafica('Mes a mes', 'Últimos 6 meses, sin importar el periodo de arriba.', cuerpoMens) +
    tarjetaGrafica('Ventas por canal', 'Cuánto vendiste según por dónde te contactó el cliente.', vista(canales, fmtDin, ['Canal', 'Ventas'])) +
    tarjetaGrafica('Lo más pedido', 'Unidades por categoría de producto.', vista(cats, fmtUni, ['Categoría', 'Unidades'])) +
    tarjetaGrafica('Clientes que más compran', 'Los 5 con más ventas en el periodo.', vista(clientes, fmtCli, ['Cliente', 'Compras']));
}

/* Gastos */
function pintarMesesGastos() {
  var vistos = {};
  S.gastos.forEach(function (g) { var m = mesDeIso(g.fecha); if (m) vistos[m] = 1; });
  S.pendG.forEach(function (g) { var m = mesDeIso(g.fecha); if (m) vistos[m] = 1; });
  if (S.num.gmes && S.num.gmes !== 'todos') vistos[S.num.gmes] = 1;
  var meses = Object.keys(vistos).sort().reverse(), sel = $('#gas-mes'), firma = meses.join(',');
  if (sel.dataset.firma !== firma) {
    sel.innerHTML = '<option value="todos">Todos los meses</option>' + meses.map(function (m) { return '<option value="' + m + '">' + esc(nombreMes(m)) + '</option>'; }).join('');
    sel.dataset.firma = firma;
  }
  sel.value = S.num.gmes || 'todos';
}
function renderGastos() {
  var v3 = esV3();
  $('#gas-v2').hidden = v3 || !S.cfg.url;
  $('#gas-contenido').hidden = !v3 && !!S.cfg.url;
  if (!v3 && S.cfg.url) return;
  if (!S.num.gmes) S.num.gmes = S.gastos.some(function (g) { return mesDeIso(g.fecha) === mesActualYM(); }) ? mesActualYM() : 'todos';
  pintarMesesGastos();
  var enMes = function (g) { return S.num.gmes === 'todos' || mesDeIso(g.fecha) === S.num.gmes; };
  var pend = S.pendG.map(function (g) { return Object.assign({}, g, { pendiente: true, id: '' }); });
  var lista = pend.concat(S.gastos).filter(enMes).sort(function (a, b) {
    if (!!a.pendiente !== !!b.pendiente) return a.pendiente ? -1 : 1;
    return String(b.fecha).localeCompare(String(a.fecha)) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
  });
  var total = suma(lista, function (g) { return g.monto; });
  var cats = agrupar(lista, function (g) { return g.categoria || 'Sin categoría'; }, function (g) { return g.monto; });
  $('#gas-total').innerHTML = '<div class="stat hero"><span class="t">Gastos de ' + esc(S.num.gmes === 'todos' ? 'todo el tiempo' : nombreMes(S.num.gmes)) + '</span><span class="v">' + dinero(total) + '</span><span class="s n">' + plural(lista.length, 'gasto', 'gastos') + '</span></div>';
  $('#gas-cats').innerHTML = cats.length > 0 ? tarjetaGrafica('Gastos por categoría', '', barrasH(cats, function (i) { return dinero(i.valor); }, 'b-gasto')) : '';
  $('#gas-lista').innerHTML = lista.length ? lista.map(function (g) {
    return '<article class="gasto"><div><p class="g-c">' + esc(g.concepto) + '</p><p class="hint">' + esc(textoDeIso(g.fecha)) + (g.categoria ? ' · ' + esc(g.categoria) : '') + (g.metodo ? ' · ' + esc(g.metodo) : '') + (g.notas ? ' · ' + esc(g.notas) : '') + '</p>' +
      (g.pendiente ? '<p class="err">' + (g.error ? 'La hoja lo rechazó: ' + esc(g.error) : 'Sin enviar a la hoja. Está guardado en este dispositivo.') + '</p>' : '') + '</div>' +
      '<div class="g-der"><span class="g-m">' + dinero(g.monto) + '</span>' +
      (g.pendiente ? '<button class="btn small ghost" type="button" data-gasto-quitar="' + esc(g.ref) + '">Quitar</button>' : '<button class="btn small ghost" type="button" data-gasto-editar="' + esc(g.id) + '">Editar</button>') + '</div></article>';
  }).join('') : '<div class="vacio">' + (S.gastos.length || S.pendG.length ? 'No hay gastos en ese mes.' : 'Todavía no registras gastos. Toca "Nuevo gasto" para anotar el primero (filamento, empaques, publicidad…).') + '</div>';
}
function categoriasGasto() { return S.config.gastoCategorias || CONFIG_BASE.gastoCategorias; }
function abrirGasto(id) {
  var g = id ? S.gastos.find(function (x) { return x.id === id; }) : null;
  var f = $('#form-gasto'); f.dataset.id = g ? g.id : '';
  $('#gasto-titulo').textContent = g ? 'Editar gasto ' + g.id : 'Nuevo gasto';
  var cats = categoriasGasto().slice(); if (g && g.categoria && cats.indexOf(g.categoria) < 0) cats.push(g.categoria);
  $('#g-categoria').innerHTML = '<option value="">Elige una categoría</option>' + cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  ponerFecha('g-fecha', g ? g.fecha : hoyISO());
  $('#g-concepto').value = g ? g.concepto : ''; $('#g-categoria').value = g ? (g.categoria || '') : '';
  ponerDinero($('#g-monto'), g ? g.monto : 0); $('#g-metodo').value = g ? (g.metodo || '') : ''; $('#g-notas').value = g ? (g.notas || '') : '';
  $('#g-eliminar').hidden = !g; $('#g-err').textContent = '';
  abrir($('#dlg-gasto'));
  setTimeout(function () { $('#g-concepto').focus(); }, 50);
}
function onGasto(ev) {
  ev.preventDefault();
  var f = $('#form-gasto'), id = f.dataset.id, err = $('#g-err');
  var fecha = isoDeTexto($('#g-fecha').value.trim()), concepto = $('#g-concepto').value.trim(), monto = soloNumero($('#g-monto').value);
  if (!concepto) { err.textContent = 'Escribe en qué fue el gasto.'; return; }
  if (!monto) { err.textContent = 'Escribe el monto.'; return; }
  if (!fecha) { err.textContent = 'Escribe la fecha como día/mes/año, por ejemplo 21/10/2026.'; return; }
  var datos = { fecha: fecha, concepto: concepto, categoria: $('#g-categoria').value, monto: monto, metodo: $('#g-metodo').value.trim(), notas: $('#g-notas').value.trim() };
  var btn = $('#g-ok'); btn.disabled = true; err.textContent = '';
  var fin = function () { btn.disabled = false; };
  if (id) {
    var g = S.gastos.find(function (x) { return x.id === id; }), cambios = {};
    Object.keys(datos).forEach(function (k) { if (distinto(datos[k], g[k] == null ? '' : g[k])) cambios[k] = datos[k]; });
    if (!Object.keys(cambios).length) { cerrar($('#dlg-gasto')); toast('No cambiaste nada.'); fin(); return; }
    api('gasto_actualizar', { id: id, cambios: cambios }).then(function (r) { upsertGasto(r.gasto); cerrar($('#dlg-gasto')); toast('Gasto actualizado.'); renderTodo(); }, function (e) { err.textContent = e.message; }).then(fin);
    return;
  }
  var nuevo = Object.assign({ ref: nuevoRef() }, datos);
  api('gasto_crear', { gasto: nuevo }).then(function (r) {
    upsertGasto(r.gasto); cerrar($('#dlg-gasto')); toast('Gasto guardado.'); renderTodo();
  }, function (e) {
    if (e.codigo === 'SERVIDOR') { err.textContent = e.message; return; }
    S.pendG.push(nuevo); guardar(LS.pendg, S.pendG); cerrar($('#dlg-gasto'));
    toast('Sin conexión. El gasto quedó guardado en este dispositivo y se enviará solo.', 'error'); pintarAviso(); renderTodo();
  }).then(fin);
}
function eliminarGasto() {
  var id = $('#form-gasto').dataset.id; if (!id) return;
  if (!confirm('¿Borrar este gasto? No se puede deshacer.')) return;
  api('gasto_eliminar', { id: id }).then(function () {
    S.gastos = S.gastos.filter(function (x) { return x.id !== id; }); guardarDatos(); cerrar($('#dlg-gasto')); toast('Gasto borrado.'); renderTodo();
  }, function (e) { $('#g-err').textContent = e.message; });
}

function renderNumeros() {
  $$('#num-tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === S.num.tab)); });
  $('#num-ventas').hidden = S.num.tab !== 'ventas'; $('#num-gastos').hidden = S.num.tab !== 'gastos';
  if (S.num.tab === 'ventas') renderPanel(); else renderGastos();
}
function ligarNumeros() {
  ligarTips($('#num-ventas')); ligarTips($('#gas-cats'));
  $('#num-tabs').addEventListener('click', function (ev) { var b = ev.target.closest('[data-tab]'); if (!b) return; S.num.tab = b.dataset.tab; renderNumeros(); });
  $('#panel-periodo').addEventListener('change', function (ev) { S.num.periodo = ev.target.value; renderPanel(); });
  $('#panel-tabla').addEventListener('click', function () { S.num.tabla = !S.num.tabla; renderPanel(); });
  $('#gas-mes').addEventListener('change', function (ev) { S.num.gmes = ev.target.value; renderGastos(); });
  $('#btn-gasto-nuevo').addEventListener('click', function () { abrirGasto(''); });
  $('#gas-lista').addEventListener('click', function (ev) {
    var e = ev.target.closest('[data-gasto-editar]'), q = ev.target.closest('[data-gasto-quitar]');
    if (e) abrirGasto(e.dataset.gastoEditar);
    else if (q && confirm('¿Quitar este gasto que aún no se envió a la hoja? No se puede deshacer.')) {
      S.pendG = S.pendG.filter(function (x) { return x.ref !== q.dataset.gastoQuitar; }); guardar(LS.pendg, S.pendG); pintarAviso(); renderGastos();
    }
  });
  $('#form-gasto').addEventListener('submit', onGasto);
  $('#g-cancelar').addEventListener('click', function () { cerrar($('#dlg-gasto')); });
  $('#g-eliminar').addEventListener('click', eliminarGasto);
}

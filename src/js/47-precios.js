/* Calculadora de precio.
   Forma habitual de ponerle precio a algo que se hace a mano:
     costo real = filamento + máquina + merma (impresiones que salen mal) + componentes + tu trabajo + empaque y envío
     precio     = costo real / (1 - margen - comisión de cobro), redondeado hacia arriba
   El margen es la parte DEL PRECIO que queda de ganancia (no un recargo sobre el costo). Con margen 40 %, de cada $100 que
   cobras, $40 son ganancia. La comisión también se descuenta del precio final, por eso va en el mismo divisor.
   Los porcentajes de partida son una sugerencia: hasta que Lorena los guarda, la app lo dice. */

var PRECIOS_BASE = { margen: 40, merma: 10, comision: 0, horaTrabajo: 0, redondeo: 1000, propios: false };
var REDONDEOS = [[0, 'Sin redondear'], [100, 'A los $100'], [500, 'A los $500'], [1000, 'A los $1.000'], [5000, 'A los $5.000']];
/* Hay dos calculadoras con la misma lógica: la del Inicio ('ci-') y el cuadro que se abre desde un pedido ('pr-'),
   que además puede dejar el precio en la casilla "Valor total". Cada una tiene su prefijo y el de sus porcentajes. */
var CALC_Q = { 'pr-': 'pq-', 'ci-': 'cq-' };
var PR = { 'pr-': { destino: '' }, 'ci-': { destino: '' } };

function esV5() { return S.version >= 5; }

/* Los valores que se usan hoy: los de la hoja (versión 5), los de este dispositivo, o los de partida */
function preciosGuardados() {
  var hoja = S.config.precios, local = leer(LS.precios, null);
  if (esV5() && hoja && hoja.propios) return Object.assign({}, PRECIOS_BASE, hoja);
  if (local && local.propios) return Object.assign({}, PRECIOS_BASE, local);
  return Object.assign({}, PRECIOS_BASE, esV5() && hoja ? hoja : {}, { propios: false });
}

/* ---------- Cálculo (no toca la pantalla) ---------- */
function calcularPrecio(e, pr) {
  var cg = Number(S.config.costoGramo) || 0, ph = precioHoraDe(e.impresora);
  var gramos = Number(e.gramos) || 0, horas = Number(e.horas) || 0;
  var fil = gramos * cg, imp = horas * ph;
  var fallo = Math.min(Math.max(Number(pr.merma) || 0, 0), 50) / 100;
  var merma = (fil + imp) * (fallo / (1 - fallo));         // si 10 % de las impresiones fallan, hay que imprimir 1/(1-0,10) veces
  var comps = Number(e.componentes) || 0;
  var trabajo = (Number(e.minutos) || 0) / 60 * (Number(pr.horaTrabajo) || 0);
  var empaque = Number(e.empaque) || 0, envio = Number(e.envio) || 0;
  var costo = fil + imp + merma + comps + trabajo + empaque + envio;
  var com = (Number(pr.comision) || 0) / 100, mar = (Number(pr.margen) || 0) / 100, divisor = 1 - mar - com;
  var r = { filamento: fil, impresora: imp, merma: merma, componentes: comps, trabajo: trabajo, empaque: empaque, envio: envio,
    costo: costo, precio: 0, ganancia: 0, margenReal: 0, equilibrio: 0, veces: 0, avisos: [], error: '' };
  if (gramos > 0 && !(cg > 0)) r.avisos.push('falta el costo por gramo (Ajustes > Costos de impresión)');
  if (horas > 0 && !(ph > 0)) r.avisos.push(e.impresora ? 'falta el costo por hora de ' + e.impresora : 'falta elegir la impresora');
  if ((Number(e.minutos) || 0) > 0 && !(Number(pr.horaTrabajo) > 0)) r.avisos.push('tu trabajo cuenta como $0 porque falta el valor de tu hora');
  /* Sin horas, gramos, componentes ni trabajo no hay nada que cobrar: el empaque que viene puesto solo no es un producto */
  var hayEntrada = gramos > 0 || horas > 0 || comps > 0 || (Number(e.minutos) || 0) > 0;
  if (!hayEntrada) { r.error = 'Escribe las horas y los gramos (o elige un producto) para ver el precio.'; return r; }
  if (!(costo > 0)) { r.error = 'Todavía no puedo calcular: ' + (r.avisos.length ? r.avisos.join('; ') : 'faltan costos') + '.'; return r; }
  if (divisor < 0.05) { r.error = 'El margen y la comisión suman demasiado: no alcanza para calcular.'; return r; }
  var crudo = costo / divisor, paso = Number(pr.redondeo) || 0;
  r.precio = paso > 0 ? Math.ceil(crudo / paso - 1e-9) * paso : Math.round(crudo);
  r.ganancia = r.precio - costo - r.precio * com;
  r.margenReal = r.precio > 0 ? r.ganancia / r.precio : 0;
  r.equilibrio = costo / (1 - com);
  r.veces = r.precio / costo;
  r.comisionPesos = r.precio * com;
  return r;
}

/* Lo que cuesta y vale UNA unidad (o N) de una ficha, para mostrar en las listas */
function entradaDeFicha(f, cant) {
  cant = cant > 0 ? cant : 1;
  return { impresora: f.impresora, gramos: (Number(f.gramos) || 0) * cant, horas: (Number(f.horas) || 0) * cant,
    componentes: costoComponentes(f).total * cant, minutos: (Number(f.minutos) || 0) * cant, empaque: (Number(S.config.empaque) || 0) * cant, envio: 0 };
}
function precioDeFicha(f) { return calcularPrecio(entradaDeFicha(f, 1), preciosGuardados()); }
function precioCatalogo(f) {
  var cp = f && f.catalogoId ? productoCatalogoPorId(f.catalogoId) : null;
  if (!cp) cp = f ? productoCatalogoPorNombre(f.nombre) : null;
  if (!cp || !/^\$?\s*[\d.]+$/.test(String(cp.precio || '').trim())) return 0;
  return soloNumero(cp.precio);
}

/* ---------- Los porcentajes (Ajustes y el cuadro de la calculadora comparten esto) ---------- */
function htmlParamsPrecio(p) {
  var opts = REDONDEOS.map(function (r) { return '<option value="' + r[0] + '">' + r[1] + '</option>'; }).join('');
  return '<div class="grid2">' +
    '<div class="field"><label for="' + p + 'margen">Margen de ganancia (%)</label><input id="' + p + 'margen" type="text" inputmode="decimal" autocomplete="off"><p class="hint">De cada $100 que cobras, cuántos son ganancia.</p></div>' +
    '<div class="field"><label for="' + p + 'merma">Impresiones que salen mal (%)</label><input id="' + p + 'merma" type="text" inputmode="decimal" autocomplete="off"><p class="hint">De cada 100 impresiones, cuántas se repiten o se pierden.</p></div>' +
    '</div><div class="grid2">' +
    '<div class="field"><label for="' + p + 'comision">Comisión de cobro (%)</label><input id="' + p + 'comision" type="text" inputmode="decimal" autocomplete="off"><p class="hint">Pasarela o plataforma de pago. Con transferencia o efectivo, déjala en 0.</p></div>' +
    '<div class="field"><label for="' + p + 'hora">Valor de tu hora de trabajo</label><div class="money"><input id="' + p + 'hora" type="text" inputmode="numeric" autocomplete="off"></div><p class="hint">Armar, lijar, pintar, empacar y atender. En 0, tu trabajo sale gratis.</p></div>' +
    '</div>' +
    '<div class="field"><label for="' + p + 'redondeo">Redondear el precio hacia arriba</label><select id="' + p + 'redondeo">' + opts + '</select></div>';
}
function ponerParamsPrecio(p, pr) {
  $('#' + p + 'margen').value = numTxt(pr.margen); $('#' + p + 'merma').value = numTxt(pr.merma); $('#' + p + 'comision').value = numTxt(pr.comision);
  ponerDinero($('#' + p + 'hora'), Number(pr.horaTrabajo) || 0); $('#' + p + 'redondeo').value = String(pr.redondeo);
}
function leerParamsPrecio(p) {
  return { margen: decimalDe($('#' + p + 'margen').value), merma: decimalDe($('#' + p + 'merma').value), comision: decimalDe($('#' + p + 'comision').value),
    horaTrabajo: soloNumero($('#' + p + 'hora').value), redondeo: parseInt($('#' + p + 'redondeo').value, 10) || 0 };
}
function errorParamsPrecio(p, pr) {
  if (!decimalOk($('#' + p + 'margen').value) || !decimalOk($('#' + p + 'merma').value) || !decimalOk($('#' + p + 'comision').value)) return 'Los porcentajes deben ser solo números, por ejemplo 40 o 2,5.';
  if (pr.margen < 0 || pr.margen > 90) return 'El margen debe estar entre 0 y 90 %.';
  if (pr.merma < 0 || pr.merma > 50) return 'Las impresiones que salen mal deben estar entre 0 y 50 %.';
  if (pr.comision < 0 || pr.comision > 30) return 'La comisión debe estar entre 0 y 30 %.';
  if (pr.margen + pr.comision > 95) return 'El margen y la comisión no pueden sumar más de 95 %.';
  return '';
}
function guardarPreciosDe(p, btn) {
  var pr = leerParamsPrecio(p), err = errorParamsPrecio(p, pr);
  if (err) { toast(err, 'error'); return Promise.resolve(); }
  if (!esV5()) {
    guardar(LS.precios, Object.assign({}, pr, { propios: true }));
    toast('Guardado en este dispositivo. Para compartirlo con tu socia hay que actualizar el script (versión 5).');
    afterPrecios(); return Promise.resolve();
  }
  return trabajando(btn, 'Guardando…', function () {
    return api('config_guardar', { config: { precios: pr } }).then(function (r) {
      S.config = Object.assign(clonar(CONFIG_BASE), r.config || {}); guardarDatos(); afterPrecios();
      toast('Listo. Estos porcentajes quedaron guardados para todos los dispositivos.');
    });
  }).catch(function (e) { toast(mensajeDe(e), 'error'); });
}
function afterPrecios() {
  if (S.vista === 'ajustes') { pintarPreciosAjustes(); pintarFichas(); }
  Object.keys(CALC_Q).forEach(function (p) {
    var q = CALC_Q[p], c = $('#' + q + 'cont'); if (!c) return;
    delete c.dataset.tocado; ponerParamsPrecio(q, preciosGuardados()); recalcularPrecio(p);
  });
}

/* ---------- Ajustes > Precios y margen ---------- */
function pintarPreciosAjustes() {
  var pr = preciosGuardados();
  ponerParamsPrecio('pa-', pr);
  var st = $('#pa-estado');
  st.textContent = pr.propios
    ? (esV5() && S.config.precios && S.config.precios.propios ? 'Guardado en tu hoja: lo usan todos los dispositivos.' : 'Guardado solo en este dispositivo.')
    : 'Son valores de partida que sugiero yo. Cámbialos por los tuyos y toca Guardar.';
  $('#pa-v4').hidden = esV5() || !S.cfg.url;
}

/* ---------- La calculadora ---------- */
function dineroDe(id) { return soloNumero($('#' + id).value); }
function decDe(id) { var t = $('#' + id).value.trim(); return t === '' ? 0 : decimalDe(t); }
function campoDinero(id, etiqueta) {
  return '<div class="field"><label for="' + id + '">' + etiqueta + '</label><div class="money"><input id="' + id + '" type="text" inputmode="numeric" autocomplete="off"></div></div>';
}
/* El mismo formulario sirve para el Inicio (p = 'ci-') y para el cuadro que se abre desde un pedido (p = 'pr-') */
function htmlCalculadora(p) {
  var q = CALC_Q[p], inicio = p === 'ci-';
  var otros = '<div class="grid2">' + campoDinero(p + 'comps', 'Componentes y otros materiales') + campoDinero(p + 'empaque', 'Empaque') + '</div>' +
    campoDinero(p + 'envio', 'Envío que paga el negocio');
  return (inicio ? '<p class="hint" id="ci-ficha-hint" hidden>Todavía no tienes productos guardados. Escribe los números abajo, o guarda tus productos como fichas en Ajustes para no repetirlos cada vez.</p>' : '') +
    '<div class="field" id="' + p + 'ficha-box"><label for="' + p + 'ficha">' + (inicio ? '¿Qué vas a vender?' : 'Rellenar con una ficha') + '</label><select id="' + p + 'ficha"></select></div>' +
    '<div class="field"><label for="' + p + 'impresora">Impresora</label><select id="' + p + 'impresora"></select></div>' +
    '<div class="grid2">' +
      '<div class="field"><label for="' + p + 'cant">Unidades</label><input id="' + p + 'cant" type="number" min="1" max="999" step="1" value="1" inputmode="numeric"></div>' +
      '<div class="field"><label for="' + p + 'horas">Horas de impresión</label><input id="' + p + 'horas" type="text" inputmode="decimal" placeholder="Ej: 3,5" autocomplete="off"></div>' +
    '</div>' +
    '<div class="grid2">' +
      '<div class="field"><label for="' + p + 'gramos">Gramos de filamento</label><input id="' + p + 'gramos" type="text" inputmode="decimal" placeholder="Ej: 120" autocomplete="off"></div>' +
      '<div class="field"><label for="' + p + 'minutos">Tu trabajo (minutos)</label><input id="' + p + 'minutos" type="text" inputmode="decimal" placeholder="Ej: 30" autocomplete="off"></div>' +
    '</div>' +
    (inicio ? '<details id="ci-otros"><summary>Componentes, empaque y envío <span class="opc">(opcional)</span></summary><div class="stack">' +
      '<p class="hint">El empaque ya viene sumado con lo que pusiste en Ajustes. Cámbialo si este pedido lleva otro.</p>' + otros + '</div></details>' : otros) +
    '<details id="' + p + 'params"><summary>Margen y porcentajes de este cálculo</summary><div class="stack">' +
      '<div id="' + q + 'cont" class="stack"></div>' +
      '<p class="hint">Los cambios de aquí valen solo para este cálculo. Para dejarlos fijos, toca el botón.</p>' +
      '<div class="acciones"><button class="btn small" id="' + q + 'guardar" type="button">Guardar como mis valores</button></div>' +
    '</div></details>' +
    '<div class="saldo" id="' + p + 'res" data-estado="vacio" aria-live="polite"><span class="t">Precio sugerido</span><span class="v">&mdash;</span></div>' +
    '<div id="' + p + 'desglose" class="pr-desglose"></div>' +
    '<p class="hint" id="' + p + 'nota" role="status"></p>';
}

function opcionesFichasPrecio(p) {
  var sel = $('#' + p + 'ficha'), previo = sel.value, inicio = p === 'ci-';
  var fs = S.fichas.slice().sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre), 'es'); });
  var html = '<option value="">' + (inicio ? 'Otro producto: escribo los números' : 'Ninguna: escribo los números') + '</option>' +
    fs.map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.nombre) + '</option>'; }).join('');
  if (sel.innerHTML !== html) sel.innerHTML = html;           // no lo reescribas si no cambió: cerraría la lista abierta
  sel.value = previo && buscarFicha(previo) ? previo : '';
  $('#' + p + 'ficha-box').hidden = !fs.length;
  if (inicio) $('#ci-ficha-hint').hidden = !!fs.length || !esV4();
}
/* La impresora que más has usado en tus pedidos; si no hay datos, la primera que ya tiene costo por hora */
function impresoraHabitual() {
  var conCosto = (S.config.impresoras || []).filter(function (i) { return Number(i.costoHora) > 0; }).map(function (i) { return i.nombre; });
  var cuenta = {}, mejor = '', n = 0;
  S.cache.forEach(function (x) {
    if (x.impresora && conCosto.indexOf(x.impresora) >= 0) { cuenta[x.impresora] = (cuenta[x.impresora] || 0) + 1; if (cuenta[x.impresora] > n) { n = cuenta[x.impresora]; mejor = x.impresora; } }
  });
  return mejor || conCosto[0] || '';
}
function empaqueSugerido(p) { return Math.round((Number(S.config.empaque) || 0) * Math.max(1, parseInt($('#' + p + 'cant').value, 10) || 1)); }
function faltanCostos() {
  return !(Number(S.config.costoGramo) > 0) || !(S.config.impresoras || []).some(function (i) { return Number(i.costoHora) > 0; });
}

function llenarDesdeFicha(p) {
  var f = $('#' + p + 'ficha').value ? buscarFicha($('#' + p + 'ficha').value) : null; if (!f) return;
  var cant = Math.max(1, parseInt($('#' + p + 'cant').value, 10) || 1), e = entradaDeFicha(f, cant);
  pintarImpresoras(p, f.impresora || (p === 'ci-' ? impresoraHabitual() : ''));
  $('#' + p + 'horas').value = e.horas > 0 ? numTxt(e.horas) : ''; $('#' + p + 'gramos').value = e.gramos > 0 ? numTxt(e.gramos) : '';
  ponerDinero($('#' + p + 'comps'), Math.round(e.componentes)); $('#' + p + 'minutos').value = e.minutos > 0 ? numTxt(e.minutos) : '';
}
function entradaDeCalculadora(p) {
  return { impresora: $('#' + p + 'impresora').value, horas: decDe(p + 'horas'), gramos: decDe(p + 'gramos'), componentes: dineroDe(p + 'comps'),
    minutos: decDe(p + 'minutos'), empaque: dineroDe(p + 'empaque'), envio: dineroDe(p + 'envio') };
}
function lineaDesglose(txt, valor) { return '<div class="pr-lin"><span>' + esc(txt) + '</span><b>' + dinero(valor) + '</b></div>'; }
function recalcularPrecio(p) {
  var q = CALC_Q[p], box = $('#' + p + 'res'); if (!box) return;
  var det = $('#' + p + 'desglose'), nota = $('#' + p + 'nota'), usar = $('#' + p + 'usar');
  var pr = leerParamsPrecio(q), err = errorParamsPrecio(q, pr);
  var e = entradaDeCalculadora(p), r = calcularPrecio(e, pr), cant = Math.max(1, parseInt($('#' + p + 'cant').value, 10) || 1);
  if (usar) { usar.hidden = !PR[p].destino; usar.disabled = true; }
  if (err) { box.setAttribute('data-estado', 'vacio'); $('.v', box).textContent = '—'; det.innerHTML = ''; nota.textContent = err; return; }
  if (r.error) { box.setAttribute('data-estado', 'vacio'); $('.v', box).textContent = '—'; det.innerHTML = ''; nota.textContent = r.error; return; }
  box.setAttribute('data-estado', 'pagado'); $('.v', box).textContent = dinero(r.precio);
  if (usar) usar.disabled = false;
  var f = $('#' + p + 'ficha').value ? buscarFicha($('#' + p + 'ficha').value) : null, cat = f ? precioCatalogo(f) : 0;
  var lin = [];
  if (cant > 1) lin.push('<div class="pr-lin pr-unidad"><span>Por unidad (' + cant + ' unidades)</span><b>' + dinero(Math.ceil(r.precio / cant)) + '</b></div>');
  lin.push(lineaDesglose('Filamento', r.filamento), lineaDesglose('Impresora (luz, desgaste y mantenimiento)', r.impresora));
  if (r.merma > 0) lin.push(lineaDesglose('Impresiones que salen mal', r.merma));
  if (r.componentes > 0) lin.push(lineaDesglose('Componentes y otros materiales', r.componentes));
  if (r.trabajo > 0) lin.push(lineaDesglose('Tu trabajo', r.trabajo));
  if (r.empaque + r.envio > 0) lin.push(lineaDesglose('Empaque y envío', r.empaque + r.envio));
  lin.push('<div class="pr-lin pr-sep"><span>Costo real</span><b>' + dinero(r.costo) + '</b></div>');
  if (r.comisionPesos > 0) lin.push(lineaDesglose('Comisión de cobro', r.comisionPesos));
  lin.push('<div class="pr-lin"><span>Ganancia</span><b>' + dinero(r.ganancia) + ' · ' + Math.round(r.margenReal * 100) + ' %</b></div>');
  lin.push('<div class="pr-lin"><span>Precio mínimo para no perder</span><b>' + dinero(Math.ceil(r.equilibrio)) + '</b></div>');
  lin.push('<div class="pr-lin"><span>Equivale a cobrar</span><b>' + numTxt(Math.round(r.veces * 100) / 100) + ' veces el costo</b></div>');
  if (cat > 0) {
    var tot = cat * cant, gan = tot - r.costo - tot * (pr.comision / 100);
    lin.push('<div class="pr-lin"><span>En tu catálogo (' + dinero(cat) + ' c/u)</span><b>' + (gan >= 0 ? 'ganancia ' + dinero(gan) + ' · ' + Math.round(gan * 100 / tot) + ' %' : 'pérdida ' + dinero(-gan)) + '</b></div>');
  }
  det.innerHTML = lin.join('');
  nota.textContent = (r.avisos.length ? 'Ojo: ' + r.avisos.join('; ') + '. ' : '') +
    (preciosGuardados().propios ? '' : 'Los porcentajes son valores de partida: ajústalos en "Margen y porcentajes" y toca "Guardar como mis valores". ') +
    'El pedido solo registra como costo lo de impresión, componentes, empaque y envío: la merma y tu trabajo quedan dentro de la ganancia.';
}

/* Cuadro que se abre desde "Nuevo pedido" o "Editar" (puede dejar el precio en el valor total) */
function abrirPrecio(o) {
  o = o || {};
  var p = 'pr-', q = 'pq-';
  PR[p] = { destino: o.destino || '' };
  opcionesFichasPrecio(p);
  $('#pr-ficha').value = o.fichaId && buscarFicha(o.fichaId) ? o.fichaId : '';
  $('#pr-cant').value = String(Math.max(1, parseInt(o.cant, 10) || 1));
  var d = o.datos || {};
  pintarImpresoras(p, d.impresora || '');
  $('#pr-horas').value = d.horas > 0 ? numTxt(d.horas) : ''; $('#pr-gramos').value = d.gramos > 0 ? numTxt(d.gramos) : '';
  ponerDinero($('#pr-comps'), Number(d.otros) || 0); $('#pr-minutos').value = d.minutos > 0 ? numTxt(d.minutos) : '';
  var emp = d.empaque === undefined ? empaqueSugerido(p) : (Number(d.empaque) || 0);
  ponerDinero($('#pr-empaque'), emp); $('#pr-empaque').dataset.tocado = d.empaque === undefined ? '' : '1'; ponerDinero($('#pr-envio'), Number(d.envio) || 0);
  if ($('#pr-ficha').value && !(o.datos)) llenarDesdeFicha(p);
  ponerParamsPrecio(q, preciosGuardados());
  $('#pr-params').open = false;
  $('#pr-usar').hidden = !PR[p].destino;
  recalcularPrecio(p);
  abrir($('#dlg-precio'));
}

/* Desde "Nuevo pedido" o "Editar": parte de los números que ya hay escritos en el bloque de costos */
function abrirPrecioDesdePedido(p) {
  var c = leerCostos(p), minutos = 0, cant = 1;
  $$('#' + p + 'fichas .ficha-fila').forEach(function (fila) {
    var f = buscarFicha($('.ff-sel', fila).value), n = Math.max(1, parseInt($('.ff-cant', fila).value, 10) || 1);
    if (f) { minutos += (Number(f.minutos) || 0) * n; }
  });
  if (p === 'c-') { cant = leerItems().reduce(function (s, it) { return s + it.cantidad; }, 0) || 1; }
  else { cant = parseInt($('#ed-cantidad').value, 10) || 1; }
  abrirPrecio({ destino: p === 'c-' ? 'total' : 'ed-total', cant: cant,
    datos: { impresora: c.impresora, horas: Number(c.horas) || 0, gramos: Number(c.gramos) || 0, otros: Number(c.otros) || 0, minutos: minutos,
      empaque: Number(c.empaque) || 0, envio: Number(c.envioNegocio) || 0 } });
}
function usarPrecioComoTotal() {
  var p = 'pr-', pr = leerParamsPrecio(CALC_Q[p]), r = calcularPrecio(entradaDeCalculadora(p), pr);
  if (!(r.precio > 0)) return;
  var el = $('#' + PR[p].destino); if (!el) return;
  ponerDinero(el, r.precio);
  try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  cerrar($('#dlg-precio')); toast('Valor total puesto en ' + dinero(r.precio) + '. Lo puedes cambiar.');
}

/* ---------- La calculadora del Inicio ---------- */
/* Se llama al entrar al Inicio y cada vez que llegan datos nuevos de la hoja. No pisa lo que ya escribiste. */
function pintarCalcInicio() {
  var p = 'ci-', q = 'cq-'; if (!$('#ci-res')) return;
  opcionesFichasPrecio(p);
  var imp = $('#ci-impresora');
  if (!imp.value && !imp.dataset.tocado) pintarImpresoras(p, impresoraHabitual()); else pintarImpresoras(p);
  var par = $('#cq-cont'); if (!par.dataset.tocado) ponerParamsPrecio(q, preciosGuardados());
  var emp = $('#ci-empaque'); if (!emp.dataset.tocado) ponerDinero(emp, empaqueSugerido(p));
  $('#ci-faltan').hidden = !esV4() || !S.cfg.url || !faltanCostos();
  recalcularPrecio(p);
}
function limpiarCalcInicio() {
  ['ci-horas', 'ci-gramos', 'ci-minutos', 'ci-comps', 'ci-envio'].forEach(function (id) { $('#' + id).value = ''; });
  $('#ci-ficha').value = ''; $('#ci-cant').value = '1'; $('#ci-impresora').value = '';
  delete $('#ci-empaque').dataset.tocado; delete $('#ci-impresora').dataset.tocado; delete $('#cq-cont').dataset.tocado;
  $('#ci-otros').open = false; $('#ci-params').open = false;
  pintarCalcInicio();
}
/* Llevar a alguien a la calculadora, con un producto ya elegido si hace falta (desde Ajustes > Fichas) */
function irACalculadora(o) {
  o = o || {};
  irA('inicio');
  if (o.fichaId && buscarFicha(o.fichaId)) {
    limpiarCalcInicio();
    $('#ci-ficha').value = o.fichaId; llenarDesdeFicha('ci-'); recalcularPrecio('ci-');
  }
  var c = $('#calc-card'); if (c) c.scrollIntoView({ block: 'start' });
}

function ligarCalc(p) {
  var q = CALC_Q[p], recalc = function () { recalcularPrecio(p); };
  $('#' + p + 'cont').innerHTML = htmlCalculadora(p);
  $('#' + q + 'cont').innerHTML = htmlParamsPrecio(q);
  ligarDinero($('#' + q + 'hora'), recalc);
  [p + 'comps', p + 'envio'].forEach(function (id) { ligarDinero($('#' + id), recalc); });
  ligarDinero($('#' + p + 'empaque'), function () { $('#' + p + 'empaque').dataset.tocado = '1'; recalc(); });
  var par = $('#' + q + 'cont');
  var marcar = function () { par.dataset.tocado = '1'; recalc(); };
  par.addEventListener('input', marcar); par.addEventListener('change', marcar);
  [p + 'horas', p + 'gramos', p + 'minutos'].forEach(function (id) { $('#' + id).addEventListener('input', recalc); });
  $('#' + p + 'impresora').addEventListener('change', function () { this.dataset.tocado = '1'; recalc(); });
  $('#' + p + 'ficha').addEventListener('change', function () { llenarDesdeFicha(p); recalc(); });
  $('#' + p + 'cant').addEventListener('input', function () {
    if (!$('#' + p + 'empaque').dataset.tocado) ponerDinero($('#' + p + 'empaque'), empaqueSugerido(p));
    llenarDesdeFicha(p); recalc();
  });
  $('#' + q + 'guardar').addEventListener('click', function () { guardarPreciosDe(q, this); });
}

function ligarPrecios() {
  $('#pa-cont').innerHTML = htmlParamsPrecio('pa-');
  ligarDinero($('#pa-hora'));
  ligarCalc('pr-'); ligarCalc('ci-');
  $('#pr-cerrar').addEventListener('click', function () { cerrar($('#dlg-precio')); });
  $('#pr-usar').addEventListener('click', usarPrecioComoTotal);
  $('#pa-guardar').addEventListener('click', function () { guardarPreciosDe('pa-', this); });
  $('#pa-abrir').addEventListener('click', function () { irACalculadora({}); });
  $('#btn-precio-nuevo').addEventListener('click', function () { abrirPrecioDesdePedido('c-'); });
  $('#btn-precio-editar').addEventListener('click', function () { abrirPrecioDesdePedido('ed-c-'); });
  $('#ci-limpiar').addEventListener('click', limpiarCalcInicio);
  $('#ci-completar').addEventListener('click', function () { irA('ajustes'); var c = $('#cos-gramo'); if (c) c.scrollIntoView({ block: 'center' }); });
  $('#fichas-lista').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-ficha-precio]'); if (b) irACalculadora({ fichaId: b.dataset.fichaPrecio });
  });
  pintarPreciosAjustes();
}

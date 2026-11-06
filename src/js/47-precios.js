/* Calculadora de precio.
   Forma habitual de ponerle precio a algo que se hace a mano:
     costo real = filamento + máquina + merma (impresiones que salen mal) + componentes + tu trabajo + empaque y envío
     precio     = costo real / (1 - margen - comisión de cobro), redondeado hacia arriba
   El margen es la parte DEL PRECIO que queda de ganancia (no un recargo sobre el costo). Con margen 40 %, de cada $100 que
   cobras, $40 son ganancia. La comisión también se descuenta del precio final, por eso va en el mismo divisor.
   Los porcentajes de partida son una sugerencia: hasta que Lorena los guarda, la app lo dice. */

var PRECIOS_BASE = { margen: 40, merma: 10, comision: 0, horaTrabajo: 0, redondeo: 1000, propios: false };
var REDONDEOS = [[0, 'Sin redondear'], [100, 'A los $100'], [500, 'A los $500'], [1000, 'A los $1.000'], [5000, 'A los $5.000']];
var PR = { destino: '', fichaId: '' };           // destino: casilla del pedido donde "Usar como valor total" deja el precio

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
  if (!(costo > 0)) { r.error = 'Escribe las horas, los gramos u otros costos para ver el precio.'; return r; }
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
    componentes: costoComponentes(f).total * cant, minutos: (Number(f.minutos) || 0) * cant, empaque: 0, envio: 0 };
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
  if ($('#dlg-precio').open) { ponerParamsPrecio('pq-', preciosGuardados()); recalcularPrecio(); }
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
function opcionesFichasPrecio() {
  var sel = $('#pr-ficha'), previo = sel.value;
  var fs = S.fichas.slice().sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre), 'es'); });
  sel.innerHTML = '<option value="">Ninguna: escribo los números</option>' + fs.map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.nombre) + '</option>'; }).join('');
  sel.value = previo && buscarFicha(previo) ? previo : '';
  $('#pr-ficha-box').hidden = !fs.length;
}
function llenarDesdeFicha() {
  var f = $('#pr-ficha').value ? buscarFicha($('#pr-ficha').value) : null; if (!f) return;
  var cant = Math.max(1, parseInt($('#pr-cant').value, 10) || 1), e = entradaDeFicha(f, cant);
  pintarImpresoras('pr-', f.impresora || '');
  $('#pr-horas').value = e.horas > 0 ? numTxt(e.horas) : ''; $('#pr-gramos').value = e.gramos > 0 ? numTxt(e.gramos) : '';
  ponerDinero($('#pr-comps'), Math.round(e.componentes)); $('#pr-minutos').value = e.minutos > 0 ? numTxt(e.minutos) : '';
}
function entradaDeCalculadora() {
  return { impresora: $('#pr-impresora').value, horas: decDe('pr-horas'), gramos: decDe('pr-gramos'), componentes: dineroDe('pr-comps'),
    minutos: decDe('pr-minutos'), empaque: dineroDe('pr-empaque'), envio: dineroDe('pr-envio') };
}
function lineaDesglose(txt, valor) { return '<div class="pr-lin"><span>' + esc(txt) + '</span><b>' + dinero(valor) + '</b></div>'; }
function recalcularPrecio() {
  var pr = leerParamsPrecio('pq-'), box = $('#pr-res'), det = $('#pr-desglose'), nota = $('#pr-nota'), usar = $('#pr-usar');
  var err = errorParamsPrecio('pq-', pr);
  var e = entradaDeCalculadora(), r = calcularPrecio(e, pr), cant = Math.max(1, parseInt($('#pr-cant').value, 10) || 1);
  usar.hidden = !PR.destino; usar.disabled = true;
  if (err) { box.setAttribute('data-estado', 'vacio'); $('.v', box).textContent = '—'; det.innerHTML = ''; nota.textContent = err; return; }
  if (r.error) { box.setAttribute('data-estado', 'vacio'); $('.v', box).textContent = '—'; det.innerHTML = ''; nota.textContent = r.error; return; }
  box.setAttribute('data-estado', 'pagado'); $('.v', box).textContent = dinero(r.precio);
  usar.disabled = false;
  var f = $('#pr-ficha').value ? buscarFicha($('#pr-ficha').value) : null, cat = f ? precioCatalogo(f) : 0;
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
    (preciosGuardados().propios ? '' : 'Los porcentajes son valores de partida: ajústalos y guárdalos en Ajustes > Precios y margen. ') +
    'El pedido solo registra como costo lo de impresión, componentes, empaque y envío: la merma y tu trabajo quedan dentro de la ganancia.';
}
function abrirPrecio(o) {
  o = o || {};
  PR = { destino: o.destino || '', fichaId: '' };
  opcionesFichasPrecio();
  $('#pr-ficha').value = o.fichaId && buscarFicha(o.fichaId) ? o.fichaId : '';
  $('#pr-cant').value = String(Math.max(1, parseInt(o.cant, 10) || 1));
  var d = o.datos || {};
  pintarImpresoras('pr-', d.impresora || '');
  $('#pr-horas').value = d.horas > 0 ? numTxt(d.horas) : ''; $('#pr-gramos').value = d.gramos > 0 ? numTxt(d.gramos) : '';
  ponerDinero($('#pr-comps'), Number(d.otros) || 0); $('#pr-minutos').value = d.minutos > 0 ? numTxt(d.minutos) : '';
  ponerDinero($('#pr-empaque'), d.empaque === undefined ? (Number(S.config.empaque) || 0) : (Number(d.empaque) || 0)); ponerDinero($('#pr-envio'), Number(d.envio) || 0);
  if ($('#pr-ficha').value && !(o.datos)) llenarDesdeFicha();
  ponerParamsPrecio('pq-', preciosGuardados());
  $('#pr-params').open = false;
  $('#pr-usar').hidden = !PR.destino;
  recalcularPrecio();
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
  var pr = leerParamsPrecio('pq-'), r = calcularPrecio(entradaDeCalculadora(), pr);
  if (!(r.precio > 0)) return;
  var el = $('#' + PR.destino); if (!el) return;
  ponerDinero(el, r.precio);
  try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  cerrar($('#dlg-precio')); toast('Valor total puesto en ' + dinero(r.precio) + '. Lo puedes cambiar.');
}

function ligarPrecios() {
  $('#pa-cont').innerHTML = htmlParamsPrecio('pa-');
  $('#pq-cont').innerHTML = htmlParamsPrecio('pq-');
  ['pa-', 'pq-'].forEach(function (p) { ligarDinero($('#' + p + 'hora'), p === 'pq-' ? recalcularPrecio : null); });
  ['pr-comps', 'pr-empaque', 'pr-envio'].forEach(function (id) { ligarDinero($('#' + id), recalcularPrecio); });
  $('#pq-cont').addEventListener('input', recalcularPrecio); $('#pq-cont').addEventListener('change', recalcularPrecio);
  ['pr-horas', 'pr-gramos', 'pr-minutos'].forEach(function (id) { $('#' + id).addEventListener('input', recalcularPrecio); });
  $('#pr-impresora').addEventListener('change', recalcularPrecio);
  $('#pr-ficha').addEventListener('change', function () { llenarDesdeFicha(); recalcularPrecio(); });
  $('#pr-cant').addEventListener('input', function () { llenarDesdeFicha(); recalcularPrecio(); });
  $('#pr-cerrar').addEventListener('click', function () { cerrar($('#dlg-precio')); });
  $('#pr-usar').addEventListener('click', usarPrecioComoTotal);
  $('#pq-guardar').addEventListener('click', function () { guardarPreciosDe('pq-', this); });
  $('#pa-guardar').addEventListener('click', function () { guardarPreciosDe('pa-', this); });
  $('#pa-abrir').addEventListener('click', function () { abrirPrecio({}); });
  $('#btn-precio-nuevo').addEventListener('click', function () { abrirPrecioDesdePedido('c-'); });
  $('#btn-precio-editar').addEventListener('click', function () { abrirPrecioDesdePedido('ed-c-'); });
  $('#fichas-lista').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-ficha-precio]'); if (b) abrirPrecio({ fichaId: b.dataset.fichaPrecio });
  });
  pintarPreciosAjustes();
}

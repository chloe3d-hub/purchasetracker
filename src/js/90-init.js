/* Pantallas, arranque y eventos */
var VISTAS = ['nuevo', 'pedidos', 'calendario', 'produccion', 'numeros', 'ajustes'];

function renderTodo() {
  var enCurso = S.cache.filter(esActivo).length + S.pend.length, cola = colaProduccion().length;
  var c1 = $('#cuenta-activos'), c2 = $('#cuenta-prod');
  c1.textContent = enCurso; c1.hidden = !enCurso;
  c2.textContent = cola; c2.hidden = !cola;
  var bc = $('#bloque-costos-nuevo'); if (bc) bc.hidden = !esV3();
  var f = document.activeElement;
  if (S.vista === 'produccion' && f && f.matches && f.matches('[data-prod]')) return;   // no pisar lo que está escribiendo
  var pinta = { pedidos: renderPedidos, calendario: renderCalendario, produccion: renderProduccion, numeros: renderNumeros, ajustes: pintarAjustesEstado }[S.vista];
  if (pinta) pinta();
}
function refrescarSiViejo(minimoMs) {
  if (!S.cfg.url || !S.cfg.clave) return Promise.resolve();
  if (Date.now() - S.sync.ultima < (minimoMs || 30000)) return Promise.resolve();
  return sincronizar(true);
}
function irA(vista) {
  if (VISTAS.indexOf(vista) < 0) vista = 'nuevo';
  S.vista = vista; guardar(LS.ultimaVista, vista);
  VISTAS.forEach(function (v) { $('#vista-' + v).hidden = v !== vista; });
  $$('#nav [data-vista]').forEach(function (b) { b.setAttribute('aria-current', b.dataset.vista === vista ? 'page' : 'false'); });
  $('#btn-config').setAttribute('aria-pressed', String(vista === 'ajustes'));
  window.scrollTo(0, 0);
  if (vista === 'ajustes') { llenarAjustes(); cargarAuto(); }
  renderTodo();
  if (vista !== 'nuevo' && vista !== 'ajustes') refrescarSiViejo();
}

/* Enlace para conectar otro dispositivo: ...#cfg=... (también se puede pegar en Ajustes) */
function aplicarEnlaceCfg(token) {
  var d;
  try { d = JSON.parse(deB64Url(token)); } catch (e) { toast('El enlace de conexión está dañado. Genera otro desde Ajustes.', 'error'); return false; }
  if (!d || typeof d.u !== 'string' || !urlValida(d.u) || !d.k) { toast('El enlace de conexión no es válido. Genera otro desde Ajustes.', 'error'); return false; }
  var hay = S.cfg.url && S.cfg.clave;
  if (hay && S.cfg.url === d.u && S.cfg.clave === d.k) { toast('Este dispositivo ya estaba conectado.'); return false; }
  var msg = hay ? 'Este enlace trae la conexión con otra hoja. ¿Reemplazar la que tiene este dispositivo?' : 'Este enlace trae la conexión con tu hoja de pedidos. ¿Conectar este dispositivo?';
  if (!confirm(msg)) return false;
  S.cfg = { url: d.u, clave: String(d.k), hoja: /^https:\/\/docs\.google\.com\/spreadsheets\//.test(d.h || '') ? d.h : '' };
  guardar(LS.cfg, S.cfg); S.version = 0; S.auto = null;
  toast('Listo, este dispositivo quedó conectado.');
  return true;
}
function importarCfg() {
  var m = /^#cfg=([A-Za-z0-9_-]+)$/.exec(location.hash || ''); if (!m) return false;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}   // la clave no se queda en el historial
  return aplicarEnlaceCfg(m[1]);
}

function iniciar() {
  var conectado = importarCfg();

  /* Bloques de costos (los usan "Nuevo pedido" y "Editar") */
  $('#costos-nuevo-cont').innerHTML = htmlCostos('c-');
  $('#costos-editar-cont').innerHTML = htmlCostos('ed-c-');
  ligarCostos('c-', function () { return soloNumero($('#total').value); });
  ligarCostos('ed-c-', function () { return soloNumero($('#ed-total').value); });

  pintarListas(); pintarFiltros(); agregarItem();
  ['fecha', 'entregaFecha', 'ed-fecha', 'ed-entregaFecha', 'g-fecha'].forEach(ligarFecha);
  ponerFecha('fecha', hoyISO());
  ligarDinero($('#total'), function () { actualizarSaldo(); pintarResumenCostos('c-', soloNumero($('#total').value)); });
  ligarDinero($('#pago'), actualizarSaldo); ligarDinero($('#pago-monto'));
  ligarDinero($('#ed-total'), function () { pintarResumenCostos('ed-c-', soloNumero($('#ed-total').value)); });
  ligarDinero($('#g-monto'));

  /* Nuevo pedido */
  $('#form').addEventListener('submit', onGuardar);
  $('#btn-limpiar').addEventListener('click', function () { if (confirm('¿Borrar todo lo que escribiste en este pedido?')) limpiarFormulario(); });
  $('#items').addEventListener('click', onItemsClick);
  $('#btn-agregar-item').addEventListener('click', function () { var el = agregarItem(); $('.it-producto', el).focus(); });
  $('#pago-todo').addEventListener('click', function () { ponerDinero($('#pago'), soloNumero($('#total').value)); actualizarSaldo(); });
  $('#pago-mitad').addEventListener('click', function () { ponerDinero($('#pago'), Math.round(soloNumero($('#total').value) / 2)); actualizarSaldo(); });
  $('#pago-nada').addEventListener('click', function () { $('#pago').value = ''; actualizarSaldo(); });
  $$('[data-dias]').forEach(function (b) { b.addEventListener('click', function () { ponerFecha('entregaFecha', sumarDias(hoyISO(), parseInt(b.dataset.dias, 10))); }); });
  $$('input[name="entregaTipo"]').forEach(function (r) { r.addEventListener('change', actualizarEntrega); });

  /* Navegación y avisos */
  $('#nav').addEventListener('click', function (ev) { var b = ev.target.closest('[data-vista]'); if (b) irA(b.dataset.vista); });
  $('#btn-config').addEventListener('click', function () { irA(S.vista === 'ajustes' ? 'pedidos' : 'ajustes'); });
  $('#aviso').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-aviso]'); if (!b) return;
    if (b.dataset.aviso === 'reintentar') { enviarPendientes(false); return; }
    irA('ajustes');
    if (b.dataset.aviso === 'actualizar') { var d = $('#det-script'); d.open = true; d.scrollIntoView({ block: 'start' }); }
  });

  /* Pedidos */
  $('#buscar').addEventListener('input', function (ev) { S.busqueda = ev.target.value; renderPedidos(); });
  $('#filtros').addEventListener('change', function (ev) { if (ev.target.name === 'filtro') { S.filtro = ev.target.value; renderPedidos(); } });
  $('#filtro-mes').addEventListener('change', function (ev) { S.mes = ev.target.value; renderPedidos(); });
  $('#btn-refrescar').addEventListener('click', function () { sincronizar(false).then(function () { return enviarPendientes(true); }); });
  ligarAcciones('#lista');

  /* Diálogos */
  $('#form-editar').addEventListener('submit', onEditar);
  $('#ed-cancelar').addEventListener('click', function () { cerrar($('#dlg-editar')); });
  $('#form-pago').addEventListener('submit', onPago);
  $('#pago-cancelar').addEventListener('click', function () { cerrar($('#dlg-pago')); });
  $('#ok-copiar').addEventListener('click', function () {
    copiar($('#ok-mensaje').value).then(function (ok) { toast(ok ? 'Mensaje copiado, listo para pegar en WhatsApp.' : 'No pude copiar. Selecciona el texto y cópialo a mano.', ok ? '' : 'error'); });
  });
  $('#ok-nuevo').addEventListener('click', function () { cerrar($('#dlg-ok')); irA('nuevo'); var c = $('#cliente'); if (c) c.focus(); });
  $('#ok-ver').addEventListener('click', function () { cerrar($('#dlg-ok')); irA('pedidos'); });

  ligarCalendario(); ligarProduccion(); ligarNumeros(); ligarAjustes();

  /* Mantenerse al día sin que Lorena tenga que tocar nada */
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.vista !== 'nuevo' && S.vista !== 'ajustes') refrescarSiViejo(); });
  window.addEventListener('online', function () { enviarPendientes(true).then(function () { return refrescarSiViejo(5000); }); });
  setInterval(function () { if (!document.hidden && S.vista !== 'nuevo' && S.vista !== 'ajustes') refrescarSiViejo(90000); }, 120000);

  /* Instalar como app */
  window.addEventListener('beforeinstallprompt', function (ev) { ev.preventDefault(); S.instalar = ev; if (S.vista === 'ajustes') pintarInstalar(); });
  window.addEventListener('appinstalled', function () { S.instalar = null; if (S.vista === 'ajustes') pintarInstalar(); toast('App instalada.'); });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () {});

  actualizarSaldo(); actualizarEntrega(); pintarAviso();
  var ultima = leer(LS.ultimaVista, '');
  var inicial = conectado ? 'pedidos' : (VISTAS.indexOf(ultima) >= 0 && ultima !== 'ajustes' ? ultima : (S.cfg.url && S.cfg.clave ? 'pedidos' : 'nuevo'));
  irA(inicial);
  if (S.cfg.url && S.cfg.clave) { sincronizar(false).then(function () { return enviarPendientes(true); }); } else { ponerConexion('sinconfig'); }
}

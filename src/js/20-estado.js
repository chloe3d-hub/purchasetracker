/* Estado */
var DATOS = leer(LS.datos, {});
var S = {
  cfg: Object.assign({ url: CONFIG.URL_APP, clave: CONFIG.CLAVE }, leer(LS.cfg, {})),
  version: DATOS.version || 0,                 // versión del script de la hoja (0 = aún no se sabe)
  config: Object.assign(clonar(CONFIG_BASE), DATOS.config || {}),
  listasLocal: leer(LS.listas, {}),
  listas: null,
  pend: leer(LS.pend, []),
  pendG: leer(LS.pendg, []),
  cache: leer(LS.cache, []),
  gastos: DATOS.gastos || [],
  conexion: 'sinconfig',
  vista: 'nuevo',
  filtro: 'activos', mes: '', busqueda: '', mensajeActual: '',
  cal: { mes: '', dia: '' },
  prod: { imp: 'todas' },
  num: { tab: 'ventas', periodo: 'todo', tabla: false, gmes: '' },
  sync: { enCurso: null, ultima: 0 },
  auto: null,                                  // estado de las automatizaciones (lo pide Ajustes)
  instalar: null
};
function aplicarListas() {
  S.listas = Object.assign({}, LISTAS_BASE, S.version >= 3 ? (S.config.listas || {}) : S.listasLocal);
}
aplicarListas();
function esV3() { return S.version >= 3; }
function guardarDatos() { guardar(LS.datos, { version: S.version, config: S.config, gastos: S.gastos, ts: Date.now() }); }

/* Conexión con la hoja */
function ErrorApi(codigo, msg) { this.codigo = codigo; this.message = msg; }
ErrorApi.prototype = Object.create(Error.prototype);

function api(accion, datos, cfg) {
  cfg = cfg || S.cfg;
  if (!cfg.url || !cfg.clave) return Promise.reject(new ErrorApi('CONFIG', 'Falta conectar la hoja (Ajustes, arriba a la derecha).'));
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, accion === 'calendario_sincronizar' ? 280000 : 45000) : null;
  var cuerpo = Object.assign({ clave: cfg.clave, accion: accion }, datos || {});
  return fetch(cfg.url, { method: 'POST', body: JSON.stringify(cuerpo), signal: ctrl ? ctrl.signal : undefined })
    .then(function (res) {
      clearTimeout(timer);
      return res.json().then(function (json) { return json; }, function () {
        throw new ErrorApi('RESPUESTA', 'La hoja respondió algo inesperado. Revisa que la implementación tenga acceso "Cualquier persona" y que la URL termine en /exec.');
      });
    }, function (e) {
      clearTimeout(timer);
      throw new ErrorApi('RED', e && e.name === 'AbortError' ? 'La hoja tardó demasiado en responder.' : 'No pude comunicarme con la hoja. Revisa tu internet y la URL de conexión.');
    })
    .then(function (json) {
      if (!json || json.ok !== true) throw new ErrorApi('SERVIDOR', (json && json.error) || 'La hoja devolvió un error.');
      return json;
    });
}
function scriptViejo(e) { return e && e.codigo === 'SERVIDOR' && /Acción desconocida|No se puede cambiar el campo/.test(e.message); }

function ponerConexion(estado) {
  S.conexion = estado;
  var txt = { sinconfig: 'Sin conectar', cargando: 'Conectando…', ok: 'Conectado', error: 'Sin conexión' }[estado];
  $('#conexion').setAttribute('data-estado', estado);
  $('#conexion-txt').textContent = txt;
  pintarAviso();
}

/* Avisos (arriba de cada pantalla) */
function pintarAviso() {
  var av = $('#aviso'), html = '';
  if (!S.cfg.url || !S.cfg.clave) {
    html += '<div class="aviso"><span><strong>Todavía no conectas tu hoja.</strong> Entra a Ajustes y pega la URL y la clave. Mientras tanto los pedidos quedan guardados en este dispositivo y se envían apenas conectes.</span>' +
      '<button class="btn small" type="button" data-aviso="config">Conectar ahora</button></div>';
  } else {
    var n = S.pend.length + S.pendG.length;
    if (n) {
      html += '<div class="aviso"><span><strong>' + plural(n, 'registro sin enviar', 'registros sin enviar') + ' a la hoja.</strong> Están a salvo en este dispositivo.</span>' +
        '<button class="btn small" type="button" data-aviso="reintentar">Reintentar envío</button></div>';
    }
    if (S.version === 2) {
      html += '<div class="aviso"><span><strong>Tu hoja usa la versión anterior del script.</strong> Todo lo de antes funciona, pero el calendario de Google, los costos, los gastos y el resumen por correo necesitan actualizarlo.</span>' +
        '<button class="btn small" type="button" data-aviso="actualizar">Cómo actualizarlo</button></div>';
    }
  }
  av.innerHTML = html; av.hidden = !html;
}

function toast(msg, tipo) {
  var t = document.createElement('div');
  t.className = 'toast' + (tipo === 'error' ? ' error' : '');
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(function () { t.remove(); }, tipo === 'error' ? 7000 : 3200);
}
function abrir(dlg) { if (dlg.showModal) { try { dlg.showModal(); return; } catch (e) {} } dlg.setAttribute('open', ''); }
function cerrar(dlg) { if (dlg.close) { try { dlg.close(); return; } catch (e) {} } dlg.removeAttribute('open'); }

/* Sincronizar: una sola llamada trae pedidos, gastos y ajustes */
function firmaListas() { return JSON.stringify(S.listas); }
function sincronizar(silencioso) {
  if (!S.cfg.url || !S.cfg.clave) { ponerConexion('sinconfig'); renderTodo(); return Promise.resolve(); }
  if (S.sync.enCurso) return S.sync.enCurso;
  if (!silencioso) ponerConexion('cargando');
  var antes = firmaListas();
  var p = api('sincronizar').then(function (r) {
    S.version = r.version || 3;
    S.cache = r.pedidos || []; S.gastos = r.gastos || [];
    S.config = Object.assign(clonar(CONFIG_BASE), r.config || {});
    S.sync.ultima = Date.now();
    guardar(LS.cache, S.cache); guardarDatos(); aplicarListas(); ponerConexion('ok');
    migrarListas();
  }, function (e) {
    if (e.codigo === 'SERVIDOR' && /Acción desconocida/.test(e.message)) {
      return api('listar').then(function (r) {
        S.version = 2; S.cache = r.pedidos || []; S.sync.ultima = Date.now();
        guardar(LS.cache, S.cache); guardarDatos(); aplicarListas(); ponerConexion('ok');
      });
    }
    throw e;
  }).catch(function (e) {
    ponerConexion(e.codigo === 'CONFIG' ? 'sinconfig' : 'error');
    if (!silencioso) toast(e.message, 'error');
  }).then(function () {
    S.sync.enCurso = null;
    if (firmaListas() !== antes) pintarListas();
    prellenarEmpaque();
    renderTodo();
  });
  S.sync.enCurso = p;
  return p;
}
/* Si ya tenías listas propias en este dispositivo y la hoja aún no tiene, se suben una vez. */
function migrarListas() {
  if (!esV3() || leer(LS.migrado, false)) return;
  var propias = S.listasLocal || {};
  if (Object.keys(S.config.listas || {}).length || !Object.keys(propias).length) { guardar(LS.migrado, true); return; }
  api('config_guardar', { config: { listas: propias } }).then(function (r) {
    S.config = Object.assign(clonar(CONFIG_BASE), r.config || {}); guardar(LS.migrado, true); guardarDatos(); aplicarListas(); pintarListas();
  }, function () {});
}

/* Datos locales */
function upsertCache(p) {
  if (!p || !p.id) return;
  var i = S.cache.findIndex(function (x) { return x.id === p.id; });
  if (i >= 0) S.cache[i] = p; else S.cache.unshift(p);
  guardar(LS.cache, S.cache);
}
function upsertGasto(g) {
  if (!g || !g.id) return;
  var i = S.gastos.findIndex(function (x) { return x.id === g.id; });
  if (i >= 0) S.gastos[i] = g; else S.gastos.unshift(g);
  guardarDatos();
}
function todosLosPedidos() {
  var pend = S.pend.map(function (p) {
    return Object.assign({}, p, { pendiente: true, id: '', debe: Math.max(0, (p.total || 0) - (p.pago || 0)) });
  });
  return pend.concat(S.cache);
}
function buscarPedido(id) { return S.cache.find(function (p) { return p.id === id; }); }
function esActivo(p) { return p.estado !== 'Entregado' && p.estado !== 'Cancelado'; }
function pedidosReales() { return S.cache; }

/* Envío de lo que quedó guardado sin conexión (pedidos y gastos) */
function enviarCola(clave, lsKey, accion, campo, alExito, silencioso) {
  var cola = S[clave].slice(), enviados = 0;
  if (!cola.length) return Promise.resolve(0);
  var paso = function (i) {
    if (i >= cola.length) return Promise.resolve();
    var it = cola[i], cuerpo = {}; cuerpo[campo] = it;
    return api(accion, cuerpo).then(function (r) {
      alExito(r);
      S[clave] = S[clave].filter(function (x) { return x.ref !== it.ref; });
      enviados++;
      return paso(i + 1);
    }, function (e) {
      if (e.codigo === 'SERVIDOR') {
        var q = S[clave].find(function (x) { return x.ref === it.ref; }); if (q) q.error = e.message;
        return paso(i + 1);
      }
      if (!silencioso) toast(e.message, 'error');
    });
  };
  return paso(0).then(function () { guardar(lsKey, S[clave]); return enviados; });
}
function enviarPendientes(silencioso) {
  return enviarCola('pend', LS.pend, 'crear', 'pedido', function (r) { upsertCache(r.pedido); }, silencioso).then(function (a) {
    return enviarCola('pendG', LS.pendg, 'gasto_crear', 'gasto', function (r) { upsertGasto(r.gasto); }, silencioso).then(function (b) { return a + b; });
  }).then(function (n) {
    pintarAviso(); renderTodo();
    if (n) toast(n === 1 ? 'Se envió 1 registro a la hoja.' : 'Se enviaron ' + n + ' registros a la hoja.');
    return n;
  });
}

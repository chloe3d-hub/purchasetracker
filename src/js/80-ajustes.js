/* Ajustes: conexión, celular, costos, automatizaciones y listas */
function urlValida(u) { return /^https:\/\/script\.google\.com\/.+\/exec$/.test(u); }
function lineas(id) {
  var vistos = {};
  return $('#' + id).value.split('\n').map(function (s) { return s.trim(); }).filter(function (s) {
    if (!s || vistos[s.toLowerCase()]) return false; vistos[s.toLowerCase()] = 1; return true;
  });
}
/* Deja el botón apagado mientras trabaja y lo devuelve a como estaba al terminar */
function trabajando(btn, texto, fn) {
  var antes = btn.textContent; btn.disabled = true; if (texto) btn.textContent = texto;
  var fin = function () { btn.disabled = false; btn.textContent = antes; };
  return Promise.resolve().then(fn).then(function (x) { fin(); return x; }, function (e) { fin(); throw e; });
}
function mensajeDe(e) {
  return scriptViejo(e) ? 'Tu hoja todavía usa la versión anterior del script. Actualízalo y vuelve a intentar (más abajo está cómo).' : e.message;
}

/* Conexión */
function nombreVersion() {
  if (!S.cfg.url || !S.cfg.clave) return 'Aún no hay una hoja conectada en este dispositivo.';
  if (S.version >= 5) return 'Script de la hoja: versión ' + S.version + '. Está al día, tienes todas las funciones.';
  if (S.version === 4) return 'Script de la hoja: versión 4. Todo funciona. La versión 5 agrega guardar en la hoja los porcentajes de la calculadora de precio y los minutos de trabajo de cada ficha (mientras tanto se guardan solo en este dispositivo).';
  if (S.version === 3) return 'Script de la hoja: versión 3. Todo lo anterior funciona, pero faltan las fichas de costo, el precio de la luz y los componentes (actualízalo con los pasos de abajo).';
  if (S.version === 2) return 'Script de la hoja: versión anterior. Los pedidos funcionan, pero faltan el calendario de Google, los costos, los gastos y el resumen por correo.';
  return 'Todavía no sé qué versión del script tiene tu hoja. Toca "Probar conexión".';
}
function probarConexion() {
  var cfg = { url: $('#cfg-url').value.trim(), clave: $('#cfg-clave').value };
  var out = $('#cfg-prueba'); out.className = 'prueba';
  if (!cfg.url || !cfg.clave) { out.textContent = 'Pega la URL y la clave primero.'; out.className = 'prueba mal'; return Promise.resolve(); }
  if (!urlValida(cfg.url)) { out.textContent = 'La URL debe empezar con https://script.google.com/ y terminar en /exec.'; out.className = 'prueba mal'; return Promise.resolve(); }
  out.textContent = 'Probando…';
  return api('ping', {}, cfg).then(function (r) {
    var v = r.version || 2;
    out.textContent = 'Conectado. La pestaña "' + r.hoja + '" tiene ' + plural(r.pedidos, 'pedido', 'pedidos') + '. ' +
      (v >= 4 ? 'El script está en la versión ' + v + ', al día.' : (v === 3 ? 'El script es la versión 3: funciona, pero para usar las fichas de costo hay que actualizarlo a la 4.' : 'El script es de la versión anterior; para usar todo lo nuevo hay que actualizarlo.'));
    out.className = 'prueba ok';
  }, function (e) { out.textContent = e.message; out.className = 'prueba mal'; });
}
function guardarConexion() {
  var url = $('#cfg-url').value.trim(), clave = $('#cfg-clave').value, hoja = $('#cfg-hoja-url').value.trim();
  if ((url || clave) && !urlValida(url)) { toast('La URL debe empezar con https://script.google.com/ y terminar en /exec.', 'error'); return; }
  if (hoja && !/^https:\/\/docs\.google\.com\/spreadsheets\//.test(hoja)) { toast('El enlace de la hoja debe empezar con https://docs.google.com/spreadsheets/', 'error'); return; }
  var cambioHoja = url !== S.cfg.url;
  S.cfg = { url: url, clave: clave, hoja: hoja }; guardar(LS.cfg, S.cfg);
  if (cambioHoja) { S.version = 0; S.auto = null; }
  toast('Conexión guardada.');
  sincronizar(false).then(function () { return enviarPendientes(true); }).then(function () { llenarAjustes(); cargarAuto(); });
}
function olvidarConexion() {
  if (!confirm('¿Desconectar este dispositivo? Se borra de aquí la conexión y los pedidos guardados en la memoria del teléfono. Tu hoja de Google no se toca.')) return;
  S.cfg = { url: '', clave: '', hoja: '' }; S.version = 0; S.cache = []; S.gastos = []; S.fichas = []; S.auto = null;
  S.config = clonar(CONFIG_BASE); aplicarListas();
  guardar(LS.cfg, S.cfg); guardar(LS.cache, []); guardarDatos();
  ponerConexion('sinconfig'); pintarListas(); llenarAjustes(); renderTodo(); toast('Dispositivo desconectado.');
}

/* Abrir la app en el celular */
function baseApp() {
  var p = location.protocol, local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  return (p === 'http:' || p === 'https:') && !local ? location.origin + location.pathname : URL_PUBLICA;
}
function enlaceCelular() {
  if (!S.cfg.url || !S.cfg.clave) return '';
  return baseApp() + '#cfg=' + aB64Url(JSON.stringify({ u: S.cfg.url, k: S.cfg.clave, h: S.cfg.hoja || '' }));
}
function pintarQR() {
  var box = $('#cel-qr'), enlace = enlaceCelular();
  if (!enlace) { box.innerHTML = ''; return; }
  var svg = '';
  try { var qr = qrcode(0, 'L'); qr.addData(enlace); qr.make(); svg = qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true }); } catch (e) {}
  box.innerHTML = svg ? '<div class="qr">' + svg + '</div><p class="hint">Abre la cámara del celular, apúntala aquí y toca el aviso que aparece. El código se genera en este dispositivo, no se manda a ningún servidor.</p>'
    : '<p class="err">No pude armar el código. Usa el botón de copiar el enlace.</p>';
}
function esIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function yaInstalada() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
function pintarInstalar() {
  var t = $('#cel-instalar-txt'), b = $('#btn-instalar');
  b.hidden = true;
  if (yaInstalada()) { t.textContent = 'Ya estás usando la app instalada.'; return; }
  if (S.instalar) { b.hidden = false; t.textContent = 'Instálala para abrirla desde el ícono de tu pantalla, sin buscar el enlace.'; return; }
  if (esIOS()) { t.textContent = 'En iPhone: abre este enlace en Safari, toca el botón Compartir y elige "Agregar a pantalla de inicio".'; return; }
  t.textContent = 'En el celular: abre el enlace en Chrome, toca los tres puntos y elige "Instalar app" o "Agregar a pantalla de inicio".';
}
function copiarEnlace() {
  var e = enlaceCelular(); if (!e) { toast('Primero conecta tu hoja.', 'error'); return; }
  copiar(e).then(function (ok) { toast(ok ? 'Enlace copiado. Pégalo en un mensaje a tu celular.' : 'No pude copiar el enlace.', ok ? '' : 'error'); });
}
function compartirEnlace() {
  var e = enlaceCelular(); if (!e) { toast('Primero conecta tu hoja.', 'error'); return; }
  if (navigator.share) navigator.share({ title: 'Pedidos Yi Shu', text: 'Abre este enlace para conectar la app de pedidos de Yi Shu:', url: e }).catch(function () {});
  else copiarEnlace();
}

/* Costos */
function filaImpresora(i) {
  var num = function (v) { return Number(v) > 0 ? esc(numTxt(v)) : ''; };
  return '<div class="imp-fila" data-imp>' +
    '<div class="field"><label>Nombre<input type="text" class="imp-nombre" maxlength="40" autocomplete="off" value="' + esc(i.nombre) + '"></label></div>' +
    '<div class="field"><label>Costo por hora<span class="money"><input type="text" class="imp-costo" inputmode="decimal" autocomplete="off" value="' + num(i.costoHora) + '"></span></label></div>' +
    '<button type="button" class="btn small ghost imp-quitar">Quitar</button>' +
    '<details class="imp-calc"' + (esV4() ? '' : ' hidden') + '><summary>Calcular el costo por hora</summary><div class="stack">' +
      '<p class="hint">Luz + desgaste + mantenimiento. La luz usa el precio por kWh de arriba. El desgaste es lo que costó la impresora dividido entre las horas de vida que decidas asumir: no hay una cifra oficial, es tu supuesto.</p>' +
      '<div class="grid2 collapse">' +
        '<div class="field"><label>Lo que costó la impresora<span class="money"><input type="text" class="imp-precio" inputmode="numeric" autocomplete="off" value="' + (Number(i.precio) > 0 ? miles(i.precio) : '') + '"></span></label></div>' +
        '<div class="field"><label>Horas de vida que asumes<input type="text" class="imp-vida" inputmode="decimal" autocomplete="off" value="' + num(i.vidaHoras) + '"></label></div>' +
        '<div class="field"><label>Vatios promedio al imprimir<input type="text" class="imp-vatios" inputmode="decimal" autocomplete="off" value="' + num(i.vatios) + '"></label>' +
          '<p class="hint">Lo más exacto: mide una impresión completa con un medidor de enchufe y calcula kWh ÷ horas × 1000.</p></div>' +
        '<div class="field"><label>Mantenimiento por hora<span class="money"><input type="text" class="imp-mant" inputmode="numeric" autocomplete="off" value="' + (Number(i.mantenimientoHora) > 0 ? miles(i.mantenimientoHora) : '') + '"></span></label>' +
          '<p class="hint">Boquillas, placas, correas. Déjalo vacío si no lo quieres contar.</p></div>' +
      '</div>' +
      '<div class="acciones"><button type="button" class="btn small imp-calcular">Calcular y usar este costo</button></div>' +
      '<p class="hint imp-desglose" role="status"></p>' +
    '</div></details></div>';
}
function ligarFilaImp(fila) { ligarDinero($('.imp-precio', fila)); ligarDinero($('.imp-mant', fila)); }
function calcularCostoHoraImp(fila) {
  var luz = decimalDe($('#cos-luz').value), w = decimalDe($('.imp-vatios', fila).value), vida = decimalDe($('.imp-vida', fila).value);
  var precio = soloNumero($('.imp-precio', fila).value), mant = soloNumero($('.imp-mant', fila).value);
  var out = $('.imp-desglose', fila);
  if (!decimalOk($('.imp-vatios', fila).value) || !decimalOk($('.imp-vida', fila).value) || !decimalOk($('#cos-luz').value)) { out.textContent = 'Escribe solo números (por ejemplo 100 o 3000).'; return; }
  var pLuz = w / 1000 * luz, pDes = vida > 0 ? precio / vida : 0, total = Math.round(pLuz + pDes + mant), falta = [];
  if (!(luz > 0)) falta.push('el precio de la luz (arriba)');
  if (!(w > 0)) falta.push('los vatios');
  if (!(precio > 0) || !(vida > 0)) falta.push('el precio y las horas de vida de la impresora');
  if (!(total > 0)) { out.textContent = 'Todavía no hay datos para calcular. Faltan: ' + falta.join(', ') + '.'; return; }
  $('.imp-costo', fila).value = numTxt(total);
  out.textContent = 'Luz ' + dinero(pLuz) + ' + desgaste ' + dinero(pDes) + ' + mantenimiento ' + dinero(mant) + ' = ' + dinero(total) + ' por hora.' +
    (falta.length ? ' Faltan: ' + falta.join(', ') + '. Esa parte cuenta como $0.' : '') + ' Toca "Guardar costos" para que quede.';
}
function pintarCostosAjustes() {
  $('#cos-gramo').value = Number(S.config.costoGramo) > 0 ? numTxt(S.config.costoGramo) : '';
  $('#cos-luz').value = Number(S.config.luzKwh) > 0 ? numTxt(S.config.luzKwh) : '';
  $('#cos-luz').closest('.field').hidden = !esV4();
  ponerDinero($('#cos-empaque'), Number(S.config.empaque) || 0);
  $('#cos-imp').innerHTML = (S.config.impresoras || []).map(filaImpresora).join('');
  $$('#cos-imp [data-imp]').forEach(ligarFilaImp);
}
function leerImpresoras() {
  return $$('#cos-imp [data-imp]').map(function (f) {
    var o = { nombre: $('.imp-nombre', f).value.trim(), costoHora: decimalDe($('.imp-costo', f).value) };
    var datos = { precio: soloNumero($('.imp-precio', f).value), vidaHoras: decimalDe($('.imp-vida', f).value), vatios: decimalDe($('.imp-vatios', f).value), mantenimientoHora: soloNumero($('.imp-mant', f).value) };
    Object.keys(datos).forEach(function (k) { if (datos[k] > 0) o[k] = datos[k]; });
    o.malNumero = !decimalOk($('.imp-vida', f).value) || !decimalOk($('.imp-vatios', f).value) || !decimalOk($('.imp-costo', f).value);
    return o;
  });
}
function guardarCostos() {
  var imps = leerImpresoras(), vistos = {}, mal = '';
  imps.forEach(function (i) {
    if (!i.nombre) mal = 'Cada impresora necesita un nombre.';
    else if (vistos[i.nombre.toLowerCase()]) mal = 'La impresora "' + i.nombre + '" está repetida.';
    else if (i.malNumero) mal = 'En "' + i.nombre + '" hay un número que no se entiende. Escribe solo dígitos, por ejemplo 3000 o 87,5.';
    vistos[i.nombre.toLowerCase()] = 1;
    delete i.malNumero;
  });
  if (!decimalOk($('#cos-gramo').value) || !decimalOk($('#cos-luz').value)) mal = 'El costo por gramo y el precio de la luz deben ser solo números, por ejemplo 68 o 875,05.';
  if (mal) { toast(mal, 'error'); return Promise.resolve(); }
  var cambios = { impresoras: imps, costoGramo: decimalDe($('#cos-gramo').value), empaque: soloNumero($('#cos-empaque').value) };
  if (esV4()) cambios.luzKwh = decimalDe($('#cos-luz').value);
  return trabajando($('#cos-guardar'), 'Guardando…', function () {
    return api('config_guardar', { config: cambios }).then(function (r) {
      S.config = Object.assign(clonar(CONFIG_BASE), r.config || {}); guardarDatos(); pintarImpresoras('c-'); pintarImpresoras('ed-c-'); prellenarEmpaque();
      pintarCostosAjustes(); pintarFichas(); toast('Costos guardados. Los pedidos nuevos usan estos precios.');
    });
  }).catch(function (e) { toast(mensajeDe(e), 'error'); });
}
function recalcularCostos() {
  if (!confirm('Esto vuelve a calcular el costo de los pedidos que tienen horas, gramos u otros costos anotados, con los precios de ahora. ¿Seguimos?')) return Promise.resolve();
  return trabajando($('#cos-recalcular'), 'Calculando…', function () {
    return api('costos_recalcular').then(function (r) {
      toast(r.cambiados ? plural(r.cambiados, 'pedido actualizado', 'pedidos actualizados') + '.' : 'Ningún pedido cambió de costo.');
      return sincronizar(true);
    });
  }).catch(function (e) { toast(mensajeDe(e), 'error'); });
}

/* Automatizaciones */
function cargarAuto() {
  if (!esV3() || !S.cfg.url) return Promise.resolve();
  return api('automatizaciones_estado').then(function (r) { S.auto = r.estado; pintarAuto(); }, function () {});
}
function textoUltimo(u, vacio) {
  if (!u) return vacio;
  return (u.ok ? 'Última vez: ' : 'Falló la última vez (') + ahoraTxt(u.fecha) + (u.ok ? '' : '): ' + (u.msg || 'sin detalle')) + (u.ok && u.msg ? '. ' + u.msg : '.');
}
/* rellenar: también vuelve a poner hora y correo con lo guardado (si no, se respeta lo que estás escribiendo) */
function pintarAuto(rellenar) {
  var v3 = esV3(), a = S.auto, cfg = S.config;
  $('#aj-auto-v2').hidden = v3 || !S.cfg.url;
  $('#aj-auto-ok').hidden = !v3;
  if (!v3) return;
  $('#auto-calendario').checked = !!cfg.calendario;
  $('#auto-resumen').checked = a ? !!a.resumen.activo : !!cfg.resumen;
  $('#auto-respaldo').checked = a ? !!a.respaldo.activo : !!cfg.respaldo;
  $('#auto-sync-cal').hidden = !cfg.calendario;
  var h = $('#auto-hora'); if (!h.options.length) { for (var i = 0; i < 24; i++) h.add(new Option(horaTxt(i), String(i))); }
  var em = $('#auto-email');
  if (rellenar) { h.value = String(cfg.resumenHora == null ? 7 : cfg.resumenHora); em.value = cfg.resumenEmail || ''; }
  em.placeholder = a && a.correoDueno ? 'Si lo dejas vacío llega a ' + a.correoDueno : 'Tu correo de Google';
  var avisos = [];
  if (a && a.permisos === false) avisos.push('Faltan permisos en el script. En Apps Script elige la función autorizarPermisos, toca Ejecutar, acepta, y crea una nueva versión de la implementación. Detalle: ' + (a.permisosMensaje || ''));
  if (a && a.zonaScript && a.zonaScript !== 'America/Bogota') avisos.push('La zona horaria del script es ' + a.zonaScript + ' y no Bogotá. Las entregas del calendario podrían caer un día corridas. Cámbiala en Apps Script > Configuración del proyecto.');
  if (a && a.resumen.faltaGatillo) avisos.push('El resumen está encendido pero Google no tiene el horario creado. Apágalo y vuélvelo a encender.');
  if (a && a.respaldo.faltaGatillo) avisos.push('La copia semanal está encendida pero Google no tiene el horario creado. Apágala y vuélvela a encender.');
  $('#auto-avisos').innerHTML = avisos.map(function (t) { return '<p class="aviso-mini">' + esc(t) + '</p>'; }).join('');
  $('#auto-resumen-ultimo').textContent = textoUltimo(a && a.resumen.ultimo, 'Todavía no se ha enviado ninguno.');
  $('#auto-respaldo-ultimo').textContent = textoUltimo(a && a.respaldo.ultimo, 'Todavía no se ha hecho ninguna.') + (a ? ' Se guardan en tu Drive, carpeta "' + a.respaldo.carpeta + '" (las últimas ' + a.respaldo.conserva + ').' : '');
}
function activar(ajustes, input) {
  if (input) input.disabled = true;
  var fin = function () { if (input) input.disabled = false; };
  return api('automatizaciones_activar', { ajustes: ajustes }).then(function (r) {
    S.config = Object.assign(clonar(CONFIG_BASE), r.config || {}); S.auto = r.estado; guardarDatos(); pintarAuto('resumenHora' in ajustes || 'resumenEmail' in ajustes); renderTodo();
    fin(); return r;
  }, function (e) {
    toast(mensajeDe(e), 'error'); pintarAuto(); fin(); throw e;
  });
}
function ligarAuto() {
  $('#auto-calendario').addEventListener('change', function (ev) {
    var on = ev.target.checked;
    activar({ calendario: on }, ev.target).then(function () {
      toast(on ? 'Calendario encendido. Toca "Sincronizar ahora" para subir las entregas que ya tienes.' : 'Calendario apagado. Lo que ya está en Google Calendar se queda ahí.');
    }, function () {});
  });
  $('#auto-resumen').addEventListener('change', function (ev) {
    var on = ev.target.checked;
    activar({ resumen: on, resumenHora: parseInt($('#auto-hora').value, 10), resumenEmail: $('#auto-email').value.trim() }, ev.target).then(function () {
      toast(on ? 'Resumen diario encendido.' : 'Resumen diario apagado.');
    }, function () {});
  });
  $('#auto-respaldo').addEventListener('change', function (ev) {
    var on = ev.target.checked;
    activar({ respaldo: on }, ev.target).then(function () { toast(on ? 'Copia semanal encendida. Se hace los lunes de madrugada.' : 'Copia semanal apagada.'); }, function () {});
  });
  $('#auto-guardar-resumen').addEventListener('click', function () {
    trabajando($('#auto-guardar-resumen'), 'Guardando…', function () {
      return activar({ resumenHora: parseInt($('#auto-hora').value, 10), resumenEmail: $('#auto-email').value.trim() }).then(function () { toast('Guardado.'); });
    }).catch(function () {});
  });
  $('#auto-probar-resumen').addEventListener('click', function () {
    trabajando($('#auto-probar-resumen'), 'Enviando…', function () {
      return api('resumen_probar').then(function (r) { toast(r.enviado ? 'Te mandé un resumen a ' + r.para.join(', ') + '.' : (r.motivo || 'No había nada que enviar.')); return cargarAuto(); });
    }).catch(function (e) { toast(mensajeDe(e), 'error'); });
  });
  $('#auto-sync-cal').addEventListener('click', function () {
    trabajando($('#auto-sync-cal'), 'Sincronizando…', function () {
      return api('calendario_sincronizar').then(function (r) {
        var t = [];
        if (r.creados) t.push(plural(r.creados, 'creada', 'creadas'));
        if (r.actualizados) t.push(plural(r.actualizados, 'actualizada', 'actualizadas'));
        if (r.borrados) t.push(plural(r.borrados, 'borrada', 'borradas'));
        toast(t.length ? 'Calendario al día: ' + t.join(', ') + '.' : 'El calendario ya estaba al día.');
        if (r.pendientes) toast('Quedaron ' + plural(r.pendientes, 'pedido', 'pedidos') + ' para otra vuelta. Toca de nuevo.', 'error');
        if (r.errores && r.errores.length) toast(plural(r.errores.length, 'pedido no se pudo', 'pedidos no se pudieron') + ' subir: ' + r.errores[0], 'error');
        return sincronizar(true);
      });
    }).catch(function (e) { toast(mensajeDe(e), 'error'); });
  });
  $('#auto-respaldar').addEventListener('click', function () {
    trabajando($('#auto-respaldar'), 'Copiando…', function () {
      return api('respaldo_ahora').then(function (r) { toast('Copia lista: "' + r.respaldo.nombre + '" en tu Drive.'); return cargarAuto(); });
    }).catch(function (e) { toast(mensajeDe(e), 'error'); });
  });
}

/* Listas */
function llenarListas() {
  $('#lista-productos').value = S.listas.productos.join('\n');
  $('#lista-canales').value = S.listas.canales.join('\n');
  $('#lista-metodos').value = S.listas.metodos.join('\n');
  $('#lista-transportadoras').value = S.listas.transportadoras.join('\n');
  $('#lista-gastos').value = (S.config.gastoCategorias || CONFIG_BASE.gastoCategorias).join('\n');
  $('#lista-gastos').closest('.field').hidden = !esV3();
}
function guardarListas() {
  var nuevas = { productos: lineas('lista-productos'), canales: lineas('lista-canales'), metodos: lineas('lista-metodos'), transportadoras: lineas('lista-transportadoras') };
  Object.keys(nuevas).forEach(function (k) { if (!nuevas[k].length) nuevas[k] = LISTAS_BASE[k]; });
  var propias = {};
  Object.keys(nuevas).forEach(function (k) { if (nuevas[k].join('\n') !== LISTAS_BASE[k].join('\n')) propias[k] = nuevas[k]; });
  if (!esV3()) {
    S.listasLocal = propias; guardar(LS.listas, propias); aplicarListas(); pintarListas(); llenarListas();
    toast('Listas guardadas en este dispositivo. Con el script nuevo se comparten con todos los dispositivos.'); return Promise.resolve();
  }
  var cambios = { listas: propias };
  var gastos = lineas('lista-gastos'); if (gastos.length) cambios.gastoCategorias = gastos;
  return trabajando($('#lista-guardar'), 'Guardando…', function () {
    return api('config_guardar', { config: cambios }).then(function (r) {
      S.config = Object.assign(clonar(CONFIG_BASE), r.config || {}); guardarDatos(); aplicarListas(); pintarListas(); llenarListas();
      toast('Listas guardadas. Se ven en todos los dispositivos.');
    });
  }).catch(function (e) { toast(mensajeDe(e), 'error'); });
}

/* Pantalla */
function llenarAjustes() {
  $('#cfg-url').value = S.cfg.url || ''; $('#cfg-clave').value = S.cfg.clave || '';
  var hojaUrl = S.cfg.hoja || CONFIG.URL_HOJA;
  $('#cfg-hoja-url').value = S.cfg.hoja || '';
  $('#cfg-hoja').href = hojaUrl || '#'; $('#cfg-hoja').hidden = !hojaUrl;
  $('#cfg-prueba').textContent = ''; $('#cfg-prueba').className = 'prueba';
  $('#cel-qr').hidden = true; $('#cel-qr-btn').textContent = 'Mostrar código QR';
  pintarCostosAjustes(); pintarPreciosAjustes(); pintarComponentes(); llenarListas(); pintarAjustesEstado(); pintarAuto(true);
  cargarCatalogo(false);
}
function pintarAjustesEstado() {
  $('#aj-version').textContent = nombreVersion();
  var v3 = esV3();
  $('#aj-costos-v2').hidden = v3 || !S.cfg.url;
  $('#aj-costos-ok').hidden = !v3 && !!S.cfg.url;
  pintarFichas(); pintarAuto(); pintarInstalar();
  var tiene = !!enlaceCelular();
  $('#cel-sin-conexion').hidden = tiene; $('#cel-con-conexion').hidden = !tiene;
  $('#ver-app').textContent = 'Versión de la app ' + APP_VERSION;
}
function ligarAjustes() {
  $('#cfg-probar').addEventListener('click', probarConexion);
  $('#cfg-guardar').addEventListener('click', guardarConexion);
  $('#cfg-olvidar').addEventListener('click', olvidarConexion);
  $('#cfg-pegar-ok').addEventListener('click', function () {
    var m = /#cfg=([A-Za-z0-9_-]+)/.exec($('#cfg-pegar').value);
    if (!m) { toast('Ese texto no parece un enlace de conexión. Debe contener "#cfg=".', 'error'); return; }
    if (aplicarEnlaceCfg(m[1])) { $('#cfg-pegar').value = ''; llenarAjustes(); sincronizar(false).then(function () { return enviarPendientes(true); }).then(function () { llenarAjustes(); cargarAuto(); }); }
  });
  $('#cel-copiar').addEventListener('click', copiarEnlace);
  $('#cel-compartir').addEventListener('click', compartirEnlace);
  $('#cel-qr-btn').addEventListener('click', function () {
    var box = $('#cel-qr'); box.hidden = !box.hidden;
    if (!box.hidden) pintarQR();
    $('#cel-qr-btn').textContent = box.hidden ? 'Mostrar código QR' : 'Ocultar código QR';
  });
  $('#btn-instalar').addEventListener('click', function () {
    var ev = S.instalar; if (!ev) return;
    ev.prompt(); ev.userChoice.then(function () { S.instalar = null; pintarInstalar(); }, function () {});
  });
  $('#cos-agregar-imp').addEventListener('click', function () {
    if ($$('#cos-imp [data-imp]').length >= 12) { toast('Máximo 12 impresoras.', 'error'); return; }
    var d = document.createElement('div'); d.innerHTML = filaImpresora({ nombre: '', costoHora: 0 });
    $('#cos-imp').appendChild(d.firstChild); ligarFilaImp($('#cos-imp').lastChild); var n = $$('#cos-imp .imp-nombre'); n[n.length - 1].focus();
  });
  $('#cos-imp').addEventListener('click', function (ev) {
    var c = ev.target.closest('.imp-calcular'); if (c) { calcularCostoHoraImp(c.closest('[data-imp]')); return; }
    var b = ev.target.closest('.imp-quitar'); if (!b) return;
    var fila = b.closest('[data-imp]'), nom = $('.imp-nombre', fila).value.trim();
    if (!nom || confirm('¿Quitar "' + nom + '" de la lista? Los pedidos que ya la usaron conservan su nombre.')) fila.remove();
  });
  ligarDinero($('#cos-empaque'));
  ligarFichas(); ligarPrecios();
  $('#cos-guardar').addEventListener('click', guardarCostos);
  $('#cos-recalcular').addEventListener('click', recalcularCostos);
  ligarAuto();
  $('#lista-guardar').addEventListener('click', guardarListas);
  $('#lista-restaurar').addEventListener('click', function () {
    $('#lista-productos').value = LISTAS_BASE.productos.join('\n'); $('#lista-canales').value = LISTAS_BASE.canales.join('\n');
    $('#lista-metodos').value = LISTAS_BASE.metodos.join('\n'); $('#lista-transportadoras').value = LISTAS_BASE.transportadoras.join('\n');
    $('#lista-gastos').value = CONFIG_BASE.gastoCategorias.join('\n');
  });
}

/* Guardar pedido */
function mostrarGuardado(p, info) {
  $('#ok-titulo').textContent = info.pendiente ? 'Guardado en este dispositivo' : 'Pedido ' + p.id + ' guardado';
  var sub;
  if (info.pendiente) sub = (info.motivo || 'No se pudo enviar a la hoja.') + ' El pedido está a salvo aquí y se enviará cuando haya conexión.';
  else if (p.duplicado) sub = 'Este pedido ya estaba en la hoja, no se duplicó.';
  else sub = p.cliente + ' · ' + p.producto + ' · ' + dinero(p.total) + (p.debe > 0 ? ' · debe ' + dinero(p.debe) : ' · pagado');
  if (p.avisos && p.avisos.length) sub += ' ' + p.avisos[0];
  $('#ok-sub').textContent = sub;
  S.mensajeActual = mensajeCliente(p);
  $('#ok-mensaje').value = S.mensajeActual;
  abrir($('#dlg-ok'));
}

function onGuardar(ev) {
  ev.preventDefault();
  var items = leerItems(), d = leerFormularioCompleto(items), errs = validar(d, items);
  mostrarErrores(errs);
  if (errs.length) return;
  var btn = $('#btn-guardar');
  btn.disabled = true; btn.textContent = 'Guardando…';
  var p = Object.assign({ ref: nuevoRef() }, d);
  api('crear', { pedido: p }).then(function (r) {
    upsertCache(r.pedido); ponerConexion('ok');
    limpiarFormulario(); renderTodo();
    mostrarGuardado(r.pedido, { pendiente: false });
  }, function (e) {
    if (e.codigo === 'SERVIDOR') { toast(e.message, 'error'); return; }
    S.pend.push(p); guardar(LS.pend, S.pend);
    ponerConexion(e.codigo === 'CONFIG' ? 'sinconfig' : 'error');
    limpiarFormulario(); renderTodo();
    mostrarGuardado(p, { pendiente: true, motivo: e.message });
  }).then(function () { btn.disabled = false; btn.textContent = 'Guardar pedido'; });
}

/* Lista de pedidos */
var FILTROS = [['activos', 'En curso'], ['cobrar', 'Por cobrar'], ['semana', 'Entregas de la semana'], ['entregados', 'Entregados'], ['todos', 'Todos']];
function pintarFiltros() {
  $('#filtros').innerHTML = FILTROS.map(function (f) {
    return '<label class="chip"><input type="radio" name="filtro" value="' + f[0] + '"' + (S.filtro === f[0] ? ' checked' : '') + '><span>' + f[1] + '</span></label>';
  }).join('');
}
function pasaFiltro(p) {
  var f = S.filtro, d = p.entregaFecha ? diasHasta(p.entregaFecha) : null;
  if (f === 'activos') return esActivo(p);
  if (f === 'cobrar') return p.estado !== 'Cancelado' && (p.debe || 0) > 0;
  if (f === 'semana') return esActivo(p) && d !== null && d <= 7;
  if (f === 'entregados') return p.estado === 'Entregado';
  return true;
}
function pasaBusqueda(p) {
  var q = S.busqueda.trim().toLowerCase(); if (!q) return true;
  return [p.id, p.cliente, p.producto, p.contacto, p.canal].join(' ').toLowerCase().indexOf(q) >= 0;
}
function badgeEstado(p) {
  var m = { 'Recibido': 'b-mute', 'En producción': 'b-info', 'Listo para entrega': 'b-violet', 'Enviado': 'b-violet', 'Entregado': 'b-ok', 'Cancelado': 'b-mute' };
  return '<span class="badge ' + (m[p.estado] || 'b-mute') + '">' + esc(p.estado) + '</span>';
}
/* Mes en que se hizo el pedido (por la fecha del pedido) */
function mesDe(p) { return mesDeIso(p.fecha); }
function pasaMes(p) { return !S.mes || mesDe(p) === S.mes; }
function pintarMeses(todos) {
  var vistos = {}; todos.forEach(function (p) { var m = mesDe(p); if (m) vistos[m] = 1; });
  if (S.mes) vistos[S.mes] = 1;
  var meses = Object.keys(vistos).sort().reverse(), firma = meses.join(','), sel = $('#filtro-mes');
  if (sel.dataset.firma !== firma) {
    sel.innerHTML = '<option value="">Todos los meses</option>' + meses.map(function (m) { return '<option value="' + m + '">' + esc(nombreMes(m)) + '</option>'; }).join('');
    sel.dataset.firma = firma;
  }
  sel.value = S.mes;
}
function pintarStats(lista) {
  var vivos = lista.filter(function (p) { return p.estado !== 'Cancelado'; });
  var porCobrar = vivos.reduce(function (a, p) { return a + (p.debe || 0); }, 0);
  var activos = vivos.filter(esActivo);
  var prox = activos.filter(function (p) { var d = p.entregaFecha ? diasHasta(p.entregaFecha) : null; return d !== null && d >= 0 && d <= 7; }).length;
  var vencidos = activos.filter(function (p) { var d = p.entregaFecha ? diasHasta(p.entregaFecha) : null; return d !== null && d < 0; }).length;
  var enProd = vivos.filter(function (p) { return p.estado === 'En producción'; }).length;
  var delMes = vivos.filter(pasaMes);
  var vendido = delMes.reduce(function (a, p) { return a + (p.total || 0); }, 0);
  $('#stats').innerHTML =
    '<div class="stat"><span class="t">Por cobrar</span><span class="v">' + dinero(porCobrar) + '</span></div>' +
    '<div class="stat"><span class="t">Entregas en 7 días</span><span class="v">' + prox + '</span>' + (vencidos ? '<span class="s">' + vencidos + (vencidos === 1 ? ' vencida' : ' vencidas') + '</span>' : '') + '</div>' +
    '<div class="stat"><span class="t">En producción</span><span class="v">' + enProd + '</span></div>' +
    '<div class="stat"><span class="t">' + (S.mes ? 'Vendido en ' + esc(nombreMes(S.mes)) : 'Vendido en total') + '</span><span class="v">' + dinero(vendido) + '</span><span class="s n">' + delMes.length + (delMes.length === 1 ? ' pedido' : ' pedidos') + '</span></div>';
}
/* Cuándo es la entrega, en palabras */
function cuandoEntrega(p) {
  if (p.estado === 'Entregado') return { txt: 'Entregado', clase: 'b-ok' };
  if (p.estado === 'Cancelado') return { txt: 'Cancelado', clase: 'b-mute' };
  if (!p.entregaFecha) return { txt: 'Sin fecha', clase: 'b-mute' };
  var d = diasHasta(p.entregaFecha);
  if (d === null) return { txt: p.entregaFecha, clase: 'b-mute' };
  if (d < 0) return { txt: 'Vencido hace ' + (-d) + (d === -1 ? ' día' : ' días'), clase: 'b-late' };
  if (d === 0) return { txt: 'Hoy', clase: 'b-warn' };
  if (d === 1) return { txt: 'Mañana', clase: 'b-warn' };
  return { txt: 'En ' + d + ' días', clase: d <= 7 ? 'b-warn' : 'b-mute' };
}
function textoImpresion(p) {
  var t = [];
  if (p.impresora) t.push(p.impresora);
  if (typeof p.horas === 'number') t.push(numTxt(p.horas) + ' h');
  if (typeof p.gramos === 'number') t.push(numTxt(p.gramos) + ' g');
  return t.join(' · ');
}
function tarjeta(p) {
  var cu = cuandoEntrega(p);
  var pago = (p.debe || 0) > 0
    ? '<span class="badge b-warn">Debe ' + dinero(p.debe) + '</span>'
    : '<span class="badge b-ok">Pagado</span>';
  var entrega = p.entregaTipo === 'Envío'
    ? 'Envío' + (p.entregaVia ? ' · ' + esc(p.entregaVia) : '') + (p.direccion ? ' · ' + esc(p.direccion) : '')
    : 'Lo recogen' + (p.entregaVia ? ' · ' + esc(p.entregaVia) : '');
  var imp = textoImpresion(p);
  var ganancia = '';
  if (typeof p.costoTotal === 'number' && p.costoTotal > 0 && p.estado !== 'Cancelado') {
    var g = (p.total || 0) - p.costoTotal;
    ganancia = '<div class="fila"><b>Ganancia</b><span>' + (g >= 0 ? dinero(g) + ' (' + Math.round(g * 100 / (p.total || 1)) + '%)' : 'Pérdida de ' + dinero(-g)) + ' · costo ' + dinero(p.costoTotal) + '</span></div>';
  }
  var filas =
    '<div class="fila"><b>Entrega</b><span>' + (p.entregaFecha ? esc(fechaCorta(p.entregaFecha)) + ' · ' : '') + '<span class="badge ' + cu.clase + '">' + esc(cu.txt) + '</span></span></div>' +
    '<div class="fila"><b>Cómo</b><span>' + entrega + '</span></div>' +
    '<div class="fila"><b>Pago</b><span>' + dinero(p.pago) + ' de ' + dinero(p.total) + ' ' + pago + (p.metodoPago ? ' · ' + esc(p.metodoPago) : '') + '</span></div>' +
    (p.canal ? '<div class="fila"><b>Canal</b><span>' + esc(p.canal) + (p.contacto ? ' · ' + esc(p.contacto) : '') + '</span></div>' : '') +
    (imp ? '<div class="fila"><b>Impresión</b><span>' + esc(imp) + '</span></div>' : '') +
    ganancia +
    (p.detalles ? '<div class="fila"><b>Detalles</b><span>' + esc(p.detalles) + '</span></div>' : '') +
    (p.notas ? '<div class="fila"><b>Notas</b><span>' + esc(p.notas) + '</span></div>' : '');

  if (p.pendiente) {
    return '<article class="pedido"><div class="pedido-top"><div><p class="id">SIN ENVIAR A LA HOJA</p><h3>' + esc(p.cliente) + '</h3><p class="prod">' + esc(textoProducto(p)) + '</p></div>' +
      '<div class="badges"><span class="badge b-late">Pendiente</span></div></div><div class="filas">' + filas + '</div>' +
      (p.error ? '<p class="err">La hoja lo rechazó: ' + esc(p.error) + '</p>' : '') +
      '<div class="acciones"><button class="btn small" type="button" data-accion="reintentar">Reintentar envío</button>' +
      '<button class="btn small ghost" type="button" data-accion="mensaje-pend" data-ref="' + esc(p.ref) + '">Mensaje</button>' +
      '<button class="btn small ghost" type="button" data-accion="quitar-pend" data-ref="' + esc(p.ref) + '">Quitar</button></div></article>';
  }
  var opciones = ESTADOS.map(function (e) { return '<option' + (e === p.estado ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('');
  return '<article class="pedido"><div class="pedido-top"><div><p class="id">' + esc(p.id) + '</p><h3>' + esc(p.cliente) + '</h3><p class="prod">' + esc(textoProducto(p)) + '</p></div>' +
    '<div class="badges">' + badgeEstado(p) + '</div></div><div class="filas">' + filas + '</div>' +
    '<div class="acciones">' +
    ((p.debe || 0) > 0 && p.estado !== 'Cancelado' ? '<button class="btn small" type="button" data-accion="pagar" data-id="' + esc(p.id) + '">Registrar pago</button>' : '') +
    '<select aria-label="Cambiar estado de ' + esc(p.id) + '" data-accion="estado" data-id="' + esc(p.id) + '">' + opciones + '</select>' +
    '<button class="btn small ghost" type="button" data-accion="mensaje" data-id="' + esc(p.id) + '">Mensaje</button>' +
    '<button class="btn small ghost" type="button" data-accion="editar" data-id="' + esc(p.id) + '">Editar</button></div></article>';
}
function renderPedidos() {
  var todos = todosLosPedidos();
  pintarMeses(todos);
  pintarStats(todos.filter(function (p) { return !p.pendiente; }));
  var lista = todos.filter(pasaMes).filter(pasaFiltro).filter(pasaBusqueda);
  var porEntrega = S.filtro === 'activos' || S.filtro === 'semana' || S.filtro === 'cobrar';
  lista.sort(function (a, b) {
    if (a.pendiente !== b.pendiente) return a.pendiente ? -1 : 1;
    if (porEntrega) {
      var fa = a.entregaFecha || '9999-12-31', fb = b.entregaFecha || '9999-12-31';
      return fa < fb ? -1 : fa > fb ? 1 : 0;
    }
    return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
  });
  $('#lista').innerHTML = lista.length ? lista.map(tarjeta).join('') :
    '<div class="vacio">' + (S.cfg.url && S.conexion === 'error' && !S.cache.length ? 'No pude traer los pedidos de la hoja. Toca actualizar cuando tengas conexión.' :
      (todos.length ? 'No hay pedidos con ese filtro.' : 'Todavía no hay pedidos. Registra el primero en la pestaña "Nuevo".')) + '</div>';
}

/* Acciones sobre un pedido (sirven en Pedidos, Calendario y Producción) */
function avisosDe(r) { if (r && r.pedido && r.pedido.avisos && r.pedido.avisos.length) toast(r.pedido.avisos[0], 'error'); }
function cambiarEstado(id, nuevo, sel) {
  var p = buscarPedido(id); var antes = p ? p.estado : '';
  return api('actualizar', { id: id, cambios: { estado: nuevo } }).then(function (r) {
    upsertCache(r.pedido); toast(id + ': ' + nuevo); avisosDe(r);
  }, function (e) { toast(e.message, 'error'); if (sel) sel.value = antes; }).then(renderTodo);
}
function abrirPago(id) {
  var p = buscarPedido(id); if (!p) return;
  $('#pago-titulo').textContent = 'Registrar pago';
  $('#pago-sub').textContent = p.cliente + ' · ' + p.id + ' · debe ' + dinero(p.debe) + ' de ' + dinero(p.total);
  $('#form-pago').dataset.id = id; $('#form-pago').dataset.debe = p.debe;
  ponerDinero($('#pago-monto'), p.debe); $('#pago-err').textContent = '';
  pintarChips('chips-pago-metodo', 'pagoMetodo', S.listas.metodos, 'pago-metodo-otro', true);
  $('#pago-metodo-otro').hidden = true;
  abrir($('#dlg-pago'));
  setTimeout(function () { $('#pago-monto').select(); }, 50);
}
function onPago(ev) {
  ev.preventDefault();
  var f = $('#form-pago'), id = f.dataset.id, debe = Number(f.dataset.debe) || 0;
  var monto = soloNumero($('#pago-monto').value);
  var err = $('#pago-err');
  if (!monto) { err.textContent = 'Escribe cuánto pagó.'; return; }
  if (monto > debe) { err.textContent = 'Eso es más de lo que debe (' + dinero(debe) + ').'; return; }
  var btn = $('#pago-ok'); btn.disabled = true;
  api('pagar', { id: id, monto: monto, metodo: valorChips('pagoMetodo', 'pago-metodo-otro') }).then(function (r) {
    upsertCache(r.pedido); cerrar($('#dlg-pago'));
    toast(r.pedido.debe > 0 ? 'Pago registrado. Aún debe ' + dinero(r.pedido.debe) + '.' : 'Pago registrado. Quedó pagado completo.');
    avisosDe(r); renderTodo();
  }, function (e) { err.textContent = e.message; }).then(function () { btn.disabled = false; });
}

/* Editar pedido (completo en la versión 3; en la versión anterior solo fechas, estado y entrega) */
var CAMPOS_SOLO_V3 = ['ed-cliente', 'ed-contacto', 'ed-canal', 'ed-producto', 'ed-cantidad', 'ed-detalles', 'ed-total'];
function abrirEditar(id) {
  var p = buscarPedido(id); if (!p) return;
  var f = $('#form-editar'); f.dataset.id = id;
  $('#ed-sub').textContent = p.id + ' · registrado ' + (p.registrado ? textoDeIso(p.registrado.slice(0, 10)) : '');
  $('#ed-cliente').value = p.cliente || ''; $('#ed-contacto').value = p.contacto || ''; $('#ed-canal').value = p.canal || '';
  ponerFecha('ed-fecha', p.fecha);
  $('#ed-producto').value = p.producto || ''; $('#ed-cantidad').value = p.cantidad || 1; $('#ed-detalles').value = p.detalles || '';
  ponerDinero($('#ed-total'), p.total);
  $('#ed-pago-nota').textContent = 'Ya pagó ' + dinero(p.pago) + (p.debe > 0 ? ' y debe ' + dinero(p.debe) : ' (pagado completo)') + '. Para sumar un pago usa el botón Registrar pago.';
  $('#ed-estado').innerHTML = ESTADOS.map(function (e) { return '<option' + (e === p.estado ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('');
  ponerFecha('ed-entregaFecha', p.entregaFecha);
  $$('input[name="ed-tipo"]').forEach(function (r) { r.checked = r.value === p.entregaTipo; });
  $('#ed-via').value = p.entregaVia || ''; $('#ed-direccion').value = p.direccion || ''; $('#ed-notas').value = p.notas || '';
  ponerCostos('ed-c-', p);
  pintarResumenCostos('ed-c-', p.total);
  var v3 = esV3();
  CAMPOS_SOLO_V3.forEach(function (x) { $('#' + x).disabled = !v3; });
  $('#bloque-costos-editar').hidden = !v3;
  $('#ed-v2-nota').hidden = v3;
  $('#ed-err').textContent = '';
  abrir($('#dlg-editar'));
  setTimeout(function () { $(v3 ? '#ed-cliente' : '#ed-fecha').focus(); }, 50);
}
function distinto(a, b) {
  if (a === '' && b === '') return false;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) !== Number(b) || a === '' || b === '';
  return String(a) !== String(b);
}
function onEditar(ev) {
  ev.preventDefault();
  var id = $('#form-editar').dataset.id, p = buscarPedido(id); if (!p) return;
  var msgFecha = 'Escribe la fecha como día/mes/año, por ejemplo 21/10/2026.';
  var t = function (x) { return $('#ed-' + x).value.trim(); };
  var errs = [];
  var nf = isoDeTexto(t('fecha')); if (!nf) errs.push('Fecha del pedido: ' + msgFecha);
  var et = t('entregaFecha'), ne = et ? isoDeTexto(et) : '';
  if (et && !ne) errs.push('Fecha de entrega: ' + msgFecha);
  var antesE = String(p.entregaFecha || '').slice(0, 10);
  if (!et && antesE) errs.push('La fecha de entrega no se puede dejar vacía. Escríbela o déjala como estaba.');
  var v3 = esV3();
  var total = soloNumero($('#ed-total').value), cant = parseInt($('#ed-cantidad').value, 10);
  if (v3) {
    if (!t('cliente')) errs.push('El nombre del cliente no puede quedar vacío.');
    if (!t('producto')) errs.push('El producto no puede quedar vacío.');
    if (!(cant >= 1)) errs.push('La cantidad debe ser al menos 1.');
    if (!total) errs.push('El valor total debe ser mayor que cero.');
    else if (total < (p.pago || 0)) errs.push('El total no puede ser menor a lo que ya pagó (' + dinero(p.pago) + ').');
    if (!decimalOk($('#ed-c-horas').value)) errs.push('Horas de impresión: escribe solo el número, por ejemplo 3,5.');
    if (!decimalOk($('#ed-c-gramos').value)) errs.push('Gramos de filamento: escribe solo el número, por ejemplo 120.');
  }
  var tipo = (document.querySelector('input[name="ed-tipo"]:checked') || {}).value || p.entregaTipo;
  var nuevo = { fecha: nf, entregaFecha: ne, estado: $('#ed-estado').value, entregaTipo: tipo, entregaVia: t('via'), direccion: t('direccion'), notas: t('notas') };
  if (v3) {
    Object.assign(nuevo, { cliente: t('cliente'), contacto: t('contacto'), canal: t('canal'), producto: t('producto'), cantidad: cant, detalles: t('detalles'), total: total });
    var c = leerCostos('ed-c-');
    Object.keys(c).forEach(function (k) { nuevo[k] = c[k]; });
  }
  $('#ed-err').textContent = errs.join('\n');
  if (errs.length) return;
  var cambios = {};
  ['fecha', 'cliente', 'contacto', 'canal', 'producto', 'cantidad', 'detalles', 'total', 'estado', 'entregaFecha', 'entregaTipo', 'entregaVia', 'direccion', 'notas',
    'impresora', 'horas', 'gramos', 'empaque', 'envioNegocio', 'otros'].forEach(function (k) {
    if (!(k in nuevo)) return;
    var antes = p[k] == null ? '' : p[k];
    if (k === 'fecha' || k === 'entregaFecha') antes = String(antes).slice(0, 10);
    if (distinto(nuevo[k], antes)) cambios[k] = nuevo[k];
  });
  if (!Object.keys(cambios).length) { cerrar($('#dlg-editar')); toast('No cambiaste nada.'); return; }
  var btn = $('#ed-ok'); btn.disabled = true;
  api('actualizar', { id: id, cambios: cambios }).then(function (r) {
    upsertCache(r.pedido); cerrar($('#dlg-editar')); toast(id + ': cambios guardados.'); avisosDe(r); renderTodo();
  }, function (e) {
    $('#ed-err').textContent = scriptViejo(e) ? 'Tu hoja todavía tiene una versión anterior del script y no deja cambiar eso. Actualízalo (Ajustes > Cómo actualizar el script) y vuelve a intentar.' : e.message;
  }).then(function () { btn.disabled = false; });
}

function onListaClick(ev) {
  var b = ev.target.closest('[data-accion]'); if (!b || b.tagName === 'SELECT') return;
  var a = b.dataset.accion, id = b.dataset.id;
  if (a === 'pagar') abrirPago(id);
  else if (a === 'editar') abrirEditar(id);
  else if (a === 'mensaje') { var p = buscarPedido(id); if (p) copiar(mensajeCliente(p)).then(function (ok) { toast(ok ? 'Mensaje copiado, listo para pegar en WhatsApp.' : 'No pude copiar. Intenta de nuevo.', ok ? '' : 'error'); }); }
  else if (a === 'mensaje-pend') { var q = S.pend.find(function (x) { return x.ref === b.dataset.ref; }); if (q) copiar(mensajeCliente(q)).then(function (ok) { toast(ok ? 'Mensaje copiado.' : 'No pude copiar.', ok ? '' : 'error'); }); }
  else if (a === 'reintentar') enviarPendientes(false);
  else if (a === 'quitar-pend') {
    if (confirm('¿Quitar este pedido que aún no se envió a la hoja? No se puede deshacer.')) {
      S.pend = S.pend.filter(function (x) { return x.ref !== b.dataset.ref; }); guardar(LS.pend, S.pend); pintarAviso(); renderTodo();
    }
  }
}
function onListaChange(ev) {
  var s = ev.target;
  if (s.matches && s.matches('select[data-accion="estado"]')) cambiarEstado(s.dataset.id, s.value, s);
}
function ligarAcciones(sel) { $(sel).addEventListener('click', onListaClick); $(sel).addEventListener('change', onListaChange); }

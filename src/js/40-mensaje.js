/* Mensaje para el cliente */
function mensajeCliente(p) {
  var nombre = String(p.cliente || '').split(/\s+/)[0];
  var debe = typeof p.debe === 'number' ? p.debe : Math.max(0, (p.total || 0) - (p.pago || 0));
  var l = ['Hola ' + nombre + ', te escribe Yi Shu Studio. Tu pedido quedó registrado:', ''];
  if (p.id) l.push('Pedido: ' + p.id);
  var prods = String(p.producto || '').split(' + ');
  if (prods.length > 1) { l.push('Productos:'); prods.forEach(function (x) { l.push('- ' + x); }); }
  else l.push('Producto: ' + p.producto + (p.cantidad > 1 ? ' x' + p.cantidad : ''));
  l.push('Valor total: ' + dinero(p.total));
  if (p.pago > 0) l.push('Pagado: ' + dinero(p.pago));
  l.push(debe > 0 ? 'Saldo pendiente: ' + dinero(debe) : 'Pago completo, gracias.');
  if (p.entregaFecha) l.push('Entrega estimada: ' + fechaLarga(p.entregaFecha));
  if (p.entregaTipo === 'Envío') {
    l.push('Envío por ' + (p.entregaVia || 'transportadora') + (p.direccion ? ' a ' + p.direccion : ''));
  } else if (p.entregaTipo === 'Recogida') {
    l.push('Recogida' + (p.entregaVia ? ': ' + p.entregaVia : ''));
  }
  l.push('', 'Cualquier cambio o duda me escribes por aquí.');
  return l.join('\n');
}
function copiar(texto) {
  var respaldo = function () {
    var ta = document.createElement('textarea'); ta.value = texto; ta.style.cssText = 'position:fixed;opacity:0;top:0';
    document.body.appendChild(ta); ta.select(); var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove(); return ok;
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(texto).then(function () { return true; }, function () { return respaldo(); });
  }
  return Promise.resolve(respaldo());
}

/* Utilidades */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function pad(n) { return String(n).length < 2 ? '0' + n : String(n); }
function leer(k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function miles(n) { return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function dinero(n) { n = Number(n) || 0; return (n < 0 ? '-' : '') + '$' + miles(n); }
function soloNumero(s) { var d = String(s || '').replace(/\D/g, ''); return d ? parseInt(d, 10) : 0; }
function nuevoRef() {
  try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/* Fechas (siempre en hora local, sin saltos por zona horaria) */
function hoyISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseISO(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
/* Fechas que ve y escribe Lorena: siempre día/mes/año. Por dentro viajan como aaaa-mm-dd. */
function textoDeIso(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
function isoDeTexto(t) {
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(t || '').trim()); if (!m) return null;
  var d = +m[1], mo = +m[2], a = +m[3];
  if (a < 2000 || a > 2100 || mo < 1 || mo > 12 || d < 1) return null;
  var f = new Date(a, mo - 1, d);
  if (f.getFullYear() !== a || f.getMonth() !== mo - 1 || f.getDate() !== d) return null;
  return a + '-' + pad(mo) + '-' + pad(d);
}
function ponerFecha(id, iso) { $('#' + id).value = textoDeIso(iso); var sel = $('#' + id + '-sel'); if (sel) sel.value = iso || ''; }
/* Pone las barras mientras escribe. Acepta 21102026 o 21/10/2026 o 5/1/2027 (separa con / - . o espacio). */
function darFormatoFecha(txt) {
  var max = [2, 2, 4], partes = ['', '', ''], i = 0;
  for (var k = 0; k < txt.length; k++) {
    var c = txt.charAt(k);
    if (/\d/.test(c)) {
      if (partes[i].length === max[i]) { if (i === 2) continue; i++; }
      partes[i] += c;
    } else if (partes[i].length > 0 && i < 2) { i++; }
  }
  return partes.slice(0, i + 1).join('/');
}
function formatearFecha(inp) {
  var v = inp.value, pos = inp.selectionStart, f = darFormatoFecha(v);
  if (f === v) return;
  inp.value = f;
  var np = darFormatoFecha(v.slice(0, pos == null ? v.length : pos)).length;
  try { inp.setSelectionRange(np, np); } catch (e) {}
}
function normalizarFecha(inp) { var iso = isoDeTexto(inp.value); if (iso) ponerFecha(inp.id, iso); }
function ligarFecha(id) {
  var inp = $('#' + id), sel = $('#' + id + '-sel'), btn = $('[data-cal="' + id + '"]');
  inp.addEventListener('input', function () { formatearFecha(inp); });
  inp.addEventListener('blur', function () { normalizarFecha(inp); });
  sel.addEventListener('change', function () { if (sel.value) ponerFecha(id, sel.value); });
  btn.addEventListener('click', function () {
    sel.value = isoDeTexto(inp.value) || '';
    try { if (sel.showPicker) { sel.showPicker(); return; } } catch (e) {}
    try { sel.focus(); sel.click(); } catch (e) {}
  });
}
function sumarDias(iso, n) { var d = parseISO(iso); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function diasHasta(iso) { var d = parseISO(iso); if (!d) return null; return Math.round((d - parseISO(hoyISO())) / 86400000); }
function fechaCorta(iso) {
  var d = parseISO(iso); if (!d) return iso || '';
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}
function fechaLarga(iso) {
  var d = parseISO(iso); if (!d) return iso || '';
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* Más utilidades (versión 3) */
function clonar(o) { return JSON.parse(JSON.stringify(o)); }
function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
/* Números con decimales: acepta 3,5 y 3.5 */
function decimalDe(t) {
  var s = String(t == null ? '' : t).trim().replace(',', '.').replace(/[^\d.\-]/g, '');
  var n = parseFloat(s); return isFinite(n) ? n : 0;
}
/* ¿El texto es un número que se pueda leer? Vacío vale (el campo es opcional). */
function decimalOk(t) { t = String(t == null ? '' : t).trim(); return t === '' || /^\d+([.,]\d+)?$/.test(t); }
function numTxt(n) { n = Number(n); return isFinite(n) ? String(Math.round(n * 100) / 100).replace('.', ',') : ''; }
/* Cifras cortas para ejes: 350 mil, 1,2 M */
function compacto(n) {
  n = Math.abs(Number(n) || 0);
  if (n < 1000) return String(Math.round(n));
  if (n < 1e6) { var k = n / 1000; return (k < 10 ? String(Math.round(k * 10) / 10).replace('.', ',') : String(Math.round(k))) + ' mil'; }
  var m = n / 1e6; return String(Math.round(m * 10) / 10).replace('.', ',') + ' M';
}
function nombreMes(ym) { var m = parseInt(String(ym).slice(5, 7), 10); return (MESES[m - 1] || ym) + ' ' + String(ym).slice(0, 4); }
function mesCorto(ym) { var m = parseInt(String(ym).slice(5, 7), 10); return (MESES_CORTOS[m - 1] || ym) + ' ' + String(ym).slice(2, 4); }
function mesDeIso(iso) { var m = /^(\d{4}-\d{2})/.exec(iso || ''); return m ? m[1] : ''; }
function mesActualYM() { return hoyISO().slice(0, 7); }
function sumarMeses(ym, n) {
  var a = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
  a += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return a + '-' + pad(m + 1);
}
function diasDelMes(ym) { return new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(); }
function fechaDiaMes(iso) { var d = parseISO(iso); return d ? d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : (iso || ''); }
function horaTxt(h) { var s = h % 12 === 0 ? 12 : h % 12; return s + ':00 ' + (h < 12 ? 'a. m.' : 'p. m.'); }
function ahoraTxt(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || ''); if (!m) return '';
  return m[3] + '/' + m[2] + '/' + m[1] + ' ' + horaTxt(+m[4]).replace(':00', ':' + m[5]);
}
/* Variantes base64 seguras para ir dentro de un enlace */
function aB64Url(s) {
  var bytes = new TextEncoder().encode(s), bin = '';
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function deB64Url(b) {
  var s = String(b).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  var bin = atob(s), bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

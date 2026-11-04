#!/usr/bin/env node
/* Arma index.html (un solo archivo) a partir de src/. Uso: node build.js */
const fs = require('fs'), path = require('path');
const dir = (...p) => path.join(__dirname, 'src', ...p);
const leer = (...p) => fs.readFileSync(dir(...p), 'utf8');

const js = fs.readdirSync(dir('js')).filter(f => /\.js$/.test(f)).sort().map(f => '/* ' + f + ' */\n' + leer('js', f)).join('\n');
if (/<\/script/i.test(js)) throw new Error('Un archivo de js/ contiene </script>');
const qr = leer('vendor', 'qrcode.min.js');
if (/<\/script/i.test(qr)) throw new Error('qrcode.min.js contiene </script>');

const piezas = {
  __CSS__: leer('styles.css'),
  __LOGO96__: leer('assets', 'logo96.b64').trim(),
  __LOGO192__: leer('assets', 'logo192.b64').trim(),
  __QR__: qr,
  __JS__: js
};
let html = leer('template.html');
for (const k of Object.keys(piezas)) html = html.split(k).join(piezas[k]);
const sobran = html.match(/__(CSS|LOGO96|LOGO192|QR|JS)__/g);
if (sobran) throw new Error('Quedaron marcadores sin reemplazar: ' + sobran.join(', '));
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html listo: ' + Math.round(html.length / 1024) + ' KB');

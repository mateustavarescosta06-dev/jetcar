// A versão do site: o hash de tudo o que é publicado (dist/, menos o próprio js/version.js).
// A página compara a versão com que abriu com a do servidor e, quando muda, oferece "Atualizar"
// (js/update.js): o site nunca recarrega sozinho. `npm run stamp` grava a versão; `npm run check`
// avisa quando ela ficou para trás (qualquer mudança em dist/ pede um stamp antes do commit).
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const dist = path.resolve(__dirname, '../dist');
const out = path.join(dist, 'js', 'version.js');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.name.startsWith('.') ? [] : e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
// texto com quebra de linha do Windows dá o mesmo hash
const TEXT = /\.(html|css|c?js|mjs|json|svg|txt)$/;

function version() {
  const hash = crypto.createHash('sha256');
  const files = walk(dist).filter(f => f !== out).map(f => [path.relative(dist, f).split(path.sep).join('/'), f]).sort(([a], [b]) => (a < b ? -1 : 1));
  for (const [rel, file] of files) {
    let data = fs.readFileSync(file);
    if (TEXT.test(rel)) data = Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n'));
    hash.update(`${rel}\0${data.length}\0`);
    hash.update(data);
  }
  return hash.digest('hex').slice(0, 12);
}
const source = v => `// Gerado por scripts/stamp.cjs (npm run stamp): o hash de tudo o que é publicado. Não editar à mão.\nexport const VERSION = '${v}';\n`;

module.exports = { version, source, out };

if (require.main === module) {
  const v = version();
  fs.writeFileSync(out, source(v));
  console.log(`✓ versão ${v}`);
}

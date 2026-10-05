// Validação rápida: sintaxe de todos os scripts (inclusive os módulos em subpastas e as
// bibliotecas em dist/vendor) e as referências locais do HTML/CSS/JS (assets, vídeos, fontes).
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const scripts = [path.join(dist, 'app.js'), ...walk(path.join(dist, 'js')), ...walk(path.join(dist, 'vendor')), ...walk(__dirname)]
  .filter(f => /\.(c?js|mjs)$/.test(f));
let failed = false;
for (const file of scripts) {
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
  catch (e) { failed = true; console.error(`✗ ${path.relative(root, file)}\n${e.stderr}`); }
}
const sources = [path.join(dist, 'index.html'), path.join(dist, 'quem-somos.html'), path.join(dist, 'style.css'), path.join(dist, 'app.js'), ...walk(path.join(dist, 'js'))];
const text = sources.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const refs = new Set([...text.matchAll(/(?:assets|vendor)\/[\w./-]+\.(?:webp|png|jpg|svg|mp4|webm|woff2|json|js)/g)].map(m => m[0]));
// os vídeos dos dois scrubs são escolhidos no código (MP4 ou WebM): as duas variantes precisam existir
for (const v of ['wash/scrub-m', 'open/open', 'final/final']) for (const ext of ['mp4', 'webm']) refs.add(`assets/${v}.${ext}`);
for (const ref of refs) if (!fs.existsSync(path.join(dist, ref))) { failed = true; console.error(`✗ arquivo ausente: ${ref}`); }
// a versão (dist/js/version.js) acompanha o que é publicado: é ela que faz o aviso de "Atualizar" aparecer
const stamp = require('./stamp.cjs');
const current = fs.existsSync(stamp.out) ? fs.readFileSync(stamp.out, 'utf8').replace(/\r\n/g, '\n') : '';
if (current !== stamp.source(stamp.version())) { failed = true; console.error('✗ dist/js/version.js desatualizado: rode npm run stamp'); }
if (failed) process.exit(1);
console.log(`✓ ${scripts.length} scripts e ${refs.size} arquivos referenciados`);

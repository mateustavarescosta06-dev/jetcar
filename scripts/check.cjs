// Validação rápida: sintaxe de todos os scripts (inclusive os módulos em subpastas e as
// bibliotecas em dist/vendor), referências locais do HTML/CSS/JS e os quadros do filme.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const scripts = [path.join(dist, 'experience.js'), ...walk(path.join(dist, 'js')), ...walk(path.join(dist, 'vendor')), ...walk(__dirname)]
  .filter(f => /\.(c?js|mjs)$/.test(f));
let failed = false;
for (const file of scripts) {
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
  catch (e) { failed = true; console.error(`✗ ${path.relative(root, file)}\n${e.stderr}`); }
}
const sources = [path.join(dist, 'index.html'), path.join(dist, 'style.css'), path.join(dist, 'experience.js'), ...walk(path.join(dist, 'js'))];
const text = sources.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const refs = new Set([...text.matchAll(/(?:assets|vendor)\/[\w./-]+\.(?:webp|png|svg|mp4|woff2|json|js)/g)].map(m => m[0]));
for (const ref of refs) if (!fs.existsSync(path.join(dist, ref))) { failed = true; console.error(`✗ arquivo ausente: ${ref}`); }
// Sequências do filme: os 226 quadros de cada versão precisam existir.
for (const v of ['d', 'm']) {
  for (let i = 0; i < 226; i++) {
    const f = path.join(dist, 'assets/film', v, `${String(i).padStart(3, '0')}.webp`);
    if (!fs.existsSync(f)) { failed = true; console.error(`✗ quadro ausente: ${path.relative(root, f)}`); break; }
  }
}
if (failed) process.exit(1);
console.log(`✓ ${scripts.length} scripts, ${refs.size} arquivos referenciados e as sequências do filme`);

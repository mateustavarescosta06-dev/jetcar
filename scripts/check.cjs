// Validação rápida: sintaxe de todos os scripts e referências locais do HTML/CSS existentes.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const files = ['dist/experience.js', ...fs.readdirSync(path.join(dist, 'js')).map(f => `dist/js/${f}`), 'scripts/serve.cjs', 'scripts/trace-logo.cjs', 'scripts/check.cjs'];
let failed = false;
for (const file of files) {
  try { execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' }); }
  catch (e) { failed = true; console.error(`✗ ${file}\n${e.stderr}`); }
}
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8') + fs.readFileSync(path.join(dist, 'style.css'), 'utf8') + fs.readdirSync(path.join(dist, 'js')).map(f => fs.readFileSync(path.join(dist, 'js', f), 'utf8')).join('');
const refs = new Set([...html.matchAll(/assets\/[\w./-]+\.(?:webp|png|svg|mp4|woff2)/g)].map(m => m[0]));
for (const ref of refs) if (!fs.existsSync(path.join(dist, ref))) { failed = true; console.error(`✗ arquivo ausente: ${ref}`); }
if (failed) process.exit(1);
console.log(`✓ ${files.length} scripts e ${refs.size} arquivos referenciados`);

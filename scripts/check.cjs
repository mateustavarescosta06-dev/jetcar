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
const pages = ['index.html', 'quem-somos.html', '404.html'].map(f => path.join(dist, f));
const sources = [...pages, path.join(dist, 'style.css'), path.join(dist, 'app.js'), ...walk(path.join(dist, 'js'))];
const text = sources.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const refs = new Set([...text.matchAll(/(?:assets|vendor)\/[\w./-]+\.(?:webp|png|jpg|svg|mp4|webm|woff2|json|js)/g)].map(m => m[0]));
// os vídeos dos dois scrubs são escolhidos no código (MP4 ou WebM): as duas variantes precisam existir
for (const v of ['wash/scrub-m', 'open/open', 'final/final']) for (const ext of ['mp4', 'webm']) refs.add(`assets/${v}.${ext}`);
for (const ref of refs) if (!fs.existsSync(path.join(dist, ref))) { failed = true; console.error(`✗ arquivo ausente: ${ref}`); }
// a CSP do vercel.json: script só de arquivo do site ou embutido com o hash listado; nada de
// estilo ou evento inline no HTML e nos SVGs (a CSP bloquearia sem avisar a pessoa)
const crypto = require('node:crypto');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const csp = (vercel.headers || []).flatMap(r => r.headers).find(h => h.key === 'Content-Security-Policy')?.value || '';
const scriptSrc = (csp.match(/script-src([^;]*)/) || [])[1] || '';
if (!csp) { failed = true; console.error('✗ vercel.json sem Content-Security-Policy'); }
let inline = 0;
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1] || '';
    if (/\bsrc=/.test(attrs)) continue;
    const type = (attrs.match(/type="([^"]+)"/) || [])[1];
    if (type && !/^(module|text\/javascript)$/.test(type)) continue;   // bloco de dados (JSON-LD): não executa
    inline++;
    const hash = `'sha256-${crypto.createHash('sha256').update(m[2], 'utf8').digest('base64')}'`;
    if (!scriptSrc.includes(hash)) { failed = true; console.error(`✗ ${path.relative(root, page)}: script embutido fora da CSP; ponha ${hash} no script-src do vercel.json`); }
  }
}
for (const f of [...pages, ...walk(path.join(dist, 'assets')).filter(f => f.endsWith('.svg'))]) {
  const t = fs.readFileSync(f, 'utf8');
  if (/<style[\s>]|\sstyle="/.test(t)) { failed = true; console.error(`✗ ${path.relative(root, f)}: estilo inline (a CSP só permite style.css)`); }
  if (/<[a-z][^>]*\son[a-z]+="/i.test(t)) { failed = true; console.error(`✗ ${path.relative(root, f)}: evento inline (onclick etc.: a CSP bloqueia)`); }
}
if (failed) process.exit(1);
console.log(`✓ ${scripts.length} scripts e ${refs.size} arquivos referenciados; CSP com os ${inline} scripts embutidos`);

// Servidor local da pasta publicada (dist/), parecido com a Vercel: /x serve x.html (cleanUrls),
// os cabeçalhos do vercel.json valem aqui também (a CSP inclusive, para os testes verem o que a
// produção faz), endereço inexistente recebe 404.html com status 404, e há suporte a Range
// (a busca de quadro dos vídeos). Uso: npm start (PORT, ROOT para servir outra pasta).
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.env.ROOT || path.join(__dirname, '../dist'));
const port = Number(process.env.PORT || 3000);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json' };

// cabeçalhos do vercel.json (só a regra para todos os caminhos, "/(.*)", que é a que o site usa)
let headers = {};
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8'));
  for (const rule of cfg.headers || []) if (rule.source === '/(.*)') for (const h of rule.headers) headers[h.key] = h.value;
} catch {}

function send(res, status, file, stat, range, head) {
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  if (range && status === 200) {
    const m = /^bytes=(\d+)-(\d*)$/.exec(range);
    const start = m ? Number(m[1]) : NaN, end = m && m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
    if (!m || start > end || start >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
    res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    if (head) return res.end();
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(status, { 'Content-Length': stat.size });
  if (head) return res.end();
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
  let file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  // nada fora da pasta publicada
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
  const head = req.method === 'HEAD';
  fs.stat(file, (err, stat) => {
    if (!err && stat.isFile()) return send(res, 200, file, stat, req.headers.range, head);
    const missing = path.join(root, '404.html');
    fs.stat(missing, (e2, s2) => {
      if (e2) { res.writeHead(404); return res.end('Not found'); }
      send(res, 404, missing, s2, null, head);
    });
  });
}).listen(port, () => console.log(`JETCAR: http://localhost:${port}`));

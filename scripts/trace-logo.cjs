// Ferramenta de desenvolvimento: vetoriza dist/assets/jetcar-mask.png.
// Gera dist/assets/jetcar-logo.svg e dist/js/logo-data.js (um path por peça do logo),
// usados para recortar o vídeo com bordas nítidas em qualquer escala.
// Uso: node scripts/trace-logo.cjs
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'dist/assets/jetcar-mask.png');

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG inválido');
  let pos = 8, width, height, depth, type, interlace;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), kind = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; type = data[9]; interlace = data[12];
    } else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || type !== 6 || interlace) throw new Error('Esperado RGBA 8 bits sem entrelaçamento');
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = 4, stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { width, height, data: out };
}

const png = decodePNG(fs.readFileSync(src));
const W = png.width, H = png.height, ISO = 128;
const alpha = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) alpha[i] = png.data[i * 4 + 3];

// Componentes conexos (8-vizinhança) dos pixels sólidos.
const label = new Int32Array(W * H).fill(-1);
const comps = [];
for (let i = 0; i < W * H; i++) {
  if (alpha[i] < ISO || label[i] >= 0) continue;
  const id = comps.length, stack = [i], pixels = [];
  label[i] = id;
  while (stack.length) {
    const p = stack.pop(), px = p % W, py = (p / W) | 0;
    pixels.push(p);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = px + dx, ny = py + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (alpha[n] >= ISO && label[n] < 0) { label[n] = id; stack.push(n); }
    }
  }
  comps.push(pixels);
}

// Marching squares com interpolação do alfa, por componente.
function traceComponent(id) {
  const pixels = comps[id];
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (const p of pixels) { const x = p % W, y = (p / W) | 0; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const x0 = minX - 2, y0 = minY - 2, gw = maxX - minX + 5, gh = maxY - minY + 5;
  const val = (gx, gy) => {
    const x = gx + x0, y = gy + y0;
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    const i = y * W + x, a = alpha[i];
    if (a >= ISO) return label[i] === id ? a : 0;
    return a;
  };
  const grid = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) grid[y * gw + x] = val(x, y);
  const g = (x, y) => grid[y * gw + x];
  const points = new Map(), links = new Map();
  const edgePoint = (key, ax, ay, bx, by) => {
    if (!points.has(key)) {
      const va = g(ax, ay), vb = g(bx, by), t = (ISO - va) / (vb - va || 1e-6);
      points.set(key, [x0 + ax + (bx - ax) * t + 0.5, y0 + ay + (by - ay) * t + 0.5]);
    }
    return key;
  };
  const link = (a, b) => {
    if (!links.has(a)) links.set(a, []);
    if (!links.has(b)) links.set(b, []);
    links.get(a).push(b); links.get(b).push(a);
  };
  for (let y = 0; y < gh - 1; y++) for (let x = 0; x < gw - 1; x++) {
    const tl = g(x, y) >= ISO, tr = g(x + 1, y) >= ISO, br = g(x + 1, y + 1) >= ISO, bl = g(x, y + 1) >= ISO;
    const code = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
    if (code === 0 || code === 15) continue;
    const T = () => edgePoint(`h${x},${y}`, x, y, x + 1, y);
    const B = () => edgePoint(`h${x},${y + 1}`, x, y + 1, x + 1, y + 1);
    const L = () => edgePoint(`v${x},${y}`, x, y, x, y + 1);
    const R = () => edgePoint(`v${x + 1},${y}`, x + 1, y, x + 1, y + 1);
    const center = (g(x, y) + g(x + 1, y) + g(x + 1, y + 1) + g(x, y + 1)) / 4 >= ISO;
    switch (code) {
      case 1: case 14: link(L(), B()); break;
      case 2: case 13: link(B(), R()); break;
      case 3: case 12: link(L(), R()); break;
      case 4: case 11: link(T(), R()); break;
      case 6: case 9: link(T(), B()); break;
      case 7: case 8: link(L(), T()); break;
      case 5: if (center) { link(L(), T()); link(B(), R()); } else { link(L(), B()); link(T(), R()); } break;
      case 10: if (center) { link(T(), R()); link(L(), B()); } else { link(L(), T()); link(B(), R()); } break;
    }
  }
  const loops = [], seen = new Set();
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let prev = null, cur = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur); loop.push(points.get(cur));
      const next = links.get(cur).find(n => n !== prev && !seen.has(n));
      prev = cur; cur = next;
    }
    if (loop.length > 2) loops.push(loop);
  }
  return { loops, bbox: [minX, minY, maxX + 1, maxY + 1], area: pixels.length };
}

function rdp(points, eps) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0], [bx, by] = points[points.length - 1];
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
  let max = 0, index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
    if (d > max) { max = d; index = i; }
  }
  if (max <= eps) return [points[0], points[points.length - 1]];
  const left = rdp(points.slice(0, index + 1), eps), right = rdp(points.slice(index), eps);
  return left.slice(0, -1).concat(right);
}
function simplifyLoop(loop, eps) {
  let far = 0, best = 0;
  for (let i = 1; i < loop.length; i++) { const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]); if (d > best) { best = d; far = i; } }
  const a = rdp(loop.slice(0, far + 1), eps), b = rdp(loop.slice(far).concat([loop[0]]), eps);
  return a.slice(0, -1).concat(b.slice(0, -1));
}
const r2 = v => Math.round(v * 100) / 100;
const toPath = loops => loops.map(l => 'M' + l.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L') + 'Z').join('');

const parts = [];
comps.forEach((pixels, id) => {
  if (pixels.length < 12) return;
  const t = traceComponent(id);
  const loops = t.loops.map(l => simplifyLoop(l, 0.22)).filter(l => l.length > 2);
  parts.push({ id, bbox: t.bbox, area: t.area, holes: loops.length - 1, d: toPath(loops), loops });
});

// Classificação: emblema (JC, carro, linhas de velocidade), palavra JETCAR e subtítulo.
const wordTop = 395, subTop = 590;
for (const p of parts) {
  const [x0, y0, x1, y1] = p.bbox, w = x1 - x0, h = y1 - y0;
  if (y0 >= subTop) p.kind = 'sub';
  else if (y0 >= wordTop) p.kind = 'word';
  else p.kind = 'emblem';
}
parts.sort((a, b) => (a.kind > b.kind ? 1 : a.kind < b.kind ? -1 : a.bbox[0] - b.bbox[0]));

// Anel do farol: o furo circular do emblema vira o portal para a próxima cena.
const fitCircle = loop => {
  let sx = 0, sy = 0; for (const [x, y] of loop) { sx += x; sy += y; }
  const cx = sx / loop.length, cy = sy / loop.length;
  const radii = loop.map(([x, y]) => Math.hypot(x - cx, y - cy)), r = radii.reduce((s, v) => s + v, 0) / radii.length;
  const dev = Math.sqrt(radii.reduce((s, v) => s + (v - r) ** 2, 0) / radii.length);
  return { cx, cy, r, dev };
};
// O aro é aberto embaixo, então o círculo é ajustado pelos pontos da borda interna
// (mínimos quadrados de Kasa), partindo de uma estimativa grosseira do centro.
function kasa(points) {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  for (const [x, y] of points) { const z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; }
  const n = points.length;
  // Resolve [sxx sxy sx; sxy syy sy; sx sy n] [a b c] = [sxz syz sz]
  const m = [[sxx, sxy, sx, sxz], [sxy, syy, sy, syz], [sx, sy, n, sz]];
  for (let i = 0; i < 3; i++) {
    let piv = i; for (let k = i + 1; k < 3; k++) if (Math.abs(m[k][i]) > Math.abs(m[piv][i])) piv = k;
    [m[i], m[piv]] = [m[piv], m[i]];
    for (let k = 0; k < 3; k++) if (k !== i) { const f = m[k][i] / m[i][i]; for (let j = i; j < 4; j++) m[k][j] -= f * m[i][j]; }
  }
  const a = m[0][3] / m[0][0], b = m[1][3] / m[1][1], c = m[2][3] / m[2][2];
  const cx = a / 2, cy = b / 2;
  return { cx, cy, r: Math.sqrt(c + cx * cx + cy * cy) };
}
let ringFit = null;
const host = parts.find(p => p.kind === 'emblem' && p.bbox[2] > 1100);
if (host) {
  let guess = { cx: 989, cy: 300, r: 79 };
  const pts = host.loops.flat().filter(([x, y]) => { const d = Math.hypot(x - guess.cx, y - guess.cy); return d > 55 && d < 100; });
  const split = r => pts.filter(([x, y]) => Math.hypot(x - guess.cx, y - guess.cy) < r);
  let inner = kasa(split(guess.r));
  for (let i = 0; i < 4; i++) { guess = { cx: inner.cx, cy: inner.cy, r: inner.r + 6 }; inner = kasa(split(guess.r)); }
  const outerPts = pts.filter(([x, y]) => { const d = Math.hypot(x - inner.cx, y - inner.cy); return d > inner.r + 6 && d < inner.r + 26; });
  const outer = kasa(outerPts);
  ringFit = { cx: r2(inner.cx), cy: r2(inner.cy), inner: r2(inner.r), outer: r2(Math.hypot(outer.cx - inner.cx, outer.cy - inner.cy) + outer.r) };
}

const summary = parts.map(p => `${p.kind.padEnd(6)} #${String(p.id).padStart(3)} bbox=${p.bbox.join(',')} holes=${p.holes} pts=${p.loops.reduce((s, l) => s + l.length, 0)}`);
console.log(summary.join('\n'));
console.log('ring', ringFit, 'parts', parts.length);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="#fff" fill-rule="evenodd" role="img" aria-label="JETCAR Estética Automotiva">${parts.map(p => `<path d="${p.d}"/>`).join('')}</svg>\n`;
fs.writeFileSync(path.join(root, 'dist/assets/jetcar-logo.svg'), svg);

// Haste do T de JETCAR: a abertura começa com a câmera dentro dela.
const T = parts.filter(p => p.kind === 'word')[2];
let stem = null;
if (T) {
  const [tx0, ty0, tx1, ty1] = T.bbox, yMid = Math.round(ty1 - 20);
  let x0 = tx0; while (x0 < tx1 && alpha[yMid * W + x0] < ISO) x0++;
  let x1 = x0; while (x1 < tx1 && alpha[yMid * W + x1] >= ISO) x1++;
  const cx = Math.round((x0 + x1) / 2);
  let y0 = ty0; while (y0 < ty1 && alpha[y0 * W + x0 - 3] >= ISO) y0++;
  stem = { x0, x1, y0, y1: ty1, cx, cy: r2((y0 + ty1) / 2) };
}
console.log('stem', stem);

const data = {
  w: W, h: H, ring: ringFit, stem,
  parts: parts.map(p => ({ kind: p.kind, box: p.bbox, d: p.d }))
};
fs.writeFileSync(path.join(root, 'dist/js/logo-data.js'), `// Gerado por scripts/trace-logo.cjs a partir de assets/jetcar-mask.png. Não editar à mão.\nexport const LOGO = ${JSON.stringify(data)};\n`);
console.log('svg bytes', svg.length);

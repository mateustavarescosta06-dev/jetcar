// Canvas de efeitos dentro da moldura: espuma interativa, bolhas que revelam o polimento,
// contornos da colmeia e o vidro embaçado do interior, que se limpa com o dedo.
import { $, view, frame as F, state, pointer, clamp, lerp, span, smooth, out, env, css, f, usable } from './core.js';
import { T } from './timeline.js';
import { P, IMG, zoom } from './media.js';
import { hive, hexPath, cellFlip } from './hex.js';

const canvas = $('.fx');
const ctx = canvas.getContext('2d');
let dpr = 1, dirty = false;

/** O canvas cobre só a moldura; desenhamos em coordenadas do palco. */
const toStage = () => ctx.setTransform(dpr, 0, 0, dpr, -F.x * dpr, -F.y * dpr);
const inFrame = (x, y, m = 0) => x > F.x - m && x < F.x + F.w + m && y > F.y - m && y < F.y + F.h + m;

// ——— Espuma ———
const foam = [];
const pops = [];
const sprite = document.createElement('canvas');
function makeSprite() {
  const s = 128;
  sprite.width = sprite.height = s;
  const g = sprite.getContext('2d');
  g.clearRect(0, 0, s, s);
  const body = g.createRadialGradient(s * 0.5, s * 0.5, s * 0.2, s * 0.5, s * 0.5, s * 0.5);
  body.addColorStop(0, 'rgba(255,255,255,0.02)');
  body.addColorStop(0.78, 'rgba(255,255,255,0.08)');
  body.addColorStop(0.94, 'rgba(255,255,255,0.55)');
  body.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = body;
  g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = s * 0.035;
  g.lineCap = 'round';
  g.beginPath(); g.arc(s / 2, s / 2, s * 0.36, Math.PI * 1.08, Math.PI * 1.42); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath(); g.arc(s * 0.66, s * 0.68, s * 0.035, 0, Math.PI * 2); g.fill();
}
makeSprite();

function seedFoam() {
  foam.length = 0;
  const n = view.mobile ? 16 : 28;
  for (let i = 0; i < n; i++) foam.push(newBubble(true));
}
function newBubble(anywhere) {
  const k = Math.min(F.w, F.h) / 600;
  const r = (5 + Math.random() ** 2.2 * 38) * clamp(k, 0.6, 1.3);
  return { x: F.x + Math.random() * F.w, y: anywhere ? F.y + Math.random() * F.h : F.y + F.h + r + Math.random() * 60, r, vx: 0, vy: -(10 + Math.random() * 24), ph: Math.random() * 6.28 };
}

function drawFoam(u, dt) {
  const level = state.reduce ? 0 : env(u, T.wash.foam);
  if (level <= 0) return false;
  const s = dt / 1000;
  const live = pointer.at > state.now - 1200;
  for (const tap of pointer.taps) {
    for (const b of foam) if (Math.hypot(b.x - tap.x, b.y - tap.y) < b.r + 26) { pops.push({ x: b.x, y: b.y, r: b.r, t: 0 }); Object.assign(b, newBubble(false)); }
  }
  for (const b of foam) {
    b.ph += s * 1.3;
    b.vx += Math.sin(b.ph) * 4 * s;
    if (live) {
      const dx = b.x - pointer.x, dy = b.y - pointer.y, d = Math.hypot(dx, dy), R = 130 + b.r;
      if (d < R && d > 0.1) { const k = (1 - d / R) ** 2 * 900 * s; b.vx += (dx / d) * k; b.vy += (dy / d) * k; }
    }
    b.vx *= Math.exp(-s * 2.2);
    b.vy = lerp(b.vy, -(12 + b.r * 0.5), 1 - Math.exp(-s * 1.4));
    b.x += b.vx * s; b.y += b.vy * s;
    if (b.y < F.y - b.r * 2 || b.x < F.x - 100 || b.x > F.x + F.w + 100) Object.assign(b, newBubble(false));
    ctx.globalAlpha = level * 0.8;
    ctx.drawImage(sprite, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    p.t += s * 3.2;
    if (p.t >= 1) { pops.splice(i, 1); continue; }
    ctx.globalAlpha = level * (1 - p.t) * 0.9;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + p.t * 0.9), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let k = 0; k < 6; k++) {
      const a = k * 1.047 + p.r, d = p.r * (1 + p.t * 1.6);
      ctx.fillRect(p.x + Math.cos(a) * d - 1, p.y + Math.sin(a) * d - 1, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
  return true;
}

// ——— Bolhas que viram janelas para o polimento ———
const REVEAL = [
  [0.22, 0.7, 0.0, 0.34], [0.66, 0.28, 0.05, 0.38], [0.88, 0.76, 0.1, 0.33], [0.42, 0.42, 0.15, 0.4],
  [0.08, 0.2, 0.19, 0.3], [0.78, 0.06, 0.23, 0.3], [0.5, 0.92, 0.27, 0.36], [0.97, 0.42, 0.3, 0.3],
  [0.3, 0.08, 0.34, 0.3], [0.12, 0.96, 0.37, 0.3], [0.5, 0.5, 0.48, 0.75],
];
function drawZoomed(img, r, k) {
  if (!usable(img)) { ctx.fillStyle = '#111'; ctx.fillRect(F.x, F.y, F.w, F.h); return; }
  ctx.drawImage(img, F.cx + (r.x - F.cx) * k, F.cy + (r.y - F.cy) * k, r.w * k, r.h * k);
}
function drawReveal(u) {
  const [r0, r1] = T.wash.reveal;
  if (u <= r0 || u >= r1) return false;
  const t = span(u, r0, r1);
  const k = zoom.polish(u);
  if (state.reduce) {
    ctx.globalAlpha = smooth(t);
    drawZoomed(IMG.polish, P.polish, k);
    ctx.globalAlpha = 1;
    return true;
  }
  const circles = REVEAL.map(([x, y, d, r]) => {
    const g = out(clamp((t - d) / 0.5));
    return { x: F.x + x * F.w, y: F.y + y * F.h, r: g * r * F.diag, g };
  }).filter(c => c.r > 0.5);
  if (!circles.length) return false;
  ctx.save();
  ctx.beginPath();
  for (const c of circles) { ctx.moveTo(c.x + c.r, c.y); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); }
  ctx.clip();
  drawZoomed(IMG.polish, P.polish, k);
  ctx.restore();
  // Aros de sabão
  ctx.strokeStyle = '#fff';
  for (const c of circles) {
    const a = (1 - c.g) * 0.9;
    if (a <= 0.01) continue;
    ctx.globalAlpha = a * 0.55;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = a;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.9, Math.PI * 1.1, Math.PI * 1.4); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return true;
}

// ——— Colmeia: frente de onda luminosa e brilho sob o dedo no Ceramic Coating ———
const ripples = [];
function drawHex(u, dt) {
  const [f0, f1] = T.hive.flip, z1 = T.layers.tilt[0];
  const wave = !state.reduce && u > f0 - 0.15 && u < f1 + 0.05;
  const touchZone = !state.reduce && u >= f1 && u < z1 + 0.1;
  if (!wave && !touchZone && !ripples.length) return false;
  const t = span(u, f0, f1);
  const live = pointer.at > state.now - 1600 && inFrame(pointer.x, pointer.y, 60);
  for (const tap of pointer.taps) if (touchZone && inFrame(tap.x, tap.y)) ripples.push({ x: tap.x, y: tap.y, t: 0 });
  const s = dt / 1000;
  for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].t += s * 0.9; if (ripples[i].t > 1) ripples.splice(i, 1); }
  if (!wave && !touchZone) { ripples.length = 0; return false; }
  const zoneLevel = touchZone ? env(u, [f1, f1 + 0.15, z1 - 0.1, z1 + 0.1]) : 0;
  const pre = smooth(span(u, f0 - 0.15, f0 + 0.1));
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,236,236,1)';
  // Agrupa as células por intensidade: poucos traços por quadro em vez de um por célula.
  const BUCKETS = 8, groups = Array.from({ length: BUCKETS }, () => []);
  let any = false;
  for (const c of hive.cells) {
    let a = 0;
    if (wave) {
      const p = cellFlip(c, t);
      a = Math.max(a, pre * 0.16 * (1 - smooth(span(u, f1 - 0.2, f1 + 0.05))), Math.sin(p * Math.PI) * 0.8);
    }
    if (zoneLevel > 0) {
      if (live) { const d = Math.hypot(c.x - pointer.x, c.y - pointer.y); a = Math.max(a, (1 - clamp(d / 200)) ** 2 * 0.5 * zoneLevel); }
      for (const r of ripples) {
        const d = Math.hypot(c.x - r.x, c.y - r.y), front = r.t * F.diag * 0.8;
        a = Math.max(a, (1 - clamp(Math.abs(d - front) / 80)) * (1 - r.t) * 0.7 * zoneLevel);
      }
    }
    if (a < 0.01) continue;
    any = true;
    groups[Math.min(BUCKETS - 1, Math.floor(a * BUCKETS))].push(c);
  }
  groups.forEach((cells, i) => {
    if (!cells.length) return;
    ctx.globalAlpha = (i + 0.5) / BUCKETS;
    ctx.beginPath();
    for (const c of cells) hexPath(ctx, c.x, c.y, hive.r * 0.985);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  return any || ripples.length > 0;
}

// ——— Vidro embaçado do interior ———
const fogSrc = document.createElement('canvas');
const fogMask = document.createElement('canvas');
let fogReady = false, fogWiped = false, brush = null, fogK = 1;
function buildFog() {
  fogReady = false;
  fogK = dpr * 0.5;
  const w = Math.max(2, Math.round(F.w * fogK)), h = Math.max(2, Math.round(F.h * fogK));
  fogSrc.width = fogMask.width = w; fogSrc.height = fogMask.height = h;
  const g = fogSrc.getContext('2d');
  const r = P.interior;
  if (usable(IMG.interiorSoft)) g.drawImage(IMG.interiorSoft, (r.x - F.x) * fogK, (r.y - F.y) * fogK, r.w * fogK, r.h * fogK);
  else { g.fillStyle = '#2a2c2e'; g.fillRect(0, 0, w, h); }
  // Névoa: mais densa nas bordas, como vidro embaçado.
  g.fillStyle = 'rgba(222,228,234,0.34)';
  g.fillRect(0, 0, w, h);
  const vig = g.createRadialGradient(w * 0.55, h * 0.5, Math.min(w, h) * 0.15, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(236,240,244,0)');
  vig.addColorStop(1, 'rgba(236,240,244,0.32)');
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);
  // Microgotas claras de condensação (pontos de luz, nunca manchas escuras).
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const drops = Math.round((F.w * F.h) / (view.mobile ? 900 : 2600));
  for (let i = 0; i < drops; i++) {
    const x = rnd() * w, y = rnd() * h, rr = (0.5 + rnd() ** 4 * 3.2) * fogK * 2.2;
    const glow = g.createRadialGradient(x - rr * 0.3, y - rr * 0.35, 0, x, y, rr);
    glow.addColorStop(0, 'rgba(255,255,255,0.85)');
    glow.addColorStop(0.45, 'rgba(255,255,255,0.28)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
  }
  const m = fogMask.getContext('2d');
  m.globalCompositeOperation = 'copy';
  m.drawImage(fogSrc, 0, 0);
  m.globalCompositeOperation = 'source-over';
  brush = document.createElement('canvas');
  const bs = Math.round((view.mobile ? 64 : 84) * fogK * 2);
  brush.width = brush.height = bs;
  const b = brush.getContext('2d');
  const grad = b.createRadialGradient(bs / 2, bs / 2, 0, bs / 2, bs / 2, bs / 2);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.85)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  b.fillStyle = grad;
  b.fillRect(0, 0, bs, bs);
  fogReady = true;
}

function drawFog(u, dt) {
  const [g0, g1] = T.interior.fog;
  const [, d1] = T.ppf.door;
  if (state.reduce || u < d1 - 0.18 || u > g1) return false;
  if (!fogReady) buildFog();
  // Embaça quando a porta termina de abrir; a rolagem limpa aos poucos (o dedo limpa na hora).
  const level = smooth(span(u, d1 - 0.18, d1 + 0.2)) * (1 - smooth(span(u, lerp(g0, g1, 0.55), g1)));
  if (level <= 0.002) return false;
  const m = fogMask.getContext('2d');
  // O vapor volta devagar onde foi limpo.
  m.globalCompositeOperation = 'source-over';
  m.globalAlpha = clamp(dt / 9000);
  m.drawImage(fogSrc, 0, 0);
  m.globalAlpha = 1;
  const strokes = pointer.strokes.filter(([x0, y0, x1, y1]) => inFrame(x0, y0, 40) || inFrame(x1, y1, 40));
  if (strokes.length) {
    m.globalCompositeOperation = 'destination-out';
    const bs = brush.width;
    for (const [x0, y0, x1, y1] of strokes) {
      const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(len / 7));
      for (let i = 0; i <= steps; i++) {
        const x = (lerp(x0, x1, i / steps) - F.x) * fogK, y = (lerp(y0, y1, i / steps) - F.y) * fogK;
        m.drawImage(brush, x - bs / 2, y - bs / 2);
      }
    }
    m.globalCompositeOperation = 'source-over';
    if (!fogWiped) { fogWiped = true; document.documentElement.classList.add('fog-wiped'); }
  }
  ctx.globalAlpha = level;
  ctx.drawImage(fogMask, F.x, F.y, F.w, F.h);
  ctx.globalAlpha = 1;
  return true;
}

export function resizeFx() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  css(canvas, 'inset', 'auto');
  css(canvas, 'left', `${f(F.x)}px`);
  css(canvas, 'top', `${f(F.y)}px`);
  css(canvas, 'width', `${f(F.w)}px`);
  css(canvas, 'height', `${f(F.h)}px`);
  canvas.width = Math.max(1, Math.round(F.w * dpr));
  canvas.height = Math.max(1, Math.round(F.h * dpr));
  seedFoam();
  fogReady = false;
  dirty = true;
}
IMG.interiorSoft.ready.then(() => { fogReady = false; });

/** Retorna true quando precisa de quadros contínuos (partículas vivas). */
export function renderFx(u, dt) {
  const needs = !state.covered && ((u > T.wash.foam[0] && u < T.wash.foam[3]) || (u > T.wash.reveal[0] && u < T.wash.reveal[1]) ||
    (u > T.hive.flip[0] - 0.2 && u < T.layers.tilt[0] + 0.15) || (u > T.ppf.door[0] && u < T.interior.fog[1]));
  if (!needs && !dirty) { pointer.taps.length = 0; pointer.strokes.length = 0; return false; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  toStage();
  let active = false;
  if (needs) {
    active = drawReveal(u) || active;
    active = drawFoam(u, dt) || active;
    active = drawHex(u, dt) || active;
    active = drawFog(u, dt) || active;
  }
  dirty = needs;
  pointer.taps.length = 0;
  pointer.strokes.length = 0;
  return active;
}

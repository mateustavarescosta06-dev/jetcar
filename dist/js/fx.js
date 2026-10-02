// Canvas de efeitos sobre as cenas: espuma interativa, bolhas que revelam o polimento,
// contornos da colmeia e o vidro embaçado do interior, que se limpa com o dedo.
import { $, view, state, pointer, clamp, lerp, span, smooth, out, inOut, env, usable } from './core.js';
import { T } from './timeline.js';
import { P, IMG, zoom } from './media.js';
import { hive, hexPath, cellFlip } from './hex.js';

const canvas = $('.fx');
const ctx = canvas.getContext('2d');
let dpr = 1, dirty = false;

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
  const n = view.mobile ? 30 : 54;
  for (let i = 0; i < n; i++) foam.push(newBubble(true));
}
function newBubble(anywhere) {
  const r = (view.mobile ? 6 : 8) + Math.random() ** 2.2 * (view.mobile ? 34 : 52);
  return { x: Math.random() * view.w, y: anywhere ? Math.random() * view.h : view.h + r + Math.random() * 80, r, vx: 0, vy: -(10 + Math.random() * 26), ph: Math.random() * 6.28, life: 1 };
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
      const dx = b.x - pointer.x, dy = b.y - pointer.y, d = Math.hypot(dx, dy), R = 150 + b.r;
      if (d < R && d > 0.1) { const k = (1 - d / R) ** 2 * 900 * s; b.vx += (dx / d) * k; b.vy += (dy / d) * k; }
    }
    b.vx *= Math.exp(-s * 2.2);
    b.vy = lerp(b.vy, -(12 + b.r * 0.5), 1 - Math.exp(-s * 1.4));
    b.x += b.vx * s; b.y += b.vy * s;
    if (b.y < -b.r * 2 || b.x < -120 || b.x > view.w + 120) Object.assign(b, newBubble(false));
    ctx.globalAlpha = level * 0.85;
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
    for (let k = 0; k < 6; k++) {
      const a = k * 1.047 + p.r, d = p.r * (1 + p.t * 1.6);
      ctx.fillStyle = '#fff';
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
function drawReveal(u) {
  const [r0, r1] = T.wash.reveal;
  if (u <= r0 || u >= r1) return false;
  const t = span(u, r0, r1);
  const k = zoom.polish(u);
  const pr = P.polish;
  if (state.reduce) {
    ctx.globalAlpha = smooth(t);
    drawZoomed(IMG.polish, pr, k);
    ctx.globalAlpha = 1;
    return true;
  }
  const circles = REVEAL.map(([x, y, d, r]) => {
    const g = out(clamp((t - d) / 0.5));
    return { x: x * view.w, y: y * view.h, r: g * r * view.diag, g };
  }).filter(c => c.r > 0.5);
  if (!circles.length) return false;
  ctx.save();
  ctx.beginPath();
  for (const c of circles) { ctx.moveTo(c.x + c.r, c.y); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); }
  ctx.clip();
  drawZoomed(IMG.polish, pr, k);
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
function drawZoomed(img, r, k) {
  if (!usable(img)) { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, view.w, view.h); return; }
  ctx.drawImage(img, view.cx + (r.x - view.cx) * k, view.cy + (r.y - view.cy) * k, r.w * k, r.h * k);
}

// ——— Colmeia: frente de onda luminosa e brilho sob o dedo no Ceramic Coating ———
const ripples = [];
function drawHex(u, dt) {
  const [f0, f1] = T.hive.flip;
  const wave = !state.reduce && u > f0 - 0.15 && u < f1 + 0.05;
  const [c0, , , c3] = T.ceramic.copy;
  const touchZone = !state.reduce && u >= f1 && u < c3 + 0.1;
  if (!wave && !touchZone && !ripples.length) return false;
  const t = span(u, f0, f1);
  const live = pointer.at > state.now - 1600;
  for (const tap of pointer.taps) if (touchZone) ripples.push({ x: tap.x, y: tap.y, t: 0 });
  const s = dt / 1000;
  for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].t += s * 0.9; if (ripples[i].t > 1) ripples.splice(i, 1); }
  if (!wave && !touchZone) { ripples.length = 0; return false; }
  const zoneLevel = touchZone ? env(u, [f1, f1 + 0.15, c3 - 0.1, c3 + 0.1]) : 0;
  const pre = smooth(span(u, f0 - 0.15, f0 + 0.1));
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(214,236,255,1)';
  // Agrupa as células por intensidade: poucos traços por quadro em vez de um por célula.
  const BUCKETS = 8, groups = Array.from({ length: BUCKETS }, () => []);
  let any = false;
  for (const c of hive.cells) {
    let a = 0;
    if (wave) {
      const p = cellFlip(c, t);
      a = Math.max(a, pre * 0.16 * (1 - smooth(span(u, f1 - 0.2, f1 + 0.05))), Math.sin(p * Math.PI) * 0.85);
    }
    if (zoneLevel > 0) {
      if (live) { const d = Math.hypot(c.x - pointer.x, c.y - pointer.y); a = Math.max(a, (1 - clamp(d / 210)) ** 2 * 0.5 * zoneLevel); }
      for (const r of ripples) {
        const d = Math.hypot(c.x - r.x, c.y - r.y), front = r.t * view.diag * 0.7;
        a = Math.max(a, (1 - clamp(Math.abs(d - front) / 90)) * (1 - r.t) * 0.7 * zoneLevel);
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
let fogReady = false, fogWiped = false, brush = null;
function buildFog() {
  fogReady = false;
  const w = Math.round(view.w * dpr * 0.5), h = Math.round(view.h * dpr * 0.5);
  fogSrc.width = fogMask.width = w; fogSrc.height = fogMask.height = h;
  const g = fogSrc.getContext('2d');
  const r = P.interior;
  const sc = w / view.w;
  if (usable(IMG.interiorSoft)) g.drawImage(IMG.interiorSoft, r.x * sc, r.y * sc, r.w * sc, r.h * sc);
  else { g.fillStyle = '#2a2c2e'; g.fillRect(0, 0, w, h); }
  // Névoa: mais densa nas bordas, como vidro embaçado.
  g.fillStyle = 'rgba(222,228,234,0.46)';
  g.fillRect(0, 0, w, h);
  const vig = g.createRadialGradient(w * 0.55, h * 0.5, Math.min(w, h) * 0.15, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(236,240,244,0)');
  vig.addColorStop(1, 'rgba(236,240,244,0.38)');
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);
  // Microgotas claras de condensação (pontos de luz, nunca manchas escuras).
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const drops = view.mobile ? 140 : 260;
  for (let i = 0; i < drops; i++) {
    const x = rnd() * w, y = rnd() * h, rr = (0.5 + rnd() ** 4 * 3.2) * sc * 2.2;
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
  const bs = Math.round((view.mobile ? 74 : 92) * sc * 2);
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
  const sc = fogMask.width / view.w;
  // O vapor volta devagar onde foi limpo.
  m.globalCompositeOperation = 'source-over';
  m.globalAlpha = clamp(dt / 9000);
  m.drawImage(fogSrc, 0, 0);
  m.globalAlpha = 1;
  if (pointer.strokes.length) {
    m.globalCompositeOperation = 'destination-out';
    const bs = brush.width;
    for (const [x0, y0, x1, y1] of pointer.strokes) {
      const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(len / 7));
      for (let i = 0; i <= steps; i++) {
        const x = lerp(x0, x1, i / steps) * sc, y = lerp(y0, y1, i / steps) * sc;
        m.drawImage(brush, x - bs / 2, y - bs / 2);
      }
    }
    m.globalCompositeOperation = 'source-over';
    if (!fogWiped) { fogWiped = true; document.documentElement.classList.add('fog-wiped'); }
  }
  ctx.globalAlpha = level;
  ctx.drawImage(fogMask, 0, 0, view.w, view.h);
  ctx.globalAlpha = 1;
  return true;
}

export function resizeFx() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(view.w * dpr);
  canvas.height = Math.round(view.h * dpr);
  seedFoam();
  fogReady = false;
  dirty = true;
}
IMG.interiorSoft.ready.then(() => { fogReady = false; });

/** Retorna true quando precisa de quadros contínuos (partículas vivas). */
export function renderFx(u, dt) {
  const needs = (u > T.wash.foam[0] && u < T.wash.foam[3]) || (u > T.wash.reveal[0] && u < T.wash.reveal[1]) ||
    (u > T.hive.flip[0] - 0.2 && u < T.ceramic.copy[3] + 0.15) || (u > T.ppf.door[0] && u < T.interior.fog[1]);
  if (!needs && !dirty) { pointer.taps.length = 0; pointer.strokes.length = 0; return false; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, view.w, view.h);
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

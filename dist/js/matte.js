// Máscara sobre o filme: o vídeo aparece dentro do logo JETCAR (abertura), atravessa o
// farol do emblema para a lavagem, e volta no final dentro de uma fenda e de BOA VIAGEM.
import { $, view, state, pointer, clamp, lerp, span, inOut, out, smooth, usable } from './core.js';
import { T } from './timeline.js';
import { P, IMG, zoom } from './media.js';
import { LOGO } from './logo-data.js';
import { TYPE } from './type-data.js';

const canvas = $('.matte');
const ctx = canvas.getContext('2d');
const INK = '#050505';

const parts = LOGO.parts.map(p => ({ ...p, path: new Path2D(p.d) }));
const emblem = parts.filter(p => p.kind === 'emblem');
const word = parts.filter(p => p.kind === 'word');
const sub = parts.filter(p => p.kind === 'sub').sort((a, b) => a.box[0] - b.box[0]);
const ring = LOGO.ring, stem = LOGO.stem;
const logoCenter = { x: LOGO.w / 2, y: LOGO.h / 2 };
// Faixas horizontais do emblema: cada uma chega deslizando como as linhas de velocidade.
const SLICES = 11, sliceH = 392 / SLICES;

const boa = TYPE['BOA VIAGEM'];
const glyphs = boa.glyphs.map(g => ({ ...g, path: new Path2D(g.d) }));
const vIndex = glyphs.findIndex(g => g.ch === 'V');

let dpr = 1, drawn = false;

export function resizeMatte() {
  // 1,75x basta para bordas nítidas e poupa ~25% de pixels em telas 3x.
  dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  canvas.width = Math.round(view.w * dpr);
  canvas.height = Math.round(view.h * dpr);
  drawn = true; // força limpeza no próximo quadro
}

/** Logo em repouso: escala e âncora na tela. */
export function logoRest() {
  const width = view.portrait ? view.w * (view.mobile ? 0.84 : 0.72) : Math.min(view.w * 0.66, 1040, view.h * (view.short ? 0.95 : 1.3));
  return { s: width / LOGO.w, x: view.cx, y: view.h * (view.portrait ? 0.43 : view.short ? 0.4 : 0.45) };
}

/** Câmera do logo: ponto do logo (cx, cy) desenhado na posição de tela (px, py) com escala s. */
function camera(u) {
  const rest = logoRest();
  const [p0, p1] = T.brand.pull, [d0, d1] = T.brand.portal;
  const S0 = Math.max(view.w / (stem.x1 - stem.x0), view.h / (stem.y1 - stem.y0)) * 1.18;
  if (state.reduce) return { s: rest.s, cx: logoCenter.x, cy: logoCenter.y, px: rest.x, py: rest.y, pull: 1, dive: span(u, d0, d1) };
  if (u < d0) {
    const t = inOut(span(u, p0, p1));
    const s = Math.exp(lerp(Math.log(S0), Math.log(rest.s), t));
    // Interpola no espaço do inverso da escala: o alvo continua na tela durante o recuo.
    const w = clamp((1 / s - 1 / S0) / (1 / rest.s - 1 / S0));
    return { s, cx: lerp(stem.cx, logoCenter.x, w), cy: lerp(stem.cy, logoCenter.y, w), px: lerp(view.cx, rest.x, w), py: lerp(view.cy, rest.y, w), pull: t, dive: 0 };
  }
  const t = span(u, d0, d1), e = t * t * (2.2 - 1.2 * t);
  const S2 = (view.diag * 0.53) / ring.inner;
  const s = Math.exp(lerp(Math.log(rest.s), Math.log(S2), e));
  const w = clamp((1 / s - 1 / rest.s) / (1 / S2 - 1 / rest.s));
  return { s, cx: lerp(logoCenter.x, ring.cx, w), cy: lerp(logoCenter.y, ring.cy, w), px: lerp(rest.x, view.cx, w), py: lerp(rest.y, view.cy, w), pull: 1, dive: t };
}

function setT(s, cx, cy, px, py, dx = 0, dy = 0, sx = 1) {
  // tela = (p - c) * s + destino; sx estica na horizontal (linhas de velocidade).
  ctx.setTransform(dpr * s * sx, 0, 0, dpr * s, dpr * (px - cx * s * sx + dx * s), dpr * (py - cy * s + dy * s));
}

function drawImageRect(img, r, k) {
  if (!usable(img)) return false;
  const x = view.cx + (r.x - view.cx) * k, y = view.cy + (r.y - view.cy) * k;
  ctx.drawImage(img, x, y, r.w * k, r.h * k);
  return true;
}

/** Vidro: clareia de leve só onde há recorte (o filme é escuro) para as letras lerem bem. */
let glazeGrad = null, glazeH = 0;
function glaze(alpha) {
  if (alpha <= 0.01) return;
  if (!glazeGrad || glazeH !== view.h) {
    glazeH = view.h;
    glazeGrad = ctx.createLinearGradient(0, 0, 0, view.h);
    glazeGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
    glazeGrad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
    glazeGrad.addColorStop(1, 'rgba(255,255,255,0.05)');
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'destination-over';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = glazeGrad;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawBrand(u) {
  const c = camera(u);
  const reduce = state.reduce;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  const matteAlpha = reduce ? smooth(span(u, T.brand.pull[0], T.brand.pull[0] + 0.6)) : 1;
  ctx.globalAlpha = matteAlpha;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'destination-out';

  const hold = smooth(span(u, T.brand.pull[1] - 0.2, T.brand.hold[0] + 0.2)) * (1 - span(u, T.brand.portal[0], T.brand.portal[0] + 0.3));
  const par = reduce ? 0 : hold;
  const ox = pointer.sx * 10 * par, oy = pointer.sy * 6 * par;
  // Velocidade da rolagem estica as linhas de velocidade.
  const stretch = reduce ? 1 : 1 + clamp(Math.abs(state.vel) * 0.22, 0, 0.45) * hold;

  // Palavra JETCAR
  setT(c.s, c.cx, c.cy, c.px, c.py, ox * 0.4, oy * 0.4);
  for (const p of word) ctx.fill(p.path);

  // Subtítulo letra a letra
  sub.forEach((p, i) => {
    const a = reduce ? 1 : smooth(span(c.pull, 0.62 + i * 0.012, 0.8 + i * 0.012));
    if (a <= 0) return;
    ctx.globalAlpha = a;
    setT(c.s, c.cx, c.cy, c.px, c.py, ox * 0.25, oy * 0.25 + (1 - a) * 12);
    ctx.fill(p.path);
  });
  ctx.globalAlpha = 1;

  // Emblema em faixas que chegam da esquerda (assentado: desenha de uma vez, sem recortes).
  const settled = reduce || (c.pull >= 1 && stretch < 1.001);
  if (settled) {
    setT(c.s, c.cx, c.cy, c.px, c.py, ox, oy);
    for (const p of emblem) ctx.fill(p.path);
  }
  for (let i = 0; i < SLICES && !settled; i++) {
    const order = (i * 7) % SLICES;
    const e = reduce ? 1 : out(span(c.pull, 0.38 + order * 0.025, 0.74 + order * 0.025));
    if (e <= 0) continue;
    const y0 = i * sliceH, dx = -(1 - e) * 1400 + ox, k = (1 + (1 - e) * 1.6) * stretch;
    ctx.save();
    setT(c.s, c.cx, c.cy, c.px, c.py, 0, oy);
    ctx.beginPath();
    ctx.rect(-4000, y0 - 0.5, 9000, sliceH + 1);
    ctx.clip();
    ctx.globalAlpha = clamp(e * 1.4);
    // Estica ancorado na borda direita do emblema (x≈1150).
    setT(c.s, c.cx, c.cy, c.px, c.py, dx + (1 - k) * (1150 - c.cx), oy, k);
    for (const p of emblem) ctx.fill(p.path);
    ctx.restore();
  }

  ctx.globalCompositeOperation = 'source-over';
  // O vidro entra quando o logo começa a aparecer inteiro.
  glaze(smooth(span(c.pull, 0.35, 0.8)) * matteAlpha ** 4 * (1 - c.dive));
  // Contorno luminoso discreto nas letras, só em repouso.
  if (hold > 0.01) {
    ctx.globalAlpha = 0.38 * hold;
    ctx.strokeStyle = '#fff';
    setT(c.s, c.cx, c.cy, c.px, c.py, ox * 0.4, oy * 0.4);
    ctx.lineWidth = 1 / c.s;
    for (const p of word) ctx.stroke(p.path);
    ctx.globalAlpha = 1;
  }

  // Farol = portal: a lavagem aparece dentro do círculo e cresce até tomar a tela.
  const preview = reduce ? 0 : smooth(span(u, T.brand.hold[0] + 0.1, T.brand.hold[1]));
  const rx = c.px + (ring.cx - c.cx) * c.s, ry = c.py + (ring.cy - c.cy) * c.s, rr = ring.inner * c.s;
  if (preview > 0 && rr > 0.5) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.beginPath();
    ctx.arc(rx, ry, rr, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = preview;
    drawImageRect(IMG.wash, P.wash, zoom.wash(u));
    ctx.restore();
    // Brilho na borda do portal
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = preview * 0.5 * (1 - c.dive);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(rx, ry, rr, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (reduce) {
    // Sem zoom: a lavagem surge em dissolução.
    const fade = smooth(span(u, T.brand.portal[0], T.brand.portal[1]));
    if (fade > 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = fade;
      drawImageRect(IMG.wash, P.wash, zoom.wash(u));
      ctx.globalAlpha = 1;
    }
  }
}

/** Geometria das letras BOA VIAGEM: uma linha no desktop, duas no celular. */
function boaLayout() {
  const lines = view.w / view.h < 1.1 ? [glyphs.slice(0, vIndex), glyphs.slice(vIndex)] : [glyphs];
  const widthOf = gs => gs[gs.length - 1].x + gs[gs.length - 1].adv - gs[0].x;
  const maxW = Math.max(...lines.map(widthOf));
  const flatShort = view.short && !view.portrait;
  const s = Math.min((view.w * (lines.length > 1 ? 0.86 : 0.88)) / maxW, (view.h * (flatShort ? 0.17 : 0.3)) / (boa.cap * lines.length));
  const lineH = boa.cap * s * 1.14;
  const top = view.h * (view.portrait ? (view.short ? 0.3 : 0.36) : flatShort ? 0.3 : 0.4) - (lineH * lines.length) / 2;
  return { s, lines: lines.map((gs, i) => ({ gs, x0: gs[0].x, w: widthOf(gs), base: top + lineH * i + boa.cap * s })) };
}

/** Faixa de cinema do final: os cartões do anel se achatam exatamente nesta linha. */
export function placeGeometry() {
  const L = boaLayout();
  const bandH = Math.max(L.lines.length * boa.cap * L.s * 1.5, view.h * (view.mobile ? 0.3 : 0.42));
  const bandY = (L.lines[0].base - boa.cap * L.s + L.lines[L.lines.length - 1].base) / 2;
  return { L, bandH, bandY };
}

function drawPlace(u) {
  const reduce = state.reduce;
  const [s0, s1] = T.place.slit, [l0, l1] = T.place.letters, [f0, f1] = T.place.final;
  const slit = reduce ? 1 : inOut(span(u, s0, s1));
  const letters = reduce ? smooth(span(u, s0, l1)) : inOut(span(u, l0, l1));
  const fin = inOut(span(u, f0, f1));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.globalCompositeOperation = 'destination-out';

  const { L, bandH, bandY } = placeGeometry();
  // Fenda: nasce da linha formada pelos cartões e abre em faixa de cinema.
  const band = (1 - letters) * (reduce ? 0 : 1);
  if (band > 0.002) {
    const h = lerp(3, bandH, slit);
    ctx.globalAlpha = band;
    ctx.fillRect(0, bandY - h / 2, view.w, h);
  }
  // Letras com o filme dentro.
  const lettersAlpha = (reduce ? letters : clamp(slit * 4)) * (1 - fin);
  const strokes = [];
  if (lettersAlpha > 0.002) {
    const par = reduce ? 0 : 1;
    L.lines.forEach((line, li) => {
      const startX = view.cx - (line.w * L.s) / 2 - line.x0 * L.s;
      line.gs.forEach((g, gi) => {
        const k = reduce ? 1 : 1 + (1 - out(span(letters, gi * 0.06, 0.55 + gi * 0.06))) * 0.18;
        const gx = startX + (g.x + g.adv / 2) * L.s + pointer.sx * (6 + gi) * par;
        const gy = line.base - (boa.cap / 2) * L.s + pointer.sy * 4 * par;
        const sc = L.s * k * lerp(1, 0.86, fin);
        ctx.globalAlpha = lettersAlpha;
        const m = [dpr * sc, 0, 0, dpr * sc, dpr * (gx - (g.x + g.adv / 2) * sc), dpr * (gy + (boa.cap / 2) * sc)];
        ctx.setTransform(...m);
        ctx.fill(g.path);
        strokes.push([m, g]);
      });
    });
  }
  // Assinatura final: o logo volta com o filme dentro.
  let logoT = null;
  if (fin > 0.002) {
    const rest = logoRest();
    const s = rest.s * (view.portrait ? (view.short ? 0.66 : 0.82) : view.short ? 0.46 : 0.62) * lerp(1.08, 1, fin);
    ctx.globalAlpha = fin;
    logoT = [s, logoCenter.x, logoCenter.y, view.cx, view.h * (view.portrait ? (view.short ? 0.3 : 0.38) : view.short ? 0.28 : 0.38)];
    setT(...logoT);
    for (const p of parts) ctx.fill(p.path);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  glaze(Math.max(lettersAlpha, fin) * (1 - band * 0.6));
  // Contorno das letras
  ctx.strokeStyle = '#fff';
  if (lettersAlpha > 0.01) {
    ctx.globalAlpha = 0.34 * lettersAlpha;
    for (const [m, g] of strokes) { ctx.setTransform(...m); ctx.lineWidth = 1 / (m[0] / dpr); ctx.stroke(g.path); }
  }
  if (logoT) {
    ctx.globalAlpha = 0.3 * fin;
    setT(...logoT);
    ctx.lineWidth = 1 / logoT[0];
    for (const p of word) ctx.stroke(p.path);
  }
  ctx.globalAlpha = 1;
}

export function renderMatte(u) {
  const brand = u >= T.brand.pull[0] && u < T.brand.portal[1] + 0.01;
  const place = u >= T.place.slit[0] - 0.01;
  if (!brand && !place) {
    if (drawn) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); drawn = false; }
    return;
  }
  drawn = true;
  if (brand) drawBrand(u);
  else drawPlace(u);
}

export { camera as brandCamera };

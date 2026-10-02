// Máscara sobre o filme: o vídeo aparece dentro do logo JETCAR, a câmera mergulha no farol
// do emblema (que vira a moldura dos serviços) e, no final, o filme volta numa fenda e em BOA VIAGEM.
import { $, view, frame as F, state, pointer, clamp, lerp, span, inOut, out, smooth, css } from './core.js';
import { T } from './timeline.js';
import { LOGO } from './logo-data.js';
import { TYPE } from './type-data.js';

const canvas = $('.matte');
const ctx = canvas.getContext('2d');
const INK = '#09090a'; // igual ao fundo da página: quando a máscara some, nada muda de cor

const parts = LOGO.parts.map(p => ({ ...p, path: new Path2D(p.d) }));
const emblem = parts.filter(p => p.kind === 'emblem');
const word = parts.filter(p => p.kind === 'word');
const sub = parts.filter(p => p.kind === 'sub').sort((a, b) => a.box[0] - b.box[0]);
const ring = LOGO.ring;
const logoCenter = { x: LOGO.w / 2, y: LOGO.h / 2 };
// Faixas horizontais do emblema: chegam deslizando, como linhas de velocidade.
const SLICES = 11, sliceH = 392 / SLICES;

const boa = TYPE['BOA VIAGEM'];
const glyphs = boa.glyphs.map(g => ({ ...g, path: new Path2D(g.d) }));
const vIndex = glyphs.findIndex(g => g.ch === 'V');

let dpr = 1, drawn = false;

export function resizeMatte() {
  // 1,75x basta para bordas nítidas e poupa pixels em telas 3x.
  dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  canvas.width = Math.round(view.w * dpr);
  canvas.height = Math.round(view.h * dpr);
  drawn = true; // força limpeza no próximo quadro
}

/** Logo em repouso: escala e âncora (centro da área visível, abaixo do menu). */
export function logoRest() {
  const width = view.portrait ? view.w * (view.mobile ? 0.82 : 0.68) : Math.min(view.w * 0.6, 980, view.svh * (view.short ? 0.95 : 1.22));
  const y = view.portrait ? (view.nav + view.svh) / 2 - view.svh * 0.03 : (view.nav + view.svh) / 2 - view.svh * 0.02;
  return { s: width / LOGO.w, x: view.cx, y };
}

/** Raio final do farol: o círculo inscrito na moldura. */
export const portalRadius = () => Math.min(F.w, F.h) / 2;

/** Câmera do logo: o ponto (cx, cy) do logo é desenhado na posição (px, py) da tela, com escala s. */
function camera(u) {
  const rest = logoRest();
  const [p0, p1] = T.brand.pull, [d0, d1] = T.brand.portal;
  if (state.reduce) return { s: rest.s, cx: logoCenter.x, cy: logoCenter.y, px: rest.x, py: rest.y, pull: 1, dive: 0 };
  if (u < d0) {
    // Recuo suave: começa por dentro das letras e assenta no logo inteiro.
    const S0 = rest.s * 5;
    const t = inOut(span(u, p0, p1));
    const s = Math.exp(lerp(Math.log(S0), Math.log(rest.s), t));
    return { s, cx: logoCenter.x, cy: logoCenter.y, px: rest.x, py: rest.y, pull: t, dive: 0 };
  }
  // Mergulho no farol: o anel cresce e vai para o centro da moldura.
  const t = inOut(span(u, d0, d1));
  const S2 = portalRadius() / ring.inner;
  const s = Math.exp(lerp(Math.log(rest.s), Math.log(S2), t));
  // Interpola no espaço do inverso da escala: o farol continua na tela o tempo todo.
  const w = clamp((1 / s - 1 / rest.s) / (1 / S2 - 1 / rest.s));
  return { s, cx: lerp(logoCenter.x, ring.cx, w), cy: lerp(logoCenter.y, ring.cy, w), px: lerp(rest.x, F.cx, w), py: lerp(rest.y, F.cy, w), pull: 1, dive: t };
}

/** Círculo interno do farol na tela (a janela para a moldura). */
export function portalCircle(u) {
  const c = camera(u);
  return { x: c.px + (ring.cx - c.cx) * c.s, y: c.py + (ring.cy - c.cy) * c.s, r: ring.inner * c.s };
}

/** Caixa do logo em repouso, para os rótulos técnicos ao redor dele. */
export function logoBox() {
  const r = logoRest();
  return { x: r.x - logoCenter.x * r.s, y: r.y - logoCenter.y * r.s, w: LOGO.w * r.s, h: LOGO.h * r.s };
}

function setT(s, cx, cy, px, py, dx = 0, dy = 0, sx = 1) {
  // tela = (p - c) * s + destino; sx estica na horizontal (linhas de velocidade).
  ctx.setTransform(dpr * s * sx, 0, 0, dpr * s, dpr * (px - cx * s * sx + dx * s), dpr * (py - cy * s + dy * s));
}

/** Vidro: clareia de leve só onde há recorte (o filme é escuro) para as letras lerem bem. */
let glazeGrad = null, glazeH = 0;
function glaze(alpha) {
  if (alpha <= 0.01) return;
  if (!glazeGrad || glazeH !== view.h) {
    glazeH = view.h;
    glazeGrad = ctx.createLinearGradient(0, 0, 0, view.h);
    glazeGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
    glazeGrad.addColorStop(0.5, 'rgba(255,255,255,0.09)');
    glazeGrad.addColorStop(1, 'rgba(255,255,255,0.04)');
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
  const [d0, d1] = T.brand.portal, [m0, m1] = T.frame.morph;
  // Tinta: entra sobre o filme no início e sai depois do mergulho, revelando o fundo da página.
  const ink = smooth(span(u, T.brand.fade[0], T.brand.fade[1])) * (1 - smooth(span(u, m0, lerp(m0, m1, 0.7))));
  // Recortes (filme): somem na segunda metade do mergulho.
  const holes = reduce ? 1 - smooth(span(u, T.brand.hold[1] - 0.1, d0 + 0.35)) : 1 - smooth(span(u, lerp(d0, d1, 0.45), d1));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'copy';
  ctx.globalAlpha = ink;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.globalAlpha = 1;
  if (holes <= 0.002 || ink <= 0.002) { ctx.globalCompositeOperation = 'source-over'; return; }
  ctx.globalCompositeOperation = 'destination-out';

  const hold = smooth(span(u, T.brand.pull[1] - 0.25, T.brand.hold[0] + 0.15)) * (1 - span(u, d0, d0 + 0.3));
  const par = reduce ? 0 : hold;
  const ox = pointer.sx * 10 * par, oy = pointer.sy * 6 * par;
  // A velocidade da rolagem estica levemente as linhas de velocidade.
  const stretch = reduce ? 1 : 1 + clamp(Math.abs(state.vel) * 0.14, 0, 0.28) * hold;

  ctx.globalAlpha = holes;
  // Palavra JETCAR
  setT(c.s, c.cx, c.cy, c.px, c.py, ox * 0.4, oy * 0.4);
  for (const p of word) ctx.fill(p.path);

  // Subtítulo letra a letra
  sub.forEach((p, i) => {
    const a = reduce ? 1 : smooth(span(c.pull, 0.6 + i * 0.012, 0.78 + i * 0.012));
    if (a <= 0) return;
    ctx.globalAlpha = a * holes;
    setT(c.s, c.cx, c.cy, c.px, c.py, ox * 0.25, oy * 0.25 + (1 - a) * 12);
    ctx.fill(p.path);
  });
  ctx.globalAlpha = holes;

  // Emblema em faixas que chegam da esquerda (assentado: desenha de uma vez, sem recortes).
  const settled = reduce || (c.pull >= 1 && stretch < 1.001);
  if (settled) {
    setT(c.s, c.cx, c.cy, c.px, c.py, ox, oy);
    for (const p of emblem) ctx.fill(p.path);
  }
  for (let i = 0; i < SLICES && !settled; i++) {
    const order = (i * 7) % SLICES;
    const e = out(span(c.pull, 0.34 + order * 0.024, 0.7 + order * 0.024));
    if (e <= 0) continue;
    const y0 = i * sliceH, dx = -(1 - e) * 820 + ox, k = (1 + (1 - e) * 0.9) * stretch;
    ctx.save();
    setT(c.s, c.cx, c.cy, c.px, c.py, 0, oy);
    ctx.beginPath();
    ctx.rect(-4000, y0 - 0.5, 9000, sliceH + 1);
    ctx.clip();
    ctx.globalAlpha = clamp(e * 1.4) * holes;
    // Estica ancorado na borda direita do emblema (x≈1150).
    setT(c.s, c.cx, c.cy, c.px, c.py, dx + (1 - k) * (1150 - c.cx), oy, k);
    for (const p of emblem) ctx.fill(p.path);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // O vidro entra quando o logo aparece inteiro.
  glaze(smooth(span(c.pull, 0.35, 0.8)) * ink ** 4 * holes);
  // Contorno luminoso discreto nas letras, só em repouso.
  if (hold > 0.01) {
    ctx.globalAlpha = 0.34 * hold * holes;
    ctx.strokeStyle = '#fff';
    setT(c.s, c.cx, c.cy, c.px, c.py, ox * 0.4, oy * 0.4);
    ctx.lineWidth = 1 / c.s;
    for (const p of word) ctx.stroke(p.path);
    ctx.globalAlpha = 1;
  }
  // Brilho na borda do farol enquanto a lavagem aparece dentro dele.
  const glow = reduce ? 0 : smooth(span(u, T.frame.preview[0], T.frame.preview[1])) * (1 - smooth(span(u, d0, lerp(d0, d1, 0.6))));
  if (glow > 0.01) {
    const p = portalCircle(u);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = glow * 0.6;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 1.5, Math.PI * 1.05, Math.PI * 1.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** Geometria das letras BOA VIAGEM: uma linha em telas largas, duas em telas em pé. */
function boaLayout() {
  const lines = view.w / view.h < 1.1 ? [glyphs.slice(0, vIndex), glyphs.slice(vIndex)] : [glyphs];
  const widthOf = gs => gs[gs.length - 1].x + gs[gs.length - 1].adv - gs[0].x;
  const maxW = Math.max(...lines.map(widthOf));
  const flatShort = view.short && !view.portrait;
  const s = Math.min((view.w * (lines.length > 1 ? 0.8 : 0.84)) / maxW, (view.svh * (flatShort ? 0.17 : 0.27)) / (boa.cap * lines.length));
  const lineH = boa.cap * s * 1.16;
  const mid = view.portrait ? view.nav + (view.svh * 0.5 - view.nav) * 0.5 : flatShort ? view.svh * 0.32 : view.nav + (view.svh - view.nav) * 0.32;
  const top = mid - (lineH * lines.length) / 2;
  return { s, lines: lines.map((gs, i) => ({ gs, x0: gs[0].x, w: widthOf(gs), base: top + lineH * i + boa.cap * s })) };
}

/** Faixa de cinema do final: os cartões do arco se achatam exatamente nesta linha. */
export function placeGeometry() {
  const L = boaLayout();
  const bandH = Math.max(L.lines.length * boa.cap * L.s * 1.5, view.svh * (view.mobile ? 0.26 : 0.36));
  const bandY = (L.lines[0].base - boa.cap * L.s + L.lines[L.lines.length - 1].base) / 2;
  return { L, bandH, bandY };
}

function drawPlace(u) {
  const reduce = state.reduce;
  const [s0, s1] = T.place.slit, [l0, l1] = T.place.letters;
  const slit = reduce ? 1 : inOut(span(u, s0, s1));
  const letters = reduce ? smooth(span(u, s0, l1)) : inOut(span(u, l0, l1));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'copy';
  ctx.globalAlpha = 1;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.globalCompositeOperation = 'destination-out';

  const { L, bandH, bandY } = placeGeometry();
  // Fenda: nasce da linha formada pelos cartões e abre em faixa de cinema.
  const band = (1 - letters) * (reduce ? 0 : 1);
  if (band > 0.002) {
    const h = lerp(2, bandH, slit);
    ctx.globalAlpha = band;
    ctx.fillRect(0, bandY - h / 2, view.w, h);
  }
  // Letras com o filme dentro.
  const lettersAlpha = reduce ? letters : clamp(slit * 4);
  const strokes = [];
  if (lettersAlpha > 0.002) {
    const par = reduce ? 0 : 1;
    L.lines.forEach(line => {
      const startX = view.cx - (line.w * L.s) / 2 - line.x0 * L.s;
      line.gs.forEach((g, gi) => {
        const k = reduce ? 1 : 1 + (1 - out(span(letters, gi * 0.06, 0.55 + gi * 0.06))) * 0.16;
        const gx = startX + (g.x + g.adv / 2) * L.s + pointer.sx * (5 + gi) * par;
        const gy = line.base - (boa.cap / 2) * L.s + pointer.sy * 4 * par;
        const sc = L.s * k;
        ctx.globalAlpha = lettersAlpha;
        const m = [dpr * sc, 0, 0, dpr * sc, dpr * (gx - (g.x + g.adv / 2) * sc), dpr * (gy + (boa.cap / 2) * sc)];
        ctx.setTransform(...m);
        ctx.fill(g.path);
        strokes.push([m, g]);
      });
    });
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  glaze(lettersAlpha * (1 - band * 0.6));
  if (lettersAlpha > 0.01) {
    ctx.strokeStyle = '#fff';
    ctx.globalAlpha = 0.3 * lettersAlpha;
    for (const [m, g] of strokes) { ctx.setTransform(...m); ctx.lineWidth = 1 / (m[0] / dpr); ctx.stroke(g.path); }
  }
  ctx.globalAlpha = 1;
}

export function renderMatte(u) {
  const brand = u >= T.brand.fade[0] && u < T.frame.morph[1] && !state.covered;
  const place = u >= T.place.slit[0] - 0.01 && !state.covered;
  css(canvas, 'visibility', brand || place ? 'visible' : 'hidden');
  if (!brand && !place) {
    if (drawn) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); drawn = false; }
    return;
  }
  drawn = true;
  if (brand) drawBrand(u);
  else drawPlace(u);
}

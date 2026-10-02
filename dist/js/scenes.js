// Cenas em DOM/CSS 3D. Cada transição começa exatamente onde a anterior termina:
// o retângulo final de uma cena é o retângulo inicial da próxima.
import { $, $$, view, state, pointer, clamp, lerp, span, smooth, inOut, out, env, css, on, opacity, f, zoomRect, toRect, cover } from './core.js';
import { T, IMAGES } from './timeline.js';
import { P, zoom } from './media.js';
import { hive, buildHive, cellFlip } from './hex.js';
import { placeGeometry } from './matte.js';

const L = {
  wash: $('.layer-wash'), polish: $('.layer-polish'), hive: $('.layer-hive'), ceramic: $('.layer-ceramic'),
  stack: $('.layer-stack'), interior: $('.layer-interior'), ppf: $('.layer-ppf'), ring: $('.layer-ring'),
};
const el = {
  wash: $('img', L.wash),
  polishSoft: $('img', L.polish), dim: $('.dim', L.polish), disc: $('.disc', L.polish), discImg: $('.disc img', L.polish), sheen: $('.sheen', L.polish), orbit: $('.orbit', L.polish),
  ceramic: $('img', L.ceramic),
  rig: $('.rig', L.stack), base: $('.plane-base'), photo: $('.plane-photo'), photoPpf: $('.plane-photo .ph-ppf'), clear: $('.plane-clear'), guard: $('.plane-guard'),
  guardCeramic: $('.guard-ceramic'), guardFilm: $('.guard-film'), flap: $('.guard-flap'), tags: $$('.tag', L.stack),
  frame: $('.frame', L.interior), interior: $('.frame img', L.interior),
  door: $('.door', L.ppf), ppf: $('.door img', L.ppf), sheet: $('.film-sheet', L.ppf), shade: $('.door-shade', L.ppf), spec: $('.spec', L.ppf),
  cards: $$('.card', L.ring), ringHint: $('.ring-hint', L.ring),
};
const G = {}; // geometria calculada no resize

const zoomT = (key, k) => toRect(P[key], zoomRect(P[key], k, view.cx, view.cy));

// ——— Layout ———
export function layoutScenes() {
  const m = view.mobile;
  // Disco do polimento
  G.dcx = m ? view.cx : view.w * 0.64;
  G.dcy = m ? view.h * 0.335 : view.h * 0.5;
  G.Rd = m ? Math.min(view.w * 0.4, view.h * 0.175) : Math.min(view.h * 0.33, view.w * 0.25);
  css(el.sheen, 'left', `${G.dcx - G.Rd}px`); css(el.sheen, 'top', `${G.dcy - G.Rd}px`);
  css(el.sheen, 'width', `${G.Rd * 2}px`); css(el.sheen, 'height', `${G.Rd * 2}px`);
  css(el.disc, 'transformOrigin', `${G.dcx}px ${G.dcy}px`);
  G.orbitS = (G.Rd + (m ? 22 : 34)) / 0.44;
  css(el.orbit, 'width', `${G.orbitS}px`); css(el.orbit, 'height', `${G.orbitS}px`);

  buildCells();

  // Pilha de camadas: planos menores que a tela (economia de memória) ampliados por k0.
  const pc = P.ceramic, dpr = Math.min(window.devicePixelRatio || 1, 3);
  G.pw = Math.min(pc.w, 1536 / dpr * 1.15);
  G.ph = (G.pw * pc.h) / pc.w;
  G.k0 = pc.w / G.pw;
  for (const plane of [el.base, el.photo, el.clear, el.guard]) {
    css(plane, 'width', `${G.pw}px`); css(plane, 'height', `${G.ph}px`);
    css(plane, 'left', `${-G.pw / 2}px`); css(plane, 'top', `${-G.ph / 2}px`);
  }
  G.stackX = m ? view.w * 0.4 : view.w * 0.63;
  G.stackY = m ? view.h * 0.35 : view.h * 0.5;
  G.cardScale = (m ? view.w * 0.64 : Math.min(view.w * 0.4, view.h * 0.78)) / pc.w;
  G.persp = m ? 1100 : 1700;
  css(L.stack, 'perspective', `${G.persp}px`);
  for (const tag of el.tags) tag._w = 0;

  // Arco de serviços (cilindro visto de fora; o cartão em foco fica de frente)
  G.cw = m ? Math.min(view.w * 0.38, view.h * 0.2) : clamp(view.w * 0.145, 180, 270);
  G.ch = G.cw * 1.32;
  G.rcx = m ? view.cx : view.w * 0.31;
  G.rcy = m ? view.h * 0.33 : view.h * 0.53;
  G.step = m ? 30 : 34;
  G.R = G.cw * 1.95;
  css(L.ring, 'perspectiveOrigin', `${G.rcx}px ${G.rcy}px`);
  el.cards.forEach((card, i) => {
    css(card, 'width', `${G.cw}px`); css(card, 'height', `${G.ch}px`);
    const img = $('img', card), meta = IMAGES[['wash', 'polish', 'ceramic', 'ppf', 'interior'][i]];
    const r = cover(meta.w, meta.h, G.cw, G.ch, meta.fx, meta.fy);
    css(img, 'width', `${r.w}px`); css(img, 'height', `${r.h}px`); css(img, 'left', `${r.x}px`); css(img, 'top', `${r.y}px`);
  });
  G.cardRect = { x: G.rcx - G.cw / 2, y: G.rcy - G.ch / 2, w: G.cw, h: G.ch };
  el.ringHint._w = 0;
  const im = IMAGES.interior, ir = cover(im.w, im.h, G.cw, G.ch, im.fx, im.fy);
  G.interiorCard = { x: G.cardRect.x + ir.x, y: G.cardRect.y + ir.y, w: ir.w, h: ir.h };
}

function buildCells() {
  buildHive(G.dcx, G.dcy);
  const { r, a } = hive, pp = P.polish, pc = P.ceramic;
  const frag = document.createDocumentFragment();
  for (const c of hive.cells) {
    const node = document.createElement('div');
    node.className = 'cell';
    node.style.width = `${2 * r}px`;
    node.style.height = `${2 * a}px`;
    const x0 = c.x - r, y0 = c.y - a;
    const front = document.createElement('i');
    front.className = 'front';
    if (c.d < G.Rd + r) {
      front.style.backgroundImage = `radial-gradient(circle ${G.Rd}px at ${f(G.dcx - x0)}px ${f(G.dcy - y0)}px, transparent ${f(G.Rd - 0.6)}px, #050505 ${f(G.Rd)}px), url(${IMAGES.polish.src})`;
      front.style.backgroundSize = `auto, ${f(pp.w)}px ${f(pp.h)}px`;
      front.style.backgroundPosition = `0 0, ${f(pp.x - x0)}px ${f(pp.y - y0)}px`;
    } else front.style.background = '#050505';
    const back = document.createElement('i');
    back.className = 'back';
    back.style.backgroundImage = `url(${IMAGES.ceramic.src})`;
    back.style.backgroundSize = `${f(pc.w)}px ${f(pc.h)}px`;
    back.style.backgroundPosition = `${f(pc.x - x0)}px ${f(pc.y - y0)}px`;
    const shade = document.createElement('b');
    node.append(front, back, shade);
    c.node = node; c.shade = shade; c.back = false;
    frag.append(node);
  }
  L.hive.replaceChildren(frag);
}

// ——— Lavagem ———
function wash(u) {
  css(el.wash, 'transform', zoomT('wash', zoom.wash(u)));
}

// ——— Polimento: imagem → disco que gira → colmeia ———
function rotZoom(r, k, deg, px, py) {
  // Escala k em torno do centro do palco e rotação em torno do centro do disco (px, py).
  const a = (deg * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
  const cx = view.cx, cy = view.cy;
  const qx = cx + k * (r.x - cx) - px, qy = cy + k * (r.y - cy) - py; // canto após o zoom, relativo ao pivô
  const tx = px + cs * qx - sn * qy - r.x, ty = py + sn * qx + cs * qy - r.y;
  return `matrix(${f(k * cs, 5)},${f(k * sn, 5)},${f(-k * sn, 5)},${f(k * cs, 5)},${f(tx)},${f(ty)})`;
}

function polish(u) {
  const [, r1] = T.wash.reveal, [d0, d1] = T.polish.disc, end = T.polish.end;
  const reduce = state.reduce;
  const k = zoom.polish(u);
  const d = reduce ? 0 : inOut(span(u, d0, d1));
  const W = view.w, H = view.h, R = G.Rd;
  const clip = `inset(${f(d * (G.dcy - R))}px ${f(d * (W - G.dcx - R))}px ${f(d * (H - G.dcy - R))}px ${f(d * (G.dcx - R))}px round ${f(d * R)}px)`;
  css(el.disc, 'clipPath', clip);
  css(el.disc, 'webkitClipPath', clip);
  const turn = reduce ? 0 : 360 * inOut(span(u, d0, end));
  css(el.discImg, 'transform', rotZoom(P.polish, k, turn, G.dcx, G.dcy));
  css(el.polishSoft, 'transform', zoomT('polish', k));
  const hold = reduce ? 0 : env(u, [d0 + 0.3, d1 + 0.1, end - 0.42, end - 0.12]);
  opacity(el.dim, Math.max(d * 0.62, smooth(span(u, end - 0.4, end - 0.05))));
  // Inclinação 3D seguindo o ponteiro e reflexo que gira com ele.
  const tilt = hold * 10;
  css(el.disc, 'transform', tilt > 0.01 ? `perspective(1300px) rotateX(${f(-pointer.sy * tilt)}deg) rotateY(${f(pointer.sx * tilt)}deg)` : 'none');
  const ang = Math.atan2(pointer.y - G.dcy, pointer.x - G.dcx) * 57.3;
  css(el.sheen, 'transform', `rotate(${f((pointer.at > 0 ? ang : u * 120) + 90)}deg)`);
  opacity(el.sheen, hold * 0.95);
  const orb = env(u, [d1 - 0.25, d1 + 0.1, end - 0.42, end - 0.16]);
  opacity(el.orbit, orb);
  if (orb > 0) css(el.orbit, 'transform', `translate3d(${f(G.dcx - G.orbitS / 2)}px,${f(G.dcy - G.orbitS / 2)}px,0) rotate(${f(-u * 55 - pointer.sx * 8)}deg) scale(${f(lerp(0.9, 1, orb), 3)})`);
}

// ——— Colmeia: cada hexágono gira e revela o Ceramic Coating ———
function hiveScene(u) {
  const t = span(u, T.hive.flip[0], T.hive.flip[1]);
  const { r, a } = hive;
  for (const c of hive.cells) {
    const p = inOut(cellFlip(c, t)), deg = p * 180, back = deg > 90;
    if (back !== c.back) { c.back = back; c.node.classList.toggle('is-back', back); }
    const ang = back ? deg - 180 : deg;
    css(c.node, 'transform', `translate3d(${f(c.x - r)}px,${f(c.y - a)}px,0) perspective(620px) rotate3d(${f(c.ax, 3)},${f(c.ay, 3)},0,${f(ang)}deg) scale(1.014)`);
    opacity(c.shade, Math.sin((deg * Math.PI) / 180) * 0.62);
  }
}

function ceramic(u) {
  const reduce = state.reduce;
  const start = reduce ? T.polish.end : T.hive.flip[1];
  if (reduce) layerOpacity(L.ceramic, smooth(span(u, start, start + 0.5)));
  css(el.ceramic, 'transform', zoomT('ceramic', zoom.ceramic(u)));
}

// ——— Camadas: a foto deita, se separa em camadas e gira ———
function stack(u) {
  const [t0, t1] = T.layers.tilt, [e0, e1] = T.layers.explode, [s0, s1] = T.layers.swap, [c0, c1] = T.layers.collapse;
  const reduce = state.reduce;
  const tilt = reduce ? 1 : inOut(span(u, t0, t1));
  const col = reduce ? 0 : inOut(span(u, c0, c1));
  const ex = reduce ? 1 : inOut(span(u, e0, e1)) * (1 - inOut(span(u, c0, c0 + 0.5)));
  const holdP = env(u, [e0, e1, c0 - 0.2, c0 + 0.1]) * (reduce ? 0 : 1);
  const light = smooth(span(u, t0 + 0.12, t1)) * (1 - smooth(span(u, c0, c0 + 0.42)));
  state.light = light;
  css(L.stack, 'backgroundColor', `rgb(${Math.round(lerp(5, 233, light))},${Math.round(lerp(5, 231, light))},${Math.round(lerp(5, 225, light))})`);
  if (reduce) layerOpacity(L.stack, env(u, [t0, t0 + 0.4, c1 - 0.4, c1]));

  const kC = zoom.ceramic(t0), rc = zoomRect(P.ceramic, kC, view.cx, view.cy), rp = P.ppf;
  const startX = rc.x + rc.w / 2, startY = rc.y + rc.h / 2, endX = rp.x + rp.w / 2, endY = rp.y + rp.h / 2;
  const S = lerp(lerp(kC, G.cardScale, tilt), 1, col);
  const X = lerp(lerp(startX, G.stackX, tilt), endX, col), Y = lerp(lerp(startY, G.stackY, tilt), endY, col);
  const spin = 46 * inOut(span(u, e0, c0));
  const rz = lerp(lerp(0, -34 + spin + pointer.sx * 16 * holdP, tilt), 0, col);
  const rx = lerp(lerp(0, 56 - pointer.sy * 8 * holdP, tilt), 0, col);
  css(el.rig, 'transform', `translate3d(${f(X)}px,${f(Y)}px,0) rotateX(${f(rx)}deg) rotateZ(${f(rz)}deg) scale3d(${f(S, 4)},${f(S, 4)},${f(S, 4)})`);

  const gap = G.ph * G.k0 * 0.34 * ex;
  const others = (reduce ? 1 : smooth(span(u, t0 + 0.25, e0 + 0.3))) * (1 - (reduce ? 0 : smooth(span(u, c0 + 0.02, c0 + 0.42))));
  const planes = [[el.base, -1], [el.photo, 0], [el.clear, 1], [el.guard, 2]];
  for (const [p, z] of planes) {
    css(p, 'transform', `translate3d(0,0,${f(z * gap)}px) scale(${f(G.k0, 4)})`);
    if (p !== el.photo) opacity(p, others);
  }
  const sw = smooth(span(u, s0, s1));
  opacity(el.photoPpf, sw);
  opacity(el.guardCeramic, 1 - sw);
  opacity(el.guardFilm, sw);
  opacity(el.flap, sw);
  css(el.flap, 'transform', `rotate3d(1,1,0,${f(-150 * out(span(u, s0 + 0.1, s1 + 0.25)))}deg)`);

  const tagsOn = (reduce ? 1 : smooth(span(u, e0 + 0.3, e1 + 0.05))) * (1 - (reduce ? 0 : smooth(span(u, c0 - 0.05, c0 + 0.2))));
  // Rótulos em 2D, presos ao canto de cada camada pela mesma projeção do CSS 3D.
  const edgeX = (G.pw * G.k0) / 2, edgeY = -G.ph * G.k0 * 0.5;
  for (const tag of el.tags) {
    const z = Number(tag.dataset.z);
    tag.classList.toggle('is-ppf', sw > 0.5);
    opacity(tag, tagsOn);
    if (tagsOn <= 0) continue;
    const [sx, sy] = project(edgeX, edgeY, z * gap, X, Y, rx, rz, S, G.persp);
    const x = Math.min(sx + 6, view.w - (tag._w || (tag._w = tag.offsetWidth || 150)) - 8);
    css(tag, 'transform', `translate3d(${f(x)}px,${f(sy - 9)}px,0)`);
  }
}

/** Projeta um ponto do espaço do "rig" na tela (mesma ordem e perspectiva do CSS). */
function project(px, py, pz, X, Y, rxDeg, rzDeg, S, d) {
  const rz = (rzDeg * Math.PI) / 180, rx = (rxDeg * Math.PI) / 180;
  let x = px * S, y = py * S, z = pz * S;
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  x += X; y += Y;
  const k = d / (d - z);
  return [view.cx + (x - view.cx) * k, view.cy + (y - view.cy) * k];
}

// ——— PPF: película que passa e porta que abre para o interior ———
function ppf(u) {
  const [c0, c1] = T.layers.collapse, [w0, w1] = T.ppf.sweep, [d0, d1] = T.ppf.door;
  const reduce = state.reduce;
  css(el.ppf, 'transform', zoomT('ppf', zoom.ppf(u)));
  css(el.sheet, 'transform', `translate3d(${f(lerp(-101, 0, inOut(span(u, w0, w1))))}%,0,0)`);
  const door = reduce ? 0 : inOut(span(u, d0, d1));
  css(el.door, 'transform', door > 0 ? `rotateY(${f(door * 96)}deg)` : 'none');
  opacity(el.shade, Math.sin(door * Math.PI / 2) * 0.92);
  layerOpacity(L.ppf, reduce ? 1 - smooth(span(u, d0, d1)) : 1 - smooth(span(u, d1 - 0.12, d1)));
  const live = pointer.at > state.now - 2500;
  const sx = live ? pointer.x : lerp(view.w * 0.15, view.w * 0.85, span(u, c1, d0));
  const sy = live ? pointer.y : view.h * 0.42;
  css(el.spec, 'transform', `translate3d(${f(sx)}px,${f(sy)}px,0)`);
  opacity(el.spec, env(u, [c1, c1 + 0.3, d0 - 0.1, d0 + 0.2]) * (live ? 1 : 0.7));
}

// ——— Higienização: a foto encolhe até virar o cartão da frente do anel ———
function interior(u) {
  const [d0] = T.ppf.door, [k0, k1] = T.interior.card;
  const reduce = state.reduce;
  const rect = zoomRect(P.interior, zoom.interior(u), view.cx, view.cy);
  const c = reduce ? 0 : inOut(span(u, k0, k1));
  const cr = G.cardRect, ic = G.interiorCard;
  const target = { x: lerp(rect.x, ic.x, c), y: lerp(rect.y, ic.y, c), w: lerp(rect.w, ic.w, c), h: lerp(rect.h, ic.h, c) };
  css(el.interior, 'transform', toRect(P.interior, target));
  const clip = c > 0 ? `inset(${f(c * cr.y)}px ${f(c * (view.w - cr.x - cr.w))}px ${f(c * (view.h - cr.y - cr.h))}px ${f(c * cr.x)}px round ${f(c * 14)}px)` : 'none';
  css(el.frame, 'clipPath', clip);
  css(el.frame, 'webkitClipPath', clip);
  if (reduce) layerOpacity(L.interior, 1 - smooth(span(u, k0, k1)));
}

// ——— Arco de serviços ———
const ringCtl = { offset: 0, vel: 0, target: null, drag: null, hover: -1, last: 0 };
const focusBase = u => lerp(4, 2, inOut(span(u, T.interior.card[1], T.contact.gather[1] + 0.25)));
function ringFocus(u) {
  const idle = state.reduce || ringCtl.target !== null || ringCtl.drag ? 0 : env(u, T.contact.copy) * smooth(clamp((state.now - ringCtl.last - 2400) / 1500));
  return focusBase(u) + ringCtl.offset + Math.sin(state.now / 1700) * 0.22 * idle;
}

export function focusCard(i) {
  ringCtl.target = i < 0 ? null : i - focusBase(state.u);
  ringCtl.last = state.now;
}

function ringPhysics(u, dt) {
  const s = dt / 1000;
  if (ringCtl.drag) return;
  const base = focusBase(u);
  let target = ringCtl.target;
  // Elástico nas pontas do arco.
  const focus = base + ringCtl.offset;
  if (target === null && (focus < -0.02 || focus > 4.02)) target = clamp(focus, 0, 4) - base;
  if (target === null && Math.abs(ringCtl.vel) < 0.05 && u > T.contact.gather[1] + 0.25) {
    // Ao soltar, assenta no cartão mais próximo.
    const snap = Math.round(clamp(focus, 0, 4)) - base;
    if (Math.abs(snap - ringCtl.offset) > 0.001 && state.now - ringCtl.last > 160) target = snap;
  }
  if (target !== null) {
    const diff = target - ringCtl.offset;
    ringCtl.vel = ringCtl.vel * Math.exp(-s * 10) + diff * s * 60;
    ringCtl.offset += ringCtl.vel * s;
    if (Math.abs(diff) < 0.002 && Math.abs(ringCtl.vel) < 0.01) { ringCtl.offset = target; ringCtl.vel = 0; }
  } else {
    ringCtl.vel *= Math.exp(-s * 4);
    ringCtl.offset += ringCtl.vel * s;
  }
}

function ringScene(u, dt) {
  const [g0, g1] = T.contact.gather, [fl0, fl1] = T.contact.flatten, k1 = T.interior.card[1];
  ringPhysics(u, dt);
  const reduce = state.reduce;
  const focus = ringFocus(u);
  const flat = reduce ? 0 : inOut(span(u, fl0, fl1));
  const { bandY } = placeGeometry();
  const cy = lerp(G.rcy, bandY, flat), cx = lerp(G.rcx, view.cx, flat);
  css(L.ring, 'perspectiveOrigin', `${f(cx)}px ${f(cy)}px`);
  const fade = reduce ? env(u, [k1 - 0.3, k1, fl0, fl1]) : 1 - smooth(span(u, fl1 - 0.2, fl1));
  el.cards.forEach((card, j) => {
    const phi = (j - focus) * G.step, rad = (phi * Math.PI) / 180;
    let x = G.R * Math.sin(rad), z = G.R * Math.cos(rad) - G.R, rot = phi;
    const order = Math.abs(j - 4);
    const g = j === 4 ? (u >= k1 - 0.002 ? 1 : 0) : out(span(u, g0 + order * 0.08, g0 + order * 0.08 + 0.5));
    if (!reduce) { z -= (1 - g) * 1400; x += (1 - g) * (j - 4) * 60; }
    const hover = ringCtl.hover === j && !reduce ? 28 : 0;
    z += hover * Math.max(0, Math.cos(rad));
    x = lerp(x, (j - 2) * G.cw * 1.06, flat);
    z = lerp(z, 0, flat);
    rot = lerp(rot, 0, flat);
    const sy = lerp(1, 0.012, flat);
    const visible = Math.abs(phi) < 98 || flat > 0.05;
    css(card, 'visibility', visible ? 'visible' : 'hidden');
    css(card, 'transform', `translate3d(${f(cx + x - G.cw / 2)}px,${f(cy - G.ch / 2)}px,${f(z)}px) rotateY(${f(rot)}deg) scale3d(1,${f(sy, 4)},1)`);
    opacity(card, (reduce ? 1 : g) * fade);
    let shade = card._shade;
    if (!shade) { shade = card._shade = document.createElement('i'); shade.className = 'shade'; card.append(shade); }
    opacity(shade, clamp(Math.abs(phi) / 80) * 0.55 * (1 - flat));
    card.classList.toggle('is-selected', state.selected === j);
  });
  const hint = env(u, T.contact.copy) * (1 - flat);
  opacity(el.ringHint, hint);
  if (hint > 0) css(el.ringHint, 'transform', `translate3d(${f(cx - (el.ringHint._w || (el.ringHint._w = el.ringHint.offsetWidth)) / 2)}px,${f(cy + G.ch / 2 + (view.mobile ? 18 : 30))}px,0)`);
}

function setupRing() {
  let start = null;
  const spacing = () => G.R * Math.sin((G.step * Math.PI) / 180);
  el.cards.forEach((card, j) => {
    card.style.touchAction = 'pan-y';
    card.addEventListener('pointerenter', () => { ringCtl.hover = j; });
    card.addEventListener('pointerleave', () => { if (ringCtl.hover === j) ringCtl.hover = -1; });
    card.addEventListener('pointerdown', e => {
      start = { x: e.clientX, offset: ringCtl.offset, id: e.pointerId, moved: false, t: performance.now(), lastX: e.clientX };
      ringCtl.drag = start;
      ringCtl.target = null;
      ringCtl.vel = 0;
      ringCtl.last = state.now;
      try { card.setPointerCapture(e.pointerId); } catch {}
    });
    card.addEventListener('pointermove', e => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      if (Math.abs(dx) > 6) start.moved = true;
      const now = performance.now();
      ringCtl.vel = (-(e.clientX - start.lastX) / spacing()) / (Math.max(8, now - start.t) / 1000);
      start.t = now; start.lastX = e.clientX;
      ringCtl.offset = start.offset - dx / spacing();
      ringCtl.last = state.now;
    });
    const end = e => {
      if (!start || e.pointerId !== start.id) return;
      const tapped = !start.moved;
      ringCtl.drag = null;
      ringCtl.last = state.now;
      start = null;
      if (tapped && e.type === 'pointerup') document.dispatchEvent(new CustomEvent('jetcar:select', { detail: j }));
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  });
}
setupRing();

// ——— Orquestração: cada camada liga um pouco antes, quase transparente, para o navegador
// já ter tudo pintado no quadro em que ela assume a tela (sem piscar). ———
function layerOpacity(layer, v) { layer._op = v; }
const WARM = 0.32;
function run(scene, layer, u, dt, from, to, warm = WARM) {
  const live = u >= from && u < to;
  const warming = !live && !state.reduce && warm > 0 && u >= from - warm && u < from;
  on(layer, live || warming);
  if (!live && !warming) return;
  layer._op = null;
  scene(u, dt);
  opacity(layer, warming ? 0.002 : layer._op ?? 1);
}

export function renderScenes(u, dt) {
  const reduce = state.reduce;
  state.light = 0;
  run(wash, L.wash, u, dt, T.brand.portal[1] - 0.004, T.wash.reveal[1] + 0.03);
  run(polish, L.polish, u, dt, T.wash.reveal[1] - 0.004, T.polish.end + 0.004);
  if (!reduce) run(hiveScene, L.hive, u, dt, T.polish.end - 0.004, T.hive.flip[1] + 0.004);
  else on(L.hive, false);
  run(ceramic, L.ceramic, u, dt, (reduce ? T.polish.end : T.hive.flip[1]) - 0.004, T.layers.tilt[0] + 0.004);
  run(stack, L.stack, u, dt, T.layers.tilt[0] - 0.004, T.layers.collapse[1] + 0.004);
  run(ppf, L.ppf, u, dt, T.layers.collapse[1] - 0.004, T.ppf.door[1] + 0.004);
  run(interior, L.interior, u, dt, T.ppf.door[0] - 0.004, T.interior.card[1] + 0.004);
  run(ringScene, L.ring, u, dt, T.contact.gather[0], T.contact.flatten[1] + 0.02, 0.2);
}

export { G as sceneGeometry };

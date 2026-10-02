// Cenas em DOM/CSS 3D dentro da moldura. Cada transição começa exatamente onde a anterior
// termina: o retângulo final de uma cena é o retângulo inicial da próxima.
import { $, $$, view, frame as F, state, pointer, clamp, lerp, span, smooth, inOut, out, env, css, on, opacity, f, zoomRect, toRect, cover, insetFor, lerpRect } from './core.js';
import { T, IMAGES, FRAME_META } from './timeline.js';
import { P, zoom } from './media.js';
import { hive, buildHive, cellFlip } from './hex.js';
import { placeGeometry, portalCircle, portalRadius } from './matte.js';

const frameEl = $('.frame');
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
  interior: $('img', L.interior),
  door: $('.door', L.ppf), ppf: $('.door img', L.ppf), sheet: $('.film-sheet', L.ppf), shade: $('.door-shade', L.ppf), spec: $('.spec', L.ppf),
  cards: $$('.card', L.ring), ringHint: $('.ring-hint', L.ring),
};
// Legenda da moldura (fica fora dela, como numa revista).
const ui = {
  root: $('.frame-cap'), name: $('.cap-name'), count: $('.cap-fig'), hint: $('.cap-hint span'),
  parts: $$('.cap-main, .cap-hint'),
};
const G = { guardMix: 0 }; // geometria calculada no resize
const touchQuery = matchMedia('(hover: none)');

const zoomT = (key, k) => toRect(P[key], zoomRect(P[key], k, F.cx, F.cy));

// ——— Layout ———
export function layoutScenes() {
  const m = view.mobile, pt = view.portrait;
  // Disco do polimento no centro da moldura.
  G.dcx = F.cx;
  G.dcy = F.cy;
  G.Rd = Math.min(F.w, F.h) * (m ? 0.34 : 0.31);
  css(el.sheen, 'left', `${f(G.dcx - G.Rd)}px`); css(el.sheen, 'top', `${f(G.dcy - G.Rd)}px`);
  css(el.sheen, 'width', `${f(G.Rd * 2)}px`); css(el.sheen, 'height', `${f(G.Rd * 2)}px`);
  css(el.disc, 'transformOrigin', `${f(G.dcx)}px ${f(G.dcy)}px`);
  G.orbitS = (G.Rd + (m ? 18 : 30)) / 0.44;
  css(el.orbit, 'width', `${f(G.orbitS)}px`); css(el.orbit, 'height', `${f(G.orbitS)}px`);

  buildCells();

  // Pilha de camadas: planos menores que a foto (economia de memória) ampliados por k0.
  const pc = P.ceramic, dpr = Math.min(window.devicePixelRatio || 1, 3);
  G.pw = Math.min(pc.w, (1536 / dpr) * 1.15);
  G.ph = (G.pw * pc.h) / pc.w;
  G.k0 = pc.w / G.pw;
  for (const plane of [el.base, el.photo, el.clear, el.guard]) {
    css(plane, 'width', `${f(G.pw)}px`); css(plane, 'height', `${f(G.ph)}px`);
    css(plane, 'left', `${f(-G.pw / 2)}px`); css(plane, 'top', `${f(-G.ph / 2)}px`);
  }
  G.stackX = F.x + F.w * (pt ? 0.4 : 0.42);
  G.stackY = F.cy + F.h * 0.03;
  G.cardScale = Math.min(F.w * (pt ? 0.56 : 0.5), F.h * 0.62) / pc.w;
  G.persp = Math.max(F.w, F.h) * (m ? 2.4 : 2.1);
  css(L.stack, 'perspective', `${f(G.persp)}px`);
  css(L.stack, 'perspectiveOrigin', `${f(F.cx)}px ${f(F.cy)}px`);
  for (const tag of el.tags) tag._w = 0;

  // Porta do PPF do tamanho da moldura, com dobradiça à esquerda.
  css(el.door, 'left', `${f(F.x)}px`); css(el.door, 'top', `${f(F.y)}px`);
  css(el.door, 'width', `${f(F.w)}px`); css(el.door, 'height', `${f(F.h)}px`);
  css(L.ppf, 'perspective', `${f(Math.max(F.w, F.h) * 2.2)}px`);
  css(L.ppf, 'perspectiveOrigin', `${f(F.cx)}px ${f(F.cy)}px`);

  // Arco de serviços (cilindro visto de fora; o cartão em foco fica de frente).
  // O arco ocupa o lugar da moldura: a foto do interior encolhe até o cartão da frente.
  G.rcx = F.cx;
  G.rcy = F.cy;
  G.cw = pt ? Math.min(view.w * (m ? 0.4 : 0.28), F.h * 0.6) : Math.min(clamp(view.w * 0.145, 160, 270), view.svh * 0.33, F.w / 3.4, F.h * 0.5);
  G.ch = G.cw * 1.32;
  G.step = pt ? 30 : 32;
  G.R = G.cw * 1.9;
  G.ringPersp = m ? 900 : 1300;
  css(L.ring, 'perspective', `${G.ringPersp}px`);
  css(L.ring, 'perspectiveOrigin', `${f(G.rcx)}px ${f(G.rcy)}px`);
  el.cards.forEach((card, i) => {
    css(card, 'width', `${f(G.cw)}px`); css(card, 'height', `${f(G.ch)}px`);
    const img = $('img', card), meta = IMAGES[['wash', 'polish', 'ceramic', 'ppf', 'interior'][i]];
    const r = cover(meta.w, meta.h, G.cw, G.ch, meta.fx, meta.fy);
    css(img, 'width', `${f(r.w)}px`); css(img, 'height', `${f(r.h)}px`); css(img, 'left', `${f(r.x)}px`); css(img, 'top', `${f(r.y)}px`);
  });
  G.cardRect = { x: G.rcx - G.cw / 2, y: G.rcy - G.ch / 2, w: G.cw, h: G.ch };
  // Borda de papel do cartão (proporcional ao tamanho) e a área da foto dentro dela.
  G.edge = Math.round(clamp(G.cw * 0.035, 5, 8));
  G.edgeB = Math.round(clamp(G.cw * 0.17, 26, 40));
  css(L.ring, '--card-edge', `${G.edge}px`);
  css(L.ring, '--card-edge-b', `${G.edgeB}px`);
  css(L.ring, '--card-font', `${f(clamp(G.cw * 0.075, 11, 16), 1)}px`);
  G.cardPhoto = { x: G.cardRect.x + G.edge, y: G.cardRect.y + G.edge, w: G.cw - G.edge * 2, h: G.ch - G.edge - G.edgeB };
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
    node.style.width = `${f(2 * r)}px`;
    node.style.height = `${f(2 * a)}px`;
    const x0 = c.x - r, y0 = c.y - a;
    const front = document.createElement('i');
    front.className = 'front';
    if (c.d < G.Rd + r) {
      front.style.backgroundImage = `radial-gradient(circle ${f(G.Rd)}px at ${f(G.dcx - x0)}px ${f(G.dcy - y0)}px, transparent ${f(G.Rd - 0.6)}px, #0c0c0e ${f(G.Rd)}px), url(${IMAGES.polish.src})`;
      front.style.backgroundSize = `auto, ${f(pp.w)}px ${f(pp.h)}px`;
      front.style.backgroundPosition = `0 0, ${f(pp.x - x0)}px ${f(pp.y - y0)}px`;
    } else front.style.background = '#0c0c0e';
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

// ——— Moldura: farol → círculo → cartão dos serviços → cartão do arco ———
function frameState(u) {
  const [p0, p1] = T.frame.preview, [d0, d1] = T.brand.portal, [m0, m1] = T.frame.morph, [k0, k1] = T.interior.card;
  if (state.reduce) {
    // Sem mergulho: a moldura surge por dissolução, já no lugar, e some no arco.
    const a = smooth(span(u, d0, m1)) * (1 - smooth(span(u, k0, k1)));
    return { rect: F, radius: F.r, alpha: a };
  }
  if (u < d1) {
    const c = portalCircle(u);
    return { rect: { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 }, radius: c.r, alpha: smooth(span(u, p0, p1)) };
  }
  if (u < m1) {
    const t = inOut(span(u, m0, m1)), r0 = portalRadius();
    const square = { x: F.cx - r0, y: F.cy - r0, w: r0 * 2, h: r0 * 2 };
    return { rect: lerpRect(square, F, t), radius: lerp(r0, F.r, t), alpha: 1 };
  }
  if (u < k0) return { rect: F, radius: F.r, alpha: 1 };
  const c = inOut(span(u, k0, k1));
  return { rect: lerpRect(F, G.cardPhoto, c), radius: lerp(F.r, 1, c), alpha: 1 };
}

function frameScene(u) {
  const live = !state.covered && u >= T.frame.preview[0] - 0.35 && u < T.interior.card[1] + 0.004;
  css(frameEl, 'visibility', live ? 'visible' : 'hidden');
  if (!live) return;
  const s = frameState(u);
  const clip = insetFor(s.rect, s.radius);
  css(frameEl, 'clipPath', clip);
  css(frameEl, 'webkitClipPath', clip);
  opacity(frameEl, u < T.frame.preview[0] ? 0.002 : s.alpha);
}

// ——— Lavagem ———
function wash(u) {
  css(el.wash, 'transform', zoomT('wash', zoom.wash(u)));
}

// ——— Polimento: imagem → disco que gira → colmeia ———
function rotZoom(r, k, deg, px, py) {
  // Escala k em torno do centro da moldura e rotação em torno do centro do disco (px, py).
  const a = (deg * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
  const qx = F.cx + k * (r.x - F.cx) - px, qy = F.cy + k * (r.y - F.cy) - py;
  const tx = px + cs * qx - sn * qy - r.x, ty = py + sn * qx + cs * qy - r.y;
  return `matrix(${f(k * cs, 5)},${f(k * sn, 5)},${f(-k * sn, 5)},${f(k * cs, 5)},${f(tx)},${f(ty)})`;
}

function polish(u) {
  const [d0, d1] = T.polish.disc, end = T.polish.end;
  const reduce = state.reduce;
  const k = zoom.polish(u);
  const d = reduce ? 0 : inOut(span(u, d0, d1));
  const R = G.Rd;
  const circle = { x: G.dcx - R, y: G.dcy - R, w: R * 2, h: R * 2 };
  const clip = insetFor(lerpRect(F, circle, d), lerp(F.r, R, d));
  css(el.disc, 'clipPath', clip);
  css(el.disc, 'webkitClipPath', clip);
  const turn = reduce ? 0 : 360 * inOut(span(u, d0, end));
  css(el.discImg, 'transform', rotZoom(P.polish, k, turn, G.dcx, G.dcy));
  css(el.polishSoft, 'transform', zoomT('polish', k));
  const hold = reduce ? 0 : env(u, [d0 + 0.3, d1 + 0.1, end - 0.42, end - 0.12]);
  opacity(el.dim, Math.max(d * 0.6, smooth(span(u, end - 0.4, end - 0.05))));
  // Inclinação 3D seguindo o ponteiro e reflexo que gira com ele.
  const tilt = hold * 9;
  css(el.disc, 'transform', tilt > 0.01 ? `perspective(1300px) rotateX(${f(-pointer.sy * tilt)}deg) rotateY(${f(pointer.sx * tilt)}deg)` : 'none');
  const ang = Math.atan2(pointer.y - G.dcy, pointer.x - G.dcx) * 57.3;
  css(el.sheen, 'transform', `rotate(${f((pointer.at > 0 ? ang : u * 120) + 90)}deg)`);
  opacity(el.sheen, hold * 0.9);
  const orb = env(u, [d1 - 0.25, d1 + 0.1, end - 0.42, end - 0.16]);
  opacity(el.orbit, orb);
  if (orb > 0) css(el.orbit, 'transform', `translate3d(${f(G.dcx - G.orbitS / 2)}px,${f(G.dcy - G.orbitS / 2)}px,0) rotate(${f(-u * 55 - pointer.sx * 8)}deg) scale(${f(lerp(0.92, 1, orb), 3)})`);
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
    opacity(c.shade, Math.sin((deg * Math.PI) / 180) * 0.6);
  }
}

function ceramic(u) {
  const reduce = state.reduce;
  if (reduce) layerOpacity(L.ceramic, smooth(span(u, T.polish.end, T.polish.end + 0.5)));
  css(el.ceramic, 'transform', zoomT('ceramic', zoom.ceramic(u)));
}

// ——— Camadas: a foto deita num estúdio claro, se separa em camadas e gira ———
function stack(u, dt) {
  const [t0, t1] = T.layers.tilt, [e0, e1] = T.layers.explode, [s0, s1] = T.layers.swap, [c0, c1] = T.layers.collapse;
  const reduce = state.reduce;
  const tilt = reduce ? 1 : inOut(span(u, t0, t1));
  const col = reduce ? 0 : inOut(span(u, c0, c1));
  const ex = reduce ? 1 : inOut(span(u, e0, e1)) * (1 - inOut(span(u, c0, c0 + 0.5)));
  const holdP = env(u, [e0, e1, c0 - 0.2, c0 + 0.1]) * (reduce ? 0 : 1);
  const light = smooth(span(u, t0 + 0.1, t1)) * (1 - smooth(span(u, c0, c0 + 0.42)));
  // Estúdio claro, um tom acima do papel da página.
  css(L.stack, 'backgroundColor', `rgb(${Math.round(lerp(12, 247, light))},${Math.round(lerp(12, 246, light))},${Math.round(lerp(13, 242, light))})`);
  if (reduce) layerOpacity(L.stack, env(u, [t0, t0 + 0.4, c1 - 0.4, c1]));

  const kC = zoom.ceramic(t0), rc = zoomRect(P.ceramic, kC, F.cx, F.cy), rp = P.ppf;
  const startX = rc.x + rc.w / 2, startY = rc.y + rc.h / 2, endX = rp.x + rp.w / 2, endY = rp.y + rp.h / 2;
  const S = lerp(lerp(kC, G.cardScale, tilt), 1, col);
  const X = lerp(lerp(startX, G.stackX, tilt), endX, col), Y = lerp(lerp(startY, G.stackY, tilt), endY, col);
  const spin = 40 * inOut(span(u, e0, c0));
  const rz = lerp(lerp(0, -32 + spin + pointer.sx * 14 * holdP, tilt), 0, col);
  const rx = lerp(lerp(0, 54 - pointer.sy * 8 * holdP, tilt), 0, col);
  css(el.rig, 'transform', `translate3d(${f(X)}px,${f(Y)}px,0) rotateX(${f(rx)}deg) rotateZ(${f(rz)}deg) scale3d(${f(S, 4)},${f(S, 4)},${f(S, 4)})`);

  const gap = G.ph * G.k0 * 0.32 * ex;
  const others = (reduce ? 1 : smooth(span(u, t0 + 0.25, e0 + 0.3))) * (1 - (reduce ? 0 : smooth(span(u, c0 + 0.02, c0 + 0.42))));
  for (const [p, z] of [[el.base, -1], [el.photo, 0], [el.clear, 1], [el.guard, 2]]) {
    css(p, 'transform', `translate3d(0,0,${f(z * gap)}px) scale(${f(G.k0, 4)})`);
    if (p !== el.photo) opacity(p, others);
  }

  // Ceramic Coating ⇄ PPF: segue a rolagem, ou a escolha feita no controle ao lado.
  const auto = smooth(span(u, s0, s1));
  const want = state.guard ?? auto;
  if (reduce) G.guardMix = want;
  else {
    G.guardMix += (want - G.guardMix) * (1 - Math.exp(-dt / 150));
    if (Math.abs(want - G.guardMix) < 0.002) G.guardMix = want;
    else state.busy = true;
  }
  const sw = G.guardMix;
  state.guardShown = want > 0.5 ? 1 : 0;
  opacity(el.photoPpf, sw);
  opacity(el.guardCeramic, 1 - sw);
  opacity(el.guardFilm, sw);
  opacity(el.flap, sw);
  css(el.flap, 'transform', `rotate3d(1,1,0,${f(-150 * out(clamp((sw - 0.1) / 0.9)))}deg)`);

  const tagsOn = (reduce ? 1 : smooth(span(u, e0 + 0.3, e1 + 0.05))) * (1 - (reduce ? 0 : smooth(span(u, c0 - 0.05, c0 + 0.2))));
  // Rótulos em 2D, presos ao canto mais à direita de cada camada (mesma projeção do CSS 3D).
  const hw = (G.pw * G.k0) / 2, hh = (G.ph * G.k0) / 2;
  let lastY = -1e9;
  const placed = el.tags.map(tag => {
    const z = Number(tag.dataset.z) * gap;
    let best = null;
    for (const [cx, cy] of [[hw, -hh], [hw, hh], [-hw, -hh], [-hw, hh]]) {
      const p = project(cx, cy, z, X, Y, rx, rz, S);
      if (!best || p[0] > best[0]) best = p;
    }
    return { tag, x: best[0], y: best[1] };
  }).sort((a, b) => a.y - b.y);
  const top = F.y + (view.mobile ? 48 : 60), bottom = F.y + F.h - (view.mobile ? 40 : 52);
  for (const p of placed) {
    const { tag } = p;
    tag.classList.toggle('is-ppf', sw > 0.5);
    opacity(tag, tagsOn);
    if (tagsOn <= 0) continue;
    const y = clamp(Math.max(p.y, lastY + (view.mobile ? 26 : 36)), top, bottom);
    lastY = y;
    const w = tag._w || (tag._w = tag.offsetWidth || 150);
    const x = Math.min(p.x + 6, F.x + F.w - w - (view.mobile ? 10 : 18));
    css(tag, 'transform', `translate3d(${f(x)}px,${f(y - 9)}px,0)`);
  }
}

/** Projeta um ponto do espaço do "rig" na tela (mesma ordem e perspectiva do CSS). */
function project(px, py, pz, X, Y, rxDeg, rzDeg, S) {
  const rz = (rzDeg * Math.PI) / 180, rx = (rxDeg * Math.PI) / 180;
  let x = px * S, y = py * S, z = pz * S;
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  x += X; y += Y;
  const k = G.persp / (G.persp - z);
  return [F.cx + (x - F.cx) * k, F.cy + (y - F.cy) * k];
}

// ——— PPF: a película passa e a porta abre para o interior ———
function ppf(u) {
  const [, c1] = T.layers.collapse, [w0, w1] = T.ppf.sweep, [d0, d1] = T.ppf.door;
  const reduce = state.reduce;
  css(el.ppf, 'transform', toRect(P.ppf, zoomRect(P.ppf, zoom.ppf(u), F.cx, F.cy)));
  css(el.sheet, 'transform', `translate3d(${f(lerp(-101, 0, inOut(span(u, w0, w1))))}%,0,0)`);
  const door = reduce ? 0 : inOut(span(u, d0, d1));
  css(el.door, 'transform', door > 0 ? `rotateY(${f(door * 96)}deg)` : 'none');
  opacity(el.shade, Math.sin((door * Math.PI) / 2) * 0.9);
  layerOpacity(L.ppf, reduce ? 1 - smooth(span(u, d0, d1)) : 1 - smooth(span(u, d1 - 0.12, d1)));
  const live = pointer.at > state.now - 2500 && pointer.x > F.x && pointer.x < F.x + F.w;
  const sx = live ? pointer.x : F.x + F.w * lerp(0.12, 0.88, span(u, c1, d0));
  const sy = live ? pointer.y : F.y + F.h * 0.42;
  css(el.spec, 'transform', `translate3d(${f(sx)}px,${f(sy)}px,0)`);
  opacity(el.spec, env(u, [c1, c1 + 0.3, d0 - 0.1, d0 + 0.2]) * (live ? 1 : 0.7));
}

// ——— Higienização: a foto encolhe até virar o cartão da frente do arco ———
function interior(u) {
  const [k0, k1] = T.interior.card;
  const reduce = state.reduce;
  const rect = zoomRect(P.interior, zoom.interior(u), F.cx, F.cy);
  const c = reduce ? 0 : inOut(span(u, k0, k1));
  css(el.interior, 'transform', toRect(P.interior, lerpRect(rect, G.interiorCard, c)));
  if (reduce) layerOpacity(L.interior, 1 - smooth(span(u, k0, k1)));
}

// ——— Arco de serviços ———
const ringCtl = { offset: 0, vel: 0, target: null, drag: null, hover: -1, last: 0 };
const focusBase = u => lerp(4, 2, inOut(span(u, T.interior.card[1], T.contact.gather[1] + 0.25)));
function ringFocus(u) {
  const idle = state.reduce || ringCtl.target !== null || ringCtl.drag ? 0 : env(u, T.contact.hint) * smooth(clamp((state.now - ringCtl.last - 2400) / 1500));
  if (idle > 0) state.busy = true;
  return focusBase(u) + ringCtl.offset + Math.sin(state.now / 1700) * 0.2 * idle;
}

export function focusCard(i) {
  ringCtl.target = i < 0 ? null : i - focusBase(state.u);
  ringCtl.last = state.now;
}

function ringPhysics(u, dt) {
  const s = dt / 1000;
  if (ringCtl.drag) { state.busy = true; return; }
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
    else state.busy = true;
  } else if (Math.abs(ringCtl.vel) > 0.001) {
    ringCtl.vel *= Math.exp(-s * 4);
    ringCtl.offset += ringCtl.vel * s;
    state.busy = true;
  }
}

function ringScene(u, dt) {
  const [g0] = T.contact.gather, [fl0, fl1] = T.contact.flatten, k1 = T.interior.card[1];
  ringPhysics(u, dt);
  const reduce = state.reduce;
  const focus = ringFocus(u);
  const flat = reduce ? 0 : inOut(span(u, fl0, fl1));
  const { bandY } = placeGeometry();
  const cy = lerp(G.rcy, bandY, flat), cx = lerp(G.rcx, view.cx, flat);
  css(L.ring, 'perspectiveOrigin', `${f(cx)}px ${f(cy)}px`);
  const fade = reduce ? env(u, [k1 - 0.3, k1, fl0, fl1]) : 1 - smooth(span(u, fl1 - 0.2, fl1));
  const rowGap = Math.min(G.cw * 1.06, (view.w - 24) / 5);
  el.cards.forEach((card, j) => {
    const phi = (j - focus) * G.step, rad = (phi * Math.PI) / 180;
    let x = G.R * Math.sin(rad), z = G.R * Math.cos(rad) - G.R, rot = phi;
    const order = Math.abs(j - 4);
    const g = j === 4 ? (u >= k1 - 0.002 ? 1 : 0) : out(span(u, g0 + order * 0.08, g0 + order * 0.08 + 0.5));
    if (!reduce) { z -= (1 - g) * 1200; x += (1 - g) * (j - 4) * 50; }
    const hover = ringCtl.hover === j && !reduce ? 26 : 0;
    z += hover * Math.max(0, Math.cos(rad));
    x = lerp(x, (j - 2) * rowGap, flat);
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
    // O cartão do interior chega sem borda (é a própria foto encolhendo) e ganha a borda de papel.
    css(card, '--edge', j === 4 && !reduce ? f(smooth(span(u, k1, k1 + 0.16)), 3).toString() : '1');
  });
  const hint = env(u, T.contact.hint) * (1 - flat);
  opacity(el.ringHint, hint);
  if (hint > 0) css(el.ringHint, 'transform', `translate3d(${f(cx - (el.ringHint._w || (el.ringHint._w = el.ringHint.offsetWidth)) / 2)}px,${f(cy + G.ch / 2 + (view.mobile ? 16 : 26))}px,0)`);
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

// ——— Legenda da moldura ———
let metaIndex = -1, swapTimer = 0;
function applyMeta(i) {
  const m = FRAME_META[i];
  ui.name.textContent = m.name;
  ui.count.textContent = m.count;
  ui.hint.textContent = m.hint[touchQuery.matches ? 1 : 0];
  for (const c of ui.parts) c.classList.remove('is-swap');
}
function frameUi(u) {
  const show = !state.covered && u > T.frame.morph[1] - 0.12 && u < T.interior.card[0] - 0.04;
  on(ui.root, show);
  let i = 0;
  for (let k = 0; k < FRAME_META.length; k++) if (u >= FRAME_META[k].from) i = k;
  if (i === metaIndex) return;
  const first = metaIndex < 0;
  metaIndex = i;
  clearTimeout(swapTimer);
  if (first || !show) { applyMeta(i); return; }
  for (const c of ui.parts) c.classList.add('is-swap');
  swapTimer = setTimeout(() => applyMeta(metaIndex), 240);
}
touchQuery.addEventListener?.('change', () => { if (metaIndex >= 0) applyMeta(metaIndex); });

// ——— Orquestração: cada camada liga um pouco antes, quase transparente, para o navegador
// já ter tudo pintado no quadro em que ela assume a moldura (sem piscar). ———
function layerOpacity(layer, v) { layer._op = v; }
const WARM = 0.32;
function run(scene, layer, u, dt, from, to, warm = WARM) {
  const live = !state.covered && u >= from && u < to;
  const warming = !state.covered && !live && !state.reduce && warm > 0 && u >= from - warm && u < from;
  on(layer, live || warming);
  if (!live && !warming) return;
  layer._op = null;
  scene(u, dt);
  opacity(layer, warming ? 0.002 : layer._op ?? 1);
}

export function renderScenes(u, dt) {
  const reduce = state.reduce;
  frameScene(u);
  run(wash, L.wash, u, dt, T.frame.preview[0], T.wash.reveal[1] + 0.03);
  run(polish, L.polish, u, dt, T.wash.reveal[1] - 0.004, T.polish.end + 0.004);
  if (!reduce) run(hiveScene, L.hive, u, dt, T.polish.end - 0.004, T.hive.flip[1] + 0.004);
  else on(L.hive, false);
  run(ceramic, L.ceramic, u, dt, (reduce ? T.polish.end : T.hive.flip[1]) - 0.004, T.layers.tilt[0] + 0.004);
  run(stack, L.stack, u, dt, T.layers.tilt[0] - 0.004, T.layers.collapse[1] + 0.004);
  run(ppf, L.ppf, u, dt, T.layers.collapse[1] - 0.004, T.ppf.door[1] + 0.004);
  run(interior, L.interior, u, dt, T.ppf.door[0] - 0.004, T.interior.card[1] + 0.004);
  run(ringScene, L.ring, u, dt, T.contact.gather[0], T.contact.flatten[1] + 0.02, 0.2);
  frameUi(u);
}

export { G as sceneGeometry };

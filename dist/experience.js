// JETCAR — site com transições contínuas guiadas pela rolagem.
// O conteúdo rola de forma nativa; o palco (filme, logo e moldura dos serviços) fica preso
// atrás dele e acompanha a rolagem com uma suavização leve. O filme toca sozinho.
import { $, $$, view, frame, pointer, state, clamp } from './js/core.js';
import { BLOCKS, S, T, buildTimeline } from './js/timeline.js';
import { layoutFrame, placeImages, setupFilm, updateFilm, IMG, video } from './js/media.js';
import { resizeMatte, renderMatte } from './js/matte.js';
import { layoutScenes, renderScenes } from './js/scenes.js';
import { resizeFx, renderFx } from './js/fx.js';
import { setupReveals, revealWithin } from './js/reveal.js';
import { renderUi, bindJump, setReduce, savedMotion, ready, cancelFreeze, setMenu } from './js/ui.js';

const journey = $('.journey'), stage = $('.stage'), flow = $('.flow'), sheet = $('.sheet'), navEl = $('.nav');
const blocks = BLOCKS.map(b => ({ ...b, el: $(`[data-blk="${b.id}"]`) }));
const unitProbe = $('.unit-probe'), svhProbe = $('.svh-probe');
const portraitQuery = matchMedia('(max-aspect-ratio: 9/10)'), mobileQuery = matchMedia('(max-width: 760px)');
const curtain = Object.assign(document.createElement('div'), { className: 'curtain' });
curtain.setAttribute('aria-hidden', 'true');
for (let i = 0; i < 9; i++) curtain.append(document.createElement('i'));
document.body.append(curtain);

let lastW = 0, lastH = 0, lastSvh = 0, forceRender = true;

/** Mede onde cada bloco começa e recalcula a linha do tempo. */
function measure() {
  const y = window.scrollY;
  const top = journey.getBoundingClientRect().top + y;
  const at = el => (el.getBoundingClientRect().top + y - top) / view.unit;
  const starts = {};
  for (const b of blocks) starts[b.id] = at(b.el);
  const lastRect = blocks[blocks.length - 1].el.getBoundingClientRect();
  view.jTop = top;
  view.scrollMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  buildTimeline(starts, (lastRect.bottom + y - top) / view.unit, at(sheet));
}

/** Textos mais altos que a tela rolam normalmente (não ficam presos com partes cortadas). */
function fitPins() {
  for (const b of blocks) {
    const txt = b.el.querySelector('.pin > .txt');
    if (!txt) continue;
    b.el.classList.toggle('pin-flow', txt.offsetHeight > view.svh - view.nav - 20);
  }
}

// Revela de uma vez o conteúdo de cada bloco que já chegou ao lugar (cartões presos na
// borda de baixo da tela podem nunca cruzar a margem do observador).
let revealedUpTo = -1;
function revealBlocks(u) {
  for (let i = revealedUpTo + 1; i < blocks.length; i++) {
    if (u < S[blocks[i].id] - 0.02) break;
    revealWithin(blocks[i].el);
    revealedUpTo = i;
  }
}

function resize(force = false) {
  const w = stage.clientWidth || document.documentElement.clientWidth;
  const h = stage.clientHeight || window.innerHeight;
  const svh = svhProbe.offsetHeight || window.innerHeight;
  // A barra do Safari aparecendo/sumindo não muda o palco: só remede a rolagem.
  if (!force && w === lastW && h === lastH && svh === lastSvh) { measure(); onScroll(); return; }
  lastW = w; lastH = h; lastSvh = svh;
  Object.assign(view, {
    w, h, svh, cx: w / 2, cy: h / 2, diag: Math.hypot(w, h), dpr: Math.min(window.devicePixelRatio || 1, 2),
    // Mesmas condições do CSS: celular (≤760px), tela em pé (≤ 9/10) e tela baixa.
    mobile: mobileQuery.matches, portrait: portraitQuery.matches, short: svh < 700,
    unit: unitProbe.offsetHeight || svh * 0.85, nav: navEl.offsetHeight || 72,
  });
  for (const b of blocks) {
    const units = (view.portrait && b.portraitUnits) || b.units;
    if (units) b.el.style.minHeight = `${Math.round(units * view.unit)}px`;
  }
  fitPins();
  measure();
  layoutFrame();
  placeImages();
  resizeMatte();
  layoutScenes();
  resizeFx();
  setupFilm();
  onScroll();
  forceRender = true;
}

function onScroll() {
  if (state.frozenY != null) return;
  state.target = clamp((window.scrollY - (view.jTop || 0)) / view.unit, 0, T.sheet + 1);
}

// ——— Navegação interna: rolagem suave por perto; para longe, uma cortina rápida ———
function jump(target, { focus } = {}) {
  cancelFreeze();
  setMenu(false);
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  const top = el.id === 'inicio' ? 0 : Math.round(el.getBoundingClientRect().top + window.scrollY);
  const u = (top - view.jTop) / view.unit;
  const settle = () => {
    revealWithin(el);
    const f = focus || el;
    if (!f.matches('a, button, input, select, textarea, [tabindex]')) f.setAttribute('tabindex', '-1');
    f.focus({ preventScroll: true });
  };
  const far = Math.abs(u - state.u) > 3.2;
  if (state.reduce || !far) {
    window.scrollTo({ top, behavior: state.reduce ? 'auto' : 'smooth' });
    setTimeout(settle, state.reduce ? 0 : 700);
    return;
  }
  // Saltos longos: a cortina cobre a tela em vez de atravessar todas as cenas.
  curtain.classList.remove('is-out');
  curtain.classList.add('is-on');
  setTimeout(() => {
    window.scrollTo({ top, behavior: 'auto' });
    onScroll();
    state.u = state.target;
    forceRender = true;
    settle();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      curtain.classList.add('is-out');
      setTimeout(() => {
        curtain.classList.add('no-anim');
        curtain.classList.remove('is-on', 'is-out');
        requestAnimationFrame(() => curtain.classList.remove('no-anim'));
      }, 420);
    }));
  }, 340);
}
bindJump(jump);

for (const a of $$('a[href^="#"]')) a.addEventListener('click', e => {
  const id = a.getAttribute('href').slice(1);
  const target = id && document.getElementById(id);
  if (!target) return;
  e.preventDefault();
  jump(target, { focus: a.classList.contains('skip') ? $('#service-select') : null });
  if (history.replaceState) history.replaceState(null, '', id === 'inicio' ? location.pathname + location.search : `#${id}`);
});

// ——— Ponteiro e toque (sem bloquear a rolagem) ———
let lastTouch = null;
function setPointer(x, y, touch) {
  pointer.x = x; pointer.y = y; pointer.touch = touch;
  pointer.nx = clamp((x / view.w) * 2 - 1, -1, 1);
  pointer.ny = clamp((y / view.h) * 2 - 1, -1, 1);
  pointer.at = state.now;
}
addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  if (pointer.at > 0) pointer.strokes.push([pointer.x, pointer.y, e.clientX, e.clientY]);
  setPointer(e.clientX, e.clientY, false);
}, { passive: true });
addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') return;
  setPointer(e.clientX, e.clientY, false);
  pointer.taps.push({ x: e.clientX, y: e.clientY });
}, { passive: true });
addEventListener('touchstart', e => {
  const t = e.touches[0];
  if (!t) return;
  setPointer(t.clientX, t.clientY, true);
  pointer.taps.push({ x: t.clientX, y: t.clientY });
  lastTouch = { x: t.clientX, y: t.clientY };
}, { passive: true });
addEventListener('touchmove', e => {
  const t = e.touches[0];
  if (!t) return;
  if (lastTouch) pointer.strokes.push([lastTouch.x, lastTouch.y, t.clientX, t.clientY]);
  lastTouch = { x: t.clientX, y: t.clientY };
  setPointer(t.clientX, t.clientY, true);
}, { passive: true });
addEventListener('touchend', () => { lastTouch = null; }, { passive: true });

// ——— Quadro a quadro ———
let last = performance.now();
let lastU = -1, lastSX = 0, lastSY = 0;
function tick(now) {
  const dt = Math.min(64, now - last || 16);
  last = now;
  state.now = now;
  state.dt = dt;
  const prev = state.u;
  if (state.reduce) state.u = state.target;
  else {
    state.u += (state.target - state.u) * (1 - Math.exp(-dt / 60));
    if (Math.abs(state.target - state.u) < 0.0004) state.u = state.target;
  }
  state.vel = state.vel * 0.82 + ((state.u - prev) / dt) * 1000 * 0.18;
  const ease = 1 - Math.exp(-dt / 170);
  pointer.sx += (pointer.nx - pointer.sx) * ease;
  pointer.sy += (pointer.ny - pointer.sy) * ease;
  const u = state.u;
  // Quando a seção de dúvidas cobre a tela, o palco para de trabalhar.
  const covered = state.target >= T.sheet - 0.002 && u >= T.sheet - 0.01;
  if (covered !== state.covered) {
    state.covered = covered;
    stage.style.visibility = covered ? 'hidden' : '';
    forceRender = true;
  }
  const changed = forceRender || state.busy || u !== lastU || Math.abs(pointer.sx - lastSX) > 0.0005 || Math.abs(pointer.sy - lastSY) > 0.0005 || Math.abs(state.vel) > 0.01;
  state.busy = false;
  if (changed) {
    forceRender = false;
    lastU = u; lastSX = pointer.sx; lastSY = pointer.sy;
    updateFilm(u);
    if (!covered) {
      renderMatte(u);
      renderScenes(u, dt);
    }
  }
  if (!covered) renderFx(u, dt);
  else { pointer.taps.length = 0; pointer.strokes.length = 0; }
  renderUi(u);
  revealBlocks(state.target);
  requestAnimationFrame(tick);
}

// ——— Início ———
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
const saved = savedMotion();
setReduce(saved ? saved === 'reduce' : reduceQuery.matches);
reduceQuery.addEventListener?.('change', e => { if (!savedMotion()) { setReduce(e.matches); forceRender = true; } });
$('.motion').addEventListener('click', () => { forceRender = true; });

setupReveals();
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
resize(true);
addEventListener('resize', () => resize());
addEventListener('orientationchange', () => setTimeout(() => resize(true), 250));
addEventListener('scroll', onScroll, { passive: true });
if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); onScroll(); forceRender = true; }).observe(flow);

const hashTarget = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
window.scrollTo(0, hashTarget && hashTarget.id !== 'inicio' ? Math.round(hashTarget.getBoundingClientRect().top + window.scrollY) : 0);
onScroll();
state.u = state.target;

const firstFrame = new Promise(resolve => {
  if (video.readyState >= 2) resolve();
  video.addEventListener('loadeddata', resolve, { once: true });
  video.addEventListener('error', resolve, { once: true });
});
Promise.race([
  Promise.all([document.fonts?.ready ?? Promise.resolve(), IMG.wash.ready, firstFrame]),
  new Promise(r => setTimeout(r, 2800)),
]).then(() => { forceRender = true; ready(); });
// Fontes carregadas mudam a altura dos textos: remede tudo uma vez.
document.fonts?.ready.then(() => resize(true));

// Gancho de depuração para QA visual (?debug na URL).
if (/[?&]debug\b/.test(location.search)) window.__jetcar = { state, view, frame, T, S, pointer, settle: () => { state.u = state.target; forceRender = true; } };

requestAnimationFrame(tick);

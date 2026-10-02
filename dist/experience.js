// JETCAR — experiência contínua guiada pela rolagem.
// A rolagem nativa define o alvo; os visuais seguem com suavização. O filme toca sozinho.
import { $, view, pointer, state, clamp } from './js/core.js';
import { T, CHAPTERS } from './js/timeline.js';
import { placeImages, setupFilm, updateFilm, IMG, video } from './js/media.js';
import { resizeMatte, renderMatte } from './js/matte.js';
import { layoutScenes, renderScenes } from './js/scenes.js';
import { resizeFx, renderFx } from './js/fx.js';
import { renderCopy, layoutCopy, bindFocus } from './js/copy.js';
import { renderHud, bindJump, jumpToAct, setReduce, ready, cancelFreeze } from './js/ui.js';

const lvhProbe = Object.assign(document.createElement('i'), { className: 'lvh-probe' });
document.body.append(lvhProbe);
const unitProbe = $('.unit-probe');
const curtain = Object.assign(document.createElement('div'), { className: 'curtain' });
curtain.setAttribute('aria-hidden', 'true');
for (let i = 0; i < 9; i++) curtain.append(document.createElement('i'));
$('.overlay').append(curtain);

let lastW = 0, lastH = 0, forceRender = true;
function resize(force = false) {
  const w = window.innerWidth;
  const h = Math.max(lvhProbe.offsetHeight || 0, window.innerHeight);
  view.unit = unitProbe.offsetHeight || h * 0.88;
  // A barra do Safari aparecendo/sumindo muda só a altura visível: não refaz o palco.
  if (!force && w === lastW && Math.abs(h - lastH) < 160) { onScroll(); return; }
  lastW = w; lastH = h;
  // mobile: tamanhos de celular; portrait: composição vertical (celular e tablet em pé); short: telas baixas.
  Object.assign(view, { w, h, cx: w / 2, cy: h / 2, diag: Math.hypot(w, h), dpr: Math.min(window.devicePixelRatio || 1, 2), mobile: w < 761, portrait: w / h < 0.9, short: h < 700 });
  placeImages();
  resizeMatte();
  layoutScenes();
  resizeFx();
  layoutCopy();
  setupFilm();
  onScroll();
  forceRender = true;
}

function onScroll() {
  if (state.frozenY != null) return;
  state.target = clamp(window.scrollY / view.unit, 0, T.total);
}

function jump(u) {
  cancelFreeze();
  const top = Math.round(u * view.unit);
  const far = Math.abs(u - state.u) > 3.2;
  if (state.reduce || !far) {
    window.scrollTo({ top, behavior: state.reduce ? 'auto' : 'smooth' });
    return;
  }
  // Saltos longos: linhas de velocidade cobrem a tela em vez de atravessar todas as cenas.
  curtain.classList.remove('is-out');
  curtain.classList.add('is-on');
  setTimeout(() => {
    window.scrollTo({ top, behavior: 'auto' });
    state.target = state.u = clamp(u, 0, T.total);
    forceRender = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      curtain.classList.add('is-out');
      setTimeout(() => {
        curtain.classList.add('no-anim');
        curtain.classList.remove('is-on', 'is-out');
        requestAnimationFrame(() => curtain.classList.remove('no-anim'));
      }, 420);
    }));
  }, 360);
}

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
function frame(now) {
  const dt = Math.min(64, now - last || 16);
  last = now;
  state.now = now;
  state.dt = dt;
  const prev = state.u;
  if (state.reduce) state.u = state.target;
  else {
    state.u += (state.target - state.u) * (1 - Math.exp(-dt / 90));
    if (Math.abs(state.target - state.u) < 0.0004) state.u = state.target;
  }
  state.vel = state.vel * 0.82 + ((state.u - prev) / dt) * 1000 * 0.18;
  const ease = 1 - Math.exp(-dt / 170);
  pointer.sx += (pointer.nx - pointer.sx) * ease;
  pointer.sy += (pointer.ny - pointer.sy) * ease;
  const u = state.u;
  const ringLive = u > T.contact.gather[0] && u < T.contact.flatten[1];
  const changed = forceRender || u !== lastU || Math.abs(pointer.sx - lastSX) > 0.0005 || Math.abs(pointer.sy - lastSY) > 0.0005 || Math.abs(state.vel) > 0.01 || ringLive;
  if (changed) {
    forceRender = false;
    lastU = u; lastSX = pointer.sx; lastSY = pointer.sy;
    updateFilm(u);
    renderMatte(u);
    renderScenes(u, dt);
    renderCopy(u);
    renderHud(u);
  }
  renderFx(u, dt);
  requestAnimationFrame(frame);
}

// ——— Início ———
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
setReduce(reduceQuery.matches);
reduceQuery.addEventListener?.('change', e => { setReduce(e.matches); forceRender = true; });
document.querySelector('.motion').addEventListener('click', () => { forceRender = true; });

bindJump(jump);
bindFocus(jumpToAct);
for (const a of document.querySelectorAll('a[href^="#"]')) a.addEventListener('click', e => {
  const ch = CHAPTERS.find(c => c.id === a.getAttribute('href').slice(1));
  if (!ch) return;
  e.preventDefault();
  jump(ch.u);
  const target = document.getElementById(ch.id);
  setTimeout(() => target?.querySelector('select, input, button, a')?.focus({ preventScroll: true }), 600);
});

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
resize(true);
addEventListener('resize', () => resize());
addEventListener('orientationchange', () => setTimeout(() => resize(true), 250));
addEventListener('scroll', onScroll, { passive: true });

const hashChapter = CHAPTERS.find(c => `#${c.id}` === location.hash);
if (hashChapter) { window.scrollTo(0, Math.round(hashChapter.u * view.unit)); onScroll(); state.u = state.target; }
else { window.scrollTo(0, 0); onScroll(); state.u = state.target; }

const firstFrame = new Promise(resolve => {
  if (video.readyState >= 2) resolve();
  video.addEventListener('loadeddata', resolve, { once: true });
  video.addEventListener('error', resolve, { once: true });
});
Promise.race([
  Promise.all([document.fonts?.ready ?? Promise.resolve(), IMG.wash.ready, firstFrame]),
  new Promise(r => setTimeout(r, 2800)),
]).then(() => { forceRender = true; ready(); });
document.fonts?.ready.then(() => { layoutCopy(); forceRender = true; });

// Gancho de depuração para QA visual (?debug na URL).
if (/[?&]debug\b/.test(location.search)) window.__jetcar = { state, view, T, pointer, settle: () => { state.u = state.target; forceRender = true; } };

requestAnimationFrame(frame);

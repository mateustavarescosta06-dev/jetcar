// JETCAR — um plano-sequência conduzido pela rolagem.
// A rolagem é a linha do tempo: um palco WebGL preso na tela desenha o filme, o logo, o estúdio
// e o mapa; a posição da rolagem (em telas) decide onde a câmera está e o que a luz revela.
import Lenis from './vendor/lenis.min.js';
import { $, $$, view, pointer, state, clamp } from './js/core.js';
import { CHAPTERS, C, TOTAL, chapterAt } from './js/chapters.js';
import { Engine, post, pickQuality, resetPost } from './js/gl/engine.js';
import { FilmShot } from './js/gl/shot-film.js';
import { StudioShot } from './js/gl/shot-studio.js';
import { MapShot } from './js/gl/shot-map.js';
import { renderCaptions, captionHold } from './js/captions.js';
import { renderUi, bindJump, setReduce, savedMotion, setMenu, cancelFreeze, ready, loading, bindSound } from './js/ui.js';
import { setSound, renderSound } from './js/audio.js';

const html = document.documentElement;
const stage = $('.stage'), canvas = $('.gl'), track = $('.track');
const svhProbe = $('.svh-probe'), lvhProbe = $('.lvh-probe');
const chEls = $$('.ch');
const mobileQ = matchMedia('(max-width: 760px)'), portraitQ = matchMedia('(max-aspect-ratio: 9/10)');

// ——— Movimento reduzido (preferência do sistema ou escolha salva) ———
const reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
const saved = savedMotion();
setReduce(saved ? saved === 'reduce' : reduceQ.matches);
reduceQ.addEventListener?.('change', e => { if (!savedMotion()) setReduce(e.matches); });

// ——— WebGL ———
function measureView() {
  const w = document.documentElement.clientWidth;
  const h = lvhProbe.offsetHeight || window.innerHeight;
  const svh = svhProbe.offsetHeight || window.innerHeight;
  Object.assign(view, { w, h, svh, unit: svh, aspect: w / h, dpr: Math.min(window.devicePixelRatio || 1, 3), mobile: mobileQ.matches, portrait: portraitQ.matches, short: svh < 640, nav: $('.nav').offsetHeight || 64 });
}
measureView();
let engine = null;
const quality = pickQuality({ mobile: view.mobile, dpr: view.dpr, cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory });
try {
  engine = new Engine(canvas, quality);
} catch (e) {
  html.classList.add('no-gl');
  // sem WebGL: o filme passa em loop atrás do conteúdo (mudo, pausa quando a aba some)
  const v = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true, autoplay: true, preload: 'metadata' });
  v.className = 'fallback-film';
  v.setAttribute('aria-hidden', 'true');
  v.poster = view.portrait ? 'assets/film-poster-portrait.webp' : 'assets/film-poster.webp';
  v.src = view.portrait ? 'assets/film-portrait.mp4' : 'assets/film-720.mp4';
  if (state.reduce) v.removeAttribute('autoplay');
  stage.prepend(v);
  document.addEventListener('visibilitychange', () => { if (document.hidden) v.pause(); else if (!state.reduce) v.play().catch(() => {}); });
}
const shots = {};
if (engine) {
  shots.film = new FilmShot(quality);
  shots.studio = new StudioShot(quality);
  shots.map = new MapShot(quality);
}

// ——— Trilho: altura de cada capítulo em px ———
let trackTop = 0, pageY = 0, lastW = 0, lastH = 0;
function layout(force = false) {
  measureView();
  const sizeChanged = view.w !== lastW || Math.abs(view.h - lastH) > 120;
  chEls.forEach((el, i) => { el.style.height = `${Math.round(CHAPTERS[i].len * view.unit)}px`; });
  const y = window.scrollY;
  trackTop = track.getBoundingClientRect().top + y;
  pageY = $('.booking').getBoundingClientRect().top + y;
  view.faqY = $('#duvidas').getBoundingClientRect().top + y;
  view.scrollMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  if (engine && (force || sizeChanged)) {
    lastW = view.w; lastH = view.h;
    const scale = clamp(view.dpr, quality.minScale, quality.maxScale) * dynScale;
    engine.resize(view.w, view.h, scale);
    for (const s of Object.values(shots)) { s.scale = engine.scale; s.resize(); s.setRes?.(engine.size.x, engine.size.y); }
  }
  onScroll();
}

// Resolução dinâmica: se o aparelho não acompanha, desenha menos pixels.
let dynScale = 1, slowFrames = 0, fastFrames = 0;
function adaptResolution(ms) {
  if (!engine) return;
  if (ms > 26) { slowFrames++; fastFrames = 0; } else if (ms < 14) { fastFrames++; slowFrames = 0; } else { slowFrames = Math.max(0, slowFrames - 1); fastFrames = 0; }
  if (slowFrames > 45 && dynScale > 0.55) { dynScale = Math.max(0.55, dynScale - 0.12); slowFrames = 0; layout(true); }
  else if (fastFrames > 240 && dynScale < 1) { dynScale = Math.min(1, dynScale + 0.08); fastFrames = 0; layout(true); }
}

// ——— Rolagem suave (roda do mouse); no toque, a rolagem nativa ———
let lenis = null;
if (!state.reduce) {
  lenis = new Lenis({ autoRaf: false, lerp: 0.085, wheelMultiplier: 0.85, smoothWheel: true, syncTouch: false });
}

function onScroll() {
  if (state.frozenY != null) return;
  state.target = clamp((window.scrollY - trackTop) / view.unit, 0, TOTAL + 1.5);
}
addEventListener('scroll', onScroll, { passive: true });

// ——— Navegação: capítulos e âncoras ———
const curtain = Object.assign(document.createElement('div'), { className: 'curtain' });
curtain.setAttribute('aria-hidden', 'true');
document.body.append(curtain);

function targetY(el) {
  const id = el.dataset?.ch;
  if (id && C[id]) return Math.round(trackTop + captionHold(id) * view.unit);
  if (el.id === 'inicio') return 0;
  return Math.round(el.getBoundingClientRect().top + window.scrollY);
}
function jump(el, { focus } = {}) {
  cancelFreeze();
  setMenu(false);
  const top = targetY(el);
  const settle = () => {
    // capítulos do trilho: o foco vai para o título da legenda (o próximo Tab segue a página)
    const ch = el.dataset?.ch;
    const head = ch ? document.querySelector(`.cap[data-cap="${ch}"] h1, .cap[data-cap="${ch}"] h2`) : null;
    const f = focus || head || el.querySelector?.('h2, input') || el;
    if (!f.matches('a, button, input, select, textarea, [tabindex]')) f.setAttribute('tabindex', '-1');
    f.focus({ preventScroll: true });
  };
  const far = Math.abs(top - window.scrollY) > view.unit * 3.5;
  if (state.reduce || !far) {
    if (lenis && !state.reduce) lenis.scrollTo(top, { duration: 1.4 });
    else window.scrollTo(0, top);
    setTimeout(settle, state.reduce ? 0 : 900);
    return;
  }
  // Saltos longos: um corte rápido no preto (como num filme), em vez de atravessar tudo.
  curtain.classList.add('is-on');
  setTimeout(() => {
    if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
    else window.scrollTo(0, top);
    onScroll();
    state.u = state.target;
    settle();
    requestAnimationFrame(() => requestAnimationFrame(() => curtain.classList.remove('is-on')));
  }, 340);
}
bindJump(jump);
bindSound(setSound);
for (const a of $$('a[href^="#"]')) a.addEventListener('click', e => {
  const id = a.getAttribute('href').slice(1);
  const target = id && document.getElementById(id);
  if (!target) return;
  e.preventDefault();
  jump(target, { focus: id === 'agendar' ? $('#car-model') : null });
  if (history.replaceState) history.replaceState(null, '', id === 'inicio' ? location.pathname + location.search : `#${id}`);
});
// Conteúdo focado pelo teclado dentro de uma legenda leva a rolagem até o capítulo dela.
document.addEventListener('focusin', e => {
  const cap = e.target.closest?.('.cap');
  if (!cap) return;
  const id = cap.dataset.cap, ch = C[id];
  if (!ch) return;
  const t = (state.target - ch.start) / ch.len;
  if (t < 0 || t > 1) jump(chEls[CHAPTERS.indexOf(ch)], { focus: e.target });
});

// ——— Cursor (só mouse: a câmera responde poucos pixels) ———
addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.nx = clamp((e.clientX / view.w) * 2 - 1, -1, 1);
  pointer.ny = clamp((e.clientY / view.h) * 2 - 1, -1, 1);
  pointer.at = state.now;
}, { passive: true });

// ——— Quadro a quadro ———
let last = performance.now();
let activeShot = null, lastActive = 0, skip = false;
function shotFor(u) {
  const ch = chapterAt(u);
  return shots[ch.shot] || null;
}
function tick(now) {
  const dt = Math.min(64, now - last || 16);
  last = now;
  state.now = now;
  state.dt = dt;
  lenis?.raf(now);
  const prev = state.u;
  if (state.reduce) state.u = state.target;
  else {
    state.u += (state.target - state.u) * (1 - Math.exp(-dt / 55));
    if (Math.abs(state.target - state.u) < 1e-4) state.u = state.target;
  }
  state.vel = state.vel * 0.85 + ((state.u - prev) / dt) * 1000 * 0.15;
  const ease = 1 - Math.exp(-dt / 220);
  pointer.sx += (pointer.nx - pointer.sx) * ease;
  pointer.sy += (pointer.ny - pointer.sy) * ease;
  const u = state.u;
  const y = window.scrollY;
  // O palco para quando o conteúdo final cobre a tela.
  const covered = y > pageY + view.h * 1.1;
  if (covered !== state.covered) { state.covered = covered; stage.style.visibility = covered ? 'hidden' : ''; }
  // parado (sem rolar nem mexer o cursor) a cena só respira: desenha a 30 quadros por segundo
  if (Math.abs(u - prev) > 1e-5 || now - pointer.at < 300) lastActive = now;
  const idle = now - lastActive > 3000;
  skip = idle ? !skip : false;
  if (engine && !covered && !document.hidden && !skip) {
    // a troca de resolução acontece antes de desenhar (redimensionar limpa a tela)
    if (!idle) adaptResolution(dt);
    const shot = shotFor(Math.min(u, TOTAL - 0.001));
    if (shot !== activeShot) { activeShot?.leave?.(); activeShot = shot; }
    resetPost();
    if (shot) {
      shot.update(Math.min(u, TOTAL - 0.001), dt);
      engine.render(shot.scene, shot.camera, now / 1000);
    } else {
      post.exposure = 1; post.white = 0; post.black = 1;
      engine.render(null, null, now / 1000);
    }
  }
  renderCaptions(u);
  renderUi(u, y, pageY);
  renderSound();
  requestAnimationFrame(tick);
}

// ——— Início ———
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
layout(true);
addEventListener('resize', () => layout());
addEventListener('orientationchange', () => setTimeout(() => layout(true), 250));
if ('ResizeObserver' in window) new ResizeObserver(() => layout()).observe(document.body);

const hashTarget = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
window.scrollTo(0, hashTarget ? targetY(hashTarget) : 0);
onScroll();
state.u = state.target;

// Carregamento: fontes + primeiros quadros do filme.
const fontsReady = document.fonts?.ready ?? Promise.resolve();
const firstFrames = shots.film ? shots.film.seq.firstReady : Promise.resolve();
let p = 0;
const progressTimer = setInterval(() => { p = Math.min(0.92, p + 0.06); loading(p); }, 120);
Promise.race([Promise.all([fontsReady, firstFrames]), new Promise(r => setTimeout(r, 6000))]).then(() => {
  clearInterval(progressTimer);
  loading(1);
  shots.film?.drawType?.(shots.film.typeWord, true);
  setTimeout(() => {
    ready();
    // o restante do filme e das cenas carrega em segundo plano
    shots.film?.prefetchRest();
    setTimeout(() => shots.map?.load(), 1500);
  }, 250);
});
document.fonts?.ready.then(() => layout(true));

if (/[?&]debug\b/.test(location.search)) window.__jetcar = { state, view, C, TOTAL, pointer, post, shots, engine, settle: () => { state.u = state.target; } };

requestAnimationFrame(tick);

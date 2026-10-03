// JETCAR v6 · Baias de serviço.
// A página é um site em fluxo normal. Algumas seções são atos: seções altas com um palco preso,
// em que a rolagem vira o progresso da cena. Cada baia usa uma mídia e um dispositivo próprios.
// Os atos com 3D compartilham um único WebGL: o canvas vai para o palco do ato mais visível e o
// ato que perde o canvas fica com uma cópia 2D do último quadro (ele está parado na borda).
import Lenis from './vendor/lenis.min.js';
import { $, $$, view, pointer, state, clamp } from './js/core.js';
import { Engine, pickQuality, resetPost, applyLevel, EFFECTS, SCALES } from './js/gl/engine.js';
import { HeroAct } from './js/acts/hero.js';
import { WashAct } from './js/acts/wash.js';
import { PolishAct } from './js/acts/polish.js';
import { ProtectAct } from './js/acts/protect.js';
import { InteriorAct } from './js/acts/interior.js';
import { RouteAct } from './js/acts/route.js';
import { initUi, renderUi, setReduce, savedMotion, setMenu, cancelFreeze, ready } from './js/ui.js';
import { setSound, renderSound } from './js/audio.js';

const html = document.documentElement;
const svhProbe = $('.svh-probe'), lvhProbe = $('.lvh-probe');
const mobileQ = matchMedia('(max-width: 760px)'), portraitQ = matchMedia('(max-aspect-ratio: 9/10)');
const fineQ = matchMedia('(hover: hover) and (pointer: fine)');
html.classList.toggle('no-hover', !fineQ.matches);

// ——— Movimento reduzido (preferência do sistema ou escolha salva no aparelho) ———
const reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
const saved = savedMotion();
setReduce(saved ? saved === 'reduce' : reduceQ.matches);

function measureView() {
  const w = html.clientWidth;
  const h = lvhProbe.offsetHeight || innerHeight;
  const svh = svhProbe.offsetHeight || innerHeight;
  Object.assign(view, { w, h, svh, unit: svh, aspect: w / h, dpr: Math.min(devicePixelRatio || 1, 3), mobile: mobileQ.matches, portrait: portraitQ.matches, short: svh < 640, fine: fineQ.matches, nav: $('.bar').offsetHeight || 64 });
  html.style.setProperty('--chrome', `${Math.max(0, h - svh)}px`);
}
measureView();

// ——— WebGL: um renderizador para todas as cenas ———
let engine = null;
// ?quality=high|standard|low fixa o perfil (testes e comparações); sem ele a escada se ajusta
const pin = new URLSearchParams(location.search).get('quality');
const quality = pickQuality({ mobile: view.mobile, dpr: view.dpr, cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory, pin });
const canvas = document.createElement('canvas');
canvas.className = 'gl';
canvas.setAttribute('aria-hidden', 'true');
try {
  engine = new Engine(canvas, quality);
  html.classList.add('gl-on');
} catch (e) {
  html.classList.add('no-gl');
}
// sem WebGL a página fica parada como no movimento reduzido (pôsteres, conteúdo empilhado)
state.flat = state.reduce || !engine;

const KINDS = { hero: HeroAct, wash: WashAct, polish: PolishAct, protect: ProtectAct, interior: InteriorAct, route: RouteAct };
const acts = $$('[data-act]').map(el => new (KINDS[el.dataset.act])(el, { engine, quality }));
const byId = Object.fromEntries(acts.map(a => [a.id, a]));
const glActs = engine ? acts.filter(a => a.gl) : [];
if (!engine) for (const a of acts) a.gl = false;
// contexto WebGL perdido e recuperado (comum no iPhone em segundo plano): desenha de novo
canvas.addEventListener('webglcontextrestored', () => { needDraw = true; for (const a of glActs) dropSnap(a); });

/** Compila os shaders de um ato logo depois de carregar, e não no primeiro quadro em que ele
 *  aparece (no celular isso travaria a rolagem bem na entrada da cena). Objetos escondidos são
 *  mostrados só durante a chamada, para entrarem na compilação. */
function warm(a) {
  const r = engine?.renderer;
  if (!a.gl || !a.scene || !r) return null;
  const run = compile => {
    const hidden = [];
    a.scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    const out = compile();
    for (const o of hidden) o.visible = false;
    return out;
  };
  // com a extensão a compilação corre em paralelo; sem ela, compila de uma vez num momento ocioso
  if (r.extensions.has('KHR_parallel_shader_compile')) return run(() => r.compileAsync(a.scene, a.camera)).catch(() => {});
  return new Promise(res => (window.requestIdleCallback || setTimeout)(() => { try { run(() => r.compile(a.scene, a.camera)); } catch {} res(); }, { timeout: 1500 }));
}

// ——— Layout ———
let lastW = 0, lastH = 0, lastScale = 0, needDraw = false;
function layout(force = false) {
  measureView();
  // a janela foi para outra tela ou o zoom mudou: o teto da escala segue o DPR novo
  if (quality.dpr !== view.dpr) { quality.dpr = view.dpr; applyLevel(quality); }
  for (const a of acts) a.setHeight();
  const y = scrollY;
  for (const a of acts) { a.measure(y); a.layout(); }
  // movimento reduzido: palco mais alto que a tela (o canvas fica com a altura da tela e esfuma embaixo)
  if (state.flat) for (const a of acts) a.stage?.classList.toggle('is-tall', a.stage.offsetHeight > view.h + 4);
  view.scrollMax = Math.max(1, html.scrollHeight - innerHeight);
  view.pageY = $('#resultado').getBoundingClientRect().top + y;
  // trechos em fluxo com fundo chapado (a barra fica sólida por cima deles)
  view.flat = $$('.order, .faq, .footer').map(el => { const r = el.getBoundingClientRect(); return [r.top + y, r.bottom + y]; });
  // no celular a barra do navegador muda a altura o tempo todo: só redimensiona em mudanças grandes
  if (engine && (force || view.w !== lastW || Math.abs(view.h - lastH) > (view.mobile ? 120 : 0) || quality.scale !== lastScale)) {
    lastW = view.w; lastH = view.h; lastScale = quality.scale;
    engine.resize(view.w, view.h, quality.scale);
    needDraw = true;   // mudar o tamanho apaga o canvas: desenha de novo mesmo com a página parada
    for (const a of glActs) { a.resize?.(engine.size.x, engine.size.y); dropSnap(a); }
  }
}

// ——— Orçamento de quadro: a escada de qualidade (engine.js) ———
// A cada segundo de desenho ativo compara o custo com o intervalo da tela (60, 90, 120 Hz, ou 30
// no modo de economia): pelo tempo de GPU quando o navegador mede, senão pelos quadros perdidos.
// Dois segundos lentos seguidos descem um degrau (efeitos antes da resolução); três segundos
// folgados sobem um (resolução antes dos efeitos). Um degrau que falhou fica bloqueado por um
// tempo que quadruplica a cada falha, para a página não ficar testando e engasgando.
const gov = { dts: [], at: 0, slow: 0, fast: 0, failed: new Map(), refresh: Infinity, quiet: 0 };
const keyOf = q => `${q.e}|${q.s}`;
function stepQuality(dir, now) {
  const q = quality, from = keyOf(q);
  if (dir < 0) {
    if (q.e < EFFECTS.length - 1) q.e++;
    else if (q.s < SCALES.length - 1) q.s++;
    else return;
    const f = gov.failed.get(from) || { n: 0 };
    gov.failed.set(from, { n: f.n + 1, at: now });
  } else {
    const e = q.e, s = q.s;
    if (q.s > 0 && Math.min(q.dpr, SCALES[q.s - 1]) > q.scale) q.s--;
    else if (q.e > 0) q.e--;
    else return;
    const f = gov.failed.get(keyOf(q));
    if (f && now - f.at < 20000 * 4 ** (f.n - 1)) { q.e = e; q.s = s; return; }
  }
  applyLevel(q);
  engine.applyQuality();
  layout(true);
}
function govern(dt, now) {
  if (quality.pinned) return;
  // carregando ou compilando shaders: os quadros perdidos não dizem nada sobre o aparelho
  if (now < gov.quiet) { gov.dts.length = 0; gov.at = now; return; }
  gov.dts.push(dt);
  if (now - gov.at < 1000 || gov.dts.length < 24) return;
  const sorted = [...gov.dts].sort((a, b) => a - b);
  // intervalo da tela: o menor visto na visita (com a GPU sobrando, um quadro de 60 Hz mostra
  // 16,7 ms; se todo quadro levar 33 ms por falta de GPU, a janela sozinha acharia que a tela é
  // de 30 Hz e nunca veria quadro perdido)
  gov.refresh = Math.min(gov.refresh, sorted[Math.floor(sorted.length * 0.2)]);
  const refresh = gov.refresh;
  const dropped = gov.dts.filter(x => x > refresh * 1.6).length / gov.dts.length;
  gov.dts.length = 0;
  gov.at = now;
  const gpu = engine.gpuMs();
  const slow = gpu != null ? gpu > refresh * 0.85 : dropped > 0.2;
  const fast = gpu != null ? gpu < refresh * 0.45 : dropped < 0.02;
  gov.slow = slow ? gov.slow + 1 : 0;
  gov.fast = fast ? gov.fast + 1 : 0;
  if (gov.slow >= 2) { gov.slow = 0; stepQuality(-1, now); }
  else if (gov.fast >= 3) { gov.fast = 0; stepQuality(1, now); }
}

// ——— Rolagem suave na roda do mouse; no toque, a nativa ———
let lenis = null;
if (!state.reduce) lenis = new Lenis({ autoRaf: false, lerp: 0.09, wheelMultiplier: 0.9, smoothWheel: true, syncTouch: false });

// ——— Âncoras: cada ato tem um ponto de leitura; saltos longos cortam no preto ———
const curtain = Object.assign(document.createElement('div'), { className: 'curtain' });
curtain.setAttribute('aria-hidden', 'true');
document.body.append(curtain);
function actOf(el) { const s = el.closest?.('[data-act]'); return s ? byId[s.dataset.act] : null; }
function targetY(el) {
  if (el.id === 'inicio') return 0;
  const act = actOf(el);
  if (act) return act.scrollFor(act.holdFor(el.id));
  return Math.round(el.getBoundingClientRect().top + scrollY);
}
function jump(el, { focus } = {}) {
  cancelFreeze();
  setMenu(false);
  const top = targetY(el);
  const settle = () => {
    const f = focus || el.querySelector?.('h2, h1, input') || el;
    if (!f.matches('a, button, input, select, textarea, [tabindex]')) f.setAttribute('tabindex', '-1');
    f.focus({ preventScroll: true });
  };
  const far = Math.abs(top - scrollY) > view.svh * 3.2;
  if (state.reduce || !far) {
    if (lenis) lenis.scrollTo(top, { duration: 1.2 });
    else scrollTo(0, top);
    setTimeout(settle, state.reduce ? 0 : 800);
    return;
  }
  curtain.classList.add('is-on');
  setTimeout(() => {
    if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
    else scrollTo(0, top);
    state.jumping = true;
    settle();
    requestAnimationFrame(() => requestAnimationFrame(() => { state.jumping = false; curtain.classList.remove('is-on'); }));
  }, 320);
}
for (const a of $$('a[href^="#"]')) a.addEventListener('click', e => {
  const id = a.getAttribute('href').slice(1);
  const t = id && document.getElementById(id);
  if (!t || a.dataset.explore) return;
  e.preventDefault();
  jump(t, { focus: id === 'agendar' ? $('#car-model') : null });
  if (history.replaceState) history.replaceState(null, '', id === 'inicio' ? location.pathname + location.search : `#${id}`);
});
// "Explorar" num card leva o ato ao ponto da interação e foca o controle da cena.
for (const b of $$('[data-explore]')) b.addEventListener('click', e => {
  const act = actOf(b);
  if (!act?.explore) return;
  e.preventDefault();
  act.explore(b, { jump: (p, focus) => {
    const y = act.scrollFor(p);
    if (lenis) lenis.scrollTo(y, { duration: 1.0 }); else scrollTo(0, y);
    if (focus) setTimeout(() => focus.focus({ preventScroll: true }), state.reduce ? 0 : 700);
  } });
});
// Foco do teclado dentro de um palco preso leva a rolagem até o ponto em que aquilo aparece.
// foco pelo teclado leva o ato ao ponto onde o controle aparece; clique e toque não mexem a página
let pointerAt = -1e9;
addEventListener('pointerdown', () => { pointerAt = performance.now(); }, true);
document.addEventListener('focusin', e => {
  if (performance.now() - pointerAt < 800) return;
  const act = actOf(e.target);
  if (!act || state.flat || act.travel <= 0) return;
  const want = act.focusPoint?.(e.target);
  if (want == null) return;
  if (Math.abs(act.raw - want) > 0.08) { const y = act.scrollFor(want); if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); }
});

// ——— Ponteiro (só mouse; o toque usa arrastar dentro de cada cena) ———
addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.nx = clamp((e.clientX / view.w) * 2 - 1, -1, 1);
  pointer.ny = clamp((e.clientY / view.h) * 2 - 1, -1, 1);
  pointer.at = state.now;
}, { passive: true });

// ——— Cópias 2D: o ato que não está com o canvas mostra o último quadro dele ———
function ensureSnap(a) {
  if (!a.snap) {
    a.snap = document.createElement('canvas');
    a.snap.className = 'snap';
    a.snap.setAttribute('aria-hidden', 'true');
  }
  if (a.snap.width !== canvas.width || a.snap.height !== canvas.height) { a.snap.width = canvas.width; a.snap.height = canvas.height; a.snapKey = null; }
  if (a.snap.parentNode !== a.slot) a.slot.append(a.snap);
  return a.snap;
}
function dropSnap(a) {
  if (!a.snap) return;
  a.snap.remove();
  a.snap.width = a.snap.height = 0;
  a.snapKey = null;
}
function drawAct(a, now) {
  resetPost();
  a.render(engine, now);
}
function copyTo(a) {
  const s = ensureSnap(a);
  s.getContext('2d').drawImage(canvas, 0, 0);
  a.snapKey = a.key();
  s.style.visibility = '';
}

let owner = null;
function pickOwner() {
  let best = null;
  for (const a of glActs) if (a.visible && a.ready && (!best || a.vis > best.vis)) best = a;
  // histerese: o dono atual só perde o canvas quando o outro ocupa claramente mais tela
  if (best && owner && owner !== best && owner.visible && owner.ready && owner.vis >= best.vis - 0.04) return owner;
  return best;
}

// ——— Quadro a quadro ———
let last = performance.now(), lastActive = 0, skip = false, lastY = -1;
function tick(now) {
  const dt = Math.min(64, now - last || 16);
  last = now;
  state.now = now;
  state.dt = dt;
  lenis?.raf(now);
  const y = state.frozenY ?? scrollY;
  state.vel = state.vel * 0.85 + ((y - lastY) / Math.max(1, dt)) * (1000 / view.svh) * 0.15;
  const moved = y !== lastY;
  lastY = y;
  const ease = 1 - Math.exp(-dt / 220);
  pointer.sx += (pointer.nx - pointer.sx) * ease;
  pointer.sy += (pointer.ny - pointer.sy) * ease;

  let settling = false;
  for (const a of acts) {
    a.track(y, dt);
    if (a.p !== a.raw) settling = true;
    if (a.visible) a.update(dt, now);
  }

  if (engine && !document.hidden) {
    const next = pickOwner();
    if (next !== owner) {
      // o ato que sai fica com a cópia do último quadro dele
      if (owner && owner.visible) { drawAct(owner, now); copyTo(owner); }
      owner = next;
      lastActive = now;   // o palco novo precisa de um quadro mesmo com a página parada
      if (owner) {
        owner.slot.append(canvas);
        if (owner.snap) owner.snap.style.visibility = 'hidden';
      }
    }
    // outro ato com 3D visível ao mesmo tempo (entrando ou saindo): cópia no estado atual dele
    let extra = false;
    for (const a of glActs) {
      if (a === owner) continue;
      if (!a.visible) { if (a.snap) dropSnap(a); continue; }
      if (a.ready && a.snapKey !== a.key()) { drawAct(a, now); copyTo(a); extra = true; }
    }
    const active = moved || settling || extra || needDraw || now - pointer.at < 400 || (owner && owner.animating);
    needDraw = false;
    if (active) lastActive = now;
    const idle = now - lastActive > 2500;
    skip = idle ? !skip : false;
    if (owner && (!skip || extra) && (active || now - lastActive < 2600 || owner.ambient)) {
      if (!idle && !extra && document.visibilityState === 'visible') govern(dt, now);
      engine.measure = true;
      drawAct(owner, now);
      engine.measure = false;
    }
  }
  renderUi(y, acts, byId);
  renderSound();
  requestAnimationFrame(tick);
}

// ——— Início ———
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
initUi({ jump, acts, byId, lenis });
layout(true);
addEventListener('resize', () => layout());
// DPR que muda sem mudar o tamanho (janela levada para outra tela): só o matchMedia avisa
const watchDpr = () => matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener?.('change', () => { layout(true); watchDpr(); }, { once: true });
watchDpr();
addEventListener('orientationchange', () => setTimeout(() => layout(true), 250));
if ('ResizeObserver' in window) new ResizeObserver(() => layout()).observe(document.body);
reduceQ.addEventListener?.('change', ev => { if (!savedMotion()) { setReduce(ev.matches); location.reload(); } });
// trocar o movimento muda a estrutura da página (atos presos ou não): recarrega e volta ao botão
$('.motion').addEventListener('click', () => {
  try { sessionStorage.setItem('jetcar-return', 'motion'); } catch {}
  setTimeout(() => location.reload(), 60);
});

const hashTarget = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
let back = null;
try { back = sessionStorage.getItem('jetcar-return'); sessionStorage.removeItem('jetcar-return'); } catch {}
if (back === 'motion') { scrollTo(0, html.scrollHeight); $('.motion').focus({ preventScroll: true }); }
else scrollTo(0, hashTarget ? targetY(hashTarget) : 0);
state.jumping = true;
requestAnimationFrame(() => { state.jumping = false; });

const fontsReady = document.fonts?.ready ?? Promise.resolve();
const first = byId.hero?.load() ?? Promise.resolve();
Promise.race([Promise.all([fontsReady, first]), new Promise(r => setTimeout(r, 7000))]).then(() => {
  layout(true);
  ready();
  byId.hero?.start?.();
  // o resto carrega em segundo plano, na ordem da página
  const rest = acts.filter(a => a.id !== 'hero');
  // cada ato tem até 12 s: um asset que não responde não segura os seguintes
  const timeout = ms => new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms));
  const quiet = () => { gov.quiet = performance.now() + 2500; };
  rest.reduce((pr, a) => pr.then(() => { quiet(); return Promise.race([a.load().then(() => warm(a)), timeout(12000)]).then(quiet).catch(err => console.warn(a.id, err)); }), Promise.resolve()).then(() => layout(true));
});
document.fonts?.ready.then(() => layout(true));

// ?debug: estado para os testes; settle() leva tudo ao alvo sem esperar a suavização
if (/[?&]debug\b/.test(location.search)) window.__jetcar = {
  state, view, pointer, acts: byId, engine, quality, layout, owner: () => owner?.id,
  settle() { for (const a of acts) { a.track(scrollY, 16); a.p = a.raw; a.settle?.(); } },
};

requestAnimationFrame(tick);

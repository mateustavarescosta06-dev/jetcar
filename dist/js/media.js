// Moldura dos serviços, fotos (posicionamento compartilhado DOM/canvas) e o filme de fundo.
import { $, $$, view, frame as F, state, pointer, clamp, cover, loadImage, lerp, inOut, span, smooth, css, f } from './core.js';
import { T, IMAGES } from './timeline.js';

const stage = $('.stage');

/** Retângulos "cover" de cada foto dentro da moldura (coordenadas do palco). */
export const P = {};
/** Imagens decodificadas para desenho em canvas. */
export const IMG = {};
for (const [key, meta] of Object.entries(IMAGES)) IMG[key] = loadImage(meta.src);
IMG.interiorSoft = loadImage('assets/interior-soft.webp');

/**
 * Moldura: no computador fica à direita do texto; em telas em pé, em cima, com o texto
 * em cartões embaixo. Mesmas medidas do CSS (--pad, largura da coluna de texto).
 */
export function layoutFrame() {
  const { w, svh, nav } = view;
  const pad = w <= 760 ? 16 : clamp(w * 0.04, 18, 56);
  let x, y, fw, fh;
  if (view.portrait) {
    x = pad;
    y = nav + (view.mobile ? 4 : 12);
    fw = w - pad * 2;
    fh = Math.max(170, svh * (view.mobile ? (view.short ? 0.5 : 0.535) : 0.58) - y);
  } else {
    const txt = Math.min(520, w * 0.4);
    const gap = clamp(w * 0.05, 28, 96);
    x = pad + txt + gap;
    y = nav + (view.short ? 2 : 12);
    fw = w - pad - x;
    fh = svh - y - Math.max(16, pad * 0.62);
  }
  const r = view.mobile ? 20 : clamp(Math.min(fw, fh) * 0.04, 18, 30);
  Object.assign(F, { x, y, w: fw, h: fh, cx: x + fw / 2, cy: y + fh / 2, r, diag: Math.hypot(fw, fh) });
  css(stage, '--fx', `${f(x)}px`);
  css(stage, '--fy', `${f(y)}px`);
  css(stage, '--fw', `${f(fw)}px`);
  css(stage, '--fh', `${f(fh)}px`);
  css(stage, '--fr', `${f(r)}px`);
}

export function placeImages() {
  for (const [key, m] of Object.entries(IMAGES)) {
    const r = cover(m.w, m.h, F.w, F.h, m.fx, m.fy);
    P[key] = { x: F.x + r.x, y: F.y + r.y, w: r.w, h: r.h };
  }
  for (const img of $$('img.cover[data-img]')) {
    const r = P[img.dataset.img];
    // A porta do PPF é posicionada na moldura: a foto dentro dela usa coordenadas locais.
    const local = img.closest('.door');
    img.style.width = `${r.w}px`;
    img.style.height = `${r.h}px`;
    img.style.left = `${local ? r.x - F.x : r.x}px`;
    img.style.top = `${local ? r.y - F.y : r.y}px`;
  }
}

/** Escala de cada foto em função da rolagem (a mesma para o DOM e para o canvas), em torno do centro da moldura. */
export const zoom = {
  wash(u) {
    const [d0, d1] = T.brand.portal, [m0, m1] = T.frame.morph;
    if (u < d0) return 1.32;
    if (u < d1) return lerp(1.32, 1.1, inOut(span(u, d0, d1)));
    if (u < m1 + 0.4) return lerp(1.1, 1.0, inOut(span(u, m0, m1 + 0.4)));
    return lerp(1.0, 1.04, span(u, m1 + 0.4, T.wash.reveal[1]));
  },
  polish: u => lerp(1.06, 1.0, inOut(span(u, T.wash.reveal[0], T.polish.disc[1]))),
  ceramic: u => lerp(1.0, 1.04, inOut(span(u, T.hive.flip[1], T.layers.tilt[0]))),
  ppf: u => lerp(1.0, 1.04, inOut(span(u, T.layers.collapse[1], T.ppf.door[0]))),
  interior: u => (u < T.ppf.door[1] ? lerp(1.12, 1.0, inOut(span(u, T.ppf.door[0], T.ppf.door[1]))) : lerp(1.0, 1.03, span(u, T.ppf.door[1], T.interior.card[0]))),
};

// ——— Filme ———
const video = $('.film');
const playButton = $('.play-film');
let source = '', wantPlay = true, pauseTimer = 0, userBlocked = false;

function pickSource() {
  if (view.w / view.h < 0.78) return { src: 'assets/film-portrait.mp4', poster: 'assets/film-poster-portrait.webp' };
  const big = view.w * Math.min(window.devicePixelRatio || 1, 2) > 1900;
  return { src: big ? 'assets/film-1080.mp4' : 'assets/film-720.mp4', poster: 'assets/film-poster.webp' };
}

export function setupFilm() {
  const next = pickSource();
  if (next.src === source) return;
  const time = video.currentTime || 0;
  source = next.src;
  video.poster = next.poster;
  video.src = next.src;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  if (time) video.addEventListener('loadedmetadata', () => { try { video.currentTime = time % (video.duration || 14); } catch {} }, { once: true });
  play();
}

export async function play() {
  if (!wantPlay || document.hidden) return;
  try {
    await video.play();
    userBlocked = false;
    playButton.hidden = true;
  } catch {
    // Autoplay bloqueado (ex.: Modo Pouca Energia no iPhone): o pôster continua e oferecemos o play.
    userBlocked = true;
    playButton.hidden = !filmVisible(state.u);
  }
}

/** O filme aparece no início (topo e logo) e no final (Boa Viagem); no meio fica escondido e pausado. */
export const filmVisible = u => (u < T.brand.portal[1] + 0.01 || (u > T.place.slit[0] - 0.02 && u < T.sheet)) && !state.covered;

export function updateFilm(u) {
  const visible = filmVisible(u);
  css(video, 'visibility', visible ? 'visible' : 'hidden');
  // Paralaxe sutil com o ponteiro; aproxima um pouco enquanto o logo se forma.
  const k = state.reduce ? 0 : 1;
  const tx = -pointer.sx * 12 * k, ty = -pointer.sy * 8 * k;
  const sc = 1.04 + smooth(span(u, 0, T.brand.pull[1])) * 0.04 * k;
  css(video, 'transform', `translate3d(${f(tx)}px,${f(ty)}px,0) scale(${f(sc, 4)})`);
  const want = (visible || u < T.brand.portal[1] + 0.6 || (u > T.contact.flatten[0] - 0.8 && u < T.sheet)) && !state.covered;
  if (want !== wantPlay) {
    wantPlay = want;
    clearTimeout(pauseTimer);
    if (want) play();
    else pauseTimer = setTimeout(() => video.pause(), 400);
  }
  if (userBlocked) playButton.hidden = !visible;
}

playButton.addEventListener('click', play);
video.addEventListener('playing', () => { userBlocked = false; playButton.hidden = true; document.documentElement.classList.add('film-playing'); });
video.addEventListener('error', () => { playButton.hidden = true; });
document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); else play(); });
// Um toque em qualquer lugar destrava a reprodução quando o navegador exige gesto.
const unlock = () => { if (video.paused && wantPlay) play(); };
addEventListener('touchend', unlock, { passive: true });
addEventListener('click', unlock, { passive: true });
export { video };

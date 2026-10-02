// Fotos (posicionamento compartilhado DOM/canvas) e o filme de fundo.
import { $, $$, view, state, pointer, cover, loadImage, lerp, inOut, span, css, f } from './core.js';
import { T, IMAGES } from './timeline.js';

/** Retângulos "cover" de cada foto no palco, recalculados a cada resize. */
export const P = {};
/** Imagens decodificadas para desenho em canvas. */
export const IMG = {};
for (const [key, meta] of Object.entries(IMAGES)) IMG[key] = loadImage(meta.src);
IMG.interiorSoft = loadImage('assets/interior-soft.webp');

export function placeImages() {
  for (const [key, m] of Object.entries(IMAGES)) P[key] = cover(m.w, m.h, view.w, view.h, m.fx, m.fy);
  for (const img of $$('img.cover[data-img]')) {
    const r = P[img.dataset.img];
    img.style.width = `${r.w}px`;
    img.style.height = `${r.h}px`;
    img.style.left = `${r.x}px`;
    img.style.top = `${r.y}px`;
  }
}

/** Escala de cada foto em função da rolagem (a mesma para o DOM e para o canvas). */
export const zoom = {
  wash(u) {
    const [p0, p1] = T.brand.portal;
    if (u < p0) return 1.34;
    if (u < p1) return lerp(1.34, 1.08, inOut(span(u, p0, p1)));
    return lerp(1.08, 1.0, span(u, p1, T.wash.reveal[1]));
  },
  polish: u => lerp(1.07, 1.0, inOut(span(u, T.wash.reveal[0], T.polish.disc[1]))),
  ceramic: u => lerp(1.0, 1.045, inOut(span(u, T.hive.flip[1], T.layers.tilt[0]))),
  ppf: u => lerp(1.0, 1.05, inOut(span(u, T.layers.collapse[1], T.ppf.door[0]))),
  interior: u => (u < T.ppf.door[1] ? lerp(1.16, 1.0, inOut(span(u, T.ppf.door[0], T.ppf.door[1]))) : lerp(1.0, 1.035, span(u, T.ppf.door[1], T.interior.card[0]))),
};

// ——— Filme ———
const video = $('.film');
const playButton = $('.play-film');
let source = '', wantPlay = true, pauseTimer = 0, userBlocked = false;

function pickSource() {
  const portrait = view.w / view.h < 0.78;
  if (portrait) return { src: 'assets/film-portrait.mp4', poster: 'assets/film-poster-portrait.webp' };
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

/** O filme só aparece na abertura e no final; no meio fica pausado para poupar bateria. */
export const filmVisible = u => u < T.brand.portal[1] + 0.02 || u > T.place.slit[0] - 0.02;

export function updateFilm(u) {
  const visible = filmVisible(u);
  video.style.visibility = visible ? 'visible' : 'hidden';
  // Paralaxe sutil do filme com o ponteiro (o recorte do logo continua cobrindo a tela).
  const k = state.reduce ? 0 : 1;
  const tx = -pointer.sx * 14 * k, ty = -pointer.sy * 10 * k;
  const sc = 1.045 + (u < T.brand.pull[0] ? span(u, 0, T.brand.pull[0]) * 0.03 : 0.03) * k;
  css(video, 'transform', `translate3d(${f(tx)}px,${f(ty)}px,0) scale(${f(sc, 4)})`);
  const want = visible || u < T.brand.portal[1] + 0.6 || u > T.contact.flatten[0] - 0.8;
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

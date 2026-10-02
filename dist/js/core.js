// Utilitários e estado compartilhado da experiência.
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Progresso 0→1 de u dentro do intervalo [a, b]. */
export const span = (u, a, b) => clamp((u - a) / (b - a));
export const smooth = t => t * t * (3 - 2 * t);
export const inOut = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const out = t => 1 - (1 - t) ** 3;
export const inn = t => t * t * t;
export const outBack = t => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
/** Envelope: sobe em [a, b] e desce em [c, d]. */
export const env = (u, [a, b, c, d]) => smooth(span(u, a, b)) * (1 - smooth(span(u, c, d)));

/** Dimensões do palco. h é a altura "grande" (sem a barra do Safari), estável na rolagem. */
export const view = { w: 1, h: 1, cx: 0.5, cy: 0.5, diag: 1, dpr: 1, mobile: false, portrait: false, unit: 1 };
/** Ponteiro/toque: x/y em px, nx/ny em -1…1, sx/sy suavizados. */
export const pointer = { x: -9999, y: -9999, nx: 0, ny: 0, sx: 0, sy: 0, at: -1e9, touch: false, down: false, strokes: [], taps: [] };
export const state = { target: 0, u: 0, vel: 0, reduce: false, now: 0, dt: 16, selected: -1, light: 0, motion: 1 };

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/** Enquadramento "cover" com ponto focal (fx, fy). Compartilhado entre DOM e canvas. */
export function cover(iw, ih, bw, bh, fx = 0.5, fy = 0.5) {
  const s = Math.max(bw / iw, bh / ih), w = iw * s, h = ih * s;
  return { x: clamp(bw / 2 - fx * w, bw - w, 0), y: clamp(bh / 2 - fy * h, bh - h, 0), w, h };
}
/** Retângulo escalado k vezes em torno do pivô (px, py). */
export const zoomRect = (r, k, px, py) => ({ x: px + (r.x - px) * k, y: py + (r.y - py) * k, w: r.w * k, h: r.h * k });
/** Transform CSS (origem 0 0) que leva o retângulo base r ao retângulo t. */
export const toRect = (r, t) => `translate3d(${f(t.x - r.x)}px,${f(t.y - r.y)}px,0) scale(${f(t.w / r.w, 5)})`;

export const f = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

const cache = new WeakMap();
/** Escreve estilo só quando muda (evita recálculos desnecessários a cada quadro). */
export function css(el, prop, value) {
  let c = cache.get(el);
  if (!c) cache.set(el, (c = {}));
  if (c[prop] === value) return;
  c[prop] = value;
  if (prop.startsWith('--')) el.style.setProperty(prop, value);
  else el.style[prop] = value;
}
export function on(el, flag) {
  if (el._on === flag) return;
  el._on = flag;
  el.classList.toggle('is-on', flag);
}
export const opacity = (el, v) => css(el, 'opacity', v <= 0.001 ? '0' : v >= 0.999 ? '1' : f(v, 3).toString());

/** Pré-carrega uma imagem para uso em canvas. */
export function loadImage(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  img.ready = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  return img;
}
export const usable = img => img && img.complete && img.naturalWidth > 0;

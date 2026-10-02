// Utilitários e estado compartilhado da experiência.
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Progresso 0→1 de u dentro do intervalo [a, b]. */
export const span = (u, a, b) => clamp((u - a) / (b - a));
export const smooth = t => t * t * (3 - 2 * t);
export const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);
export const inOut = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const sineInOut = t => 0.5 - 0.5 * Math.cos(Math.PI * t);
export const out = t => 1 - (1 - t) ** 3;
export const inn = t => t * t * t;
export const expoOut = t => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
/** Envelope: sobe em [a, b] e desce em [c, d]. */
export const env = (u, [a, b, c, d]) => smooth(span(u, a, b)) * (1 - smooth(span(u, c, d)));
/** Interpolação geométrica (para distâncias de câmera: a aproximação parece constante). */
export const glerp = (a, b, t) => a * (b / a) ** t;

/**
 * Palco: w/h é a área desenhada (100lvh), svh a altura visível com a barra do navegador.
 * unit = 1 "tela" de rolagem (100svh). mobile/portrait seguem as mesmas condições do CSS.
 */
export const view = { w: 1, h: 1, svh: 1, unit: 1, aspect: 1, dpr: 1, mobile: false, portrait: false, short: false, nav: 64 };
/** Ponteiro: x/y em px, nx/ny em -1…1, sx/sy suavizados (o que as câmeras usam). */
export const pointer = { x: -9999, y: -9999, nx: 0, ny: 0, sx: 0, sy: 0, at: -1e9, touch: false };
export const state = {
  u: 0,          // posição na jornada, em telas
  target: 0,
  vel: 0,        // telas por segundo
  now: 0,
  dt: 16,
  reduce: false,
  covered: false, // o palco está coberto pelo conteúdo final
  quality: 'high',
  busy: false,
};

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const f = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

const cache = new WeakMap();
/** Escreve estilo só quando muda. */
export function css(el, prop, value) {
  let c = cache.get(el);
  if (!c) cache.set(el, (c = {}));
  if (c[prop] === value) return;
  c[prop] = value;
  if (prop.startsWith('--')) el.style.setProperty(prop, value);
  else el.style[prop] = value;
}

/** Ruído determinístico (para posições de gotas, arranhões etc.). */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * Curva por quadros-chave com interpolação cúbica monótona (Fritsch–Carlson): passa por todos
 * os pontos, sem ultrapassar, com velocidade contínua (nada de "para e anda" entre chaves).
 * keys: [[x, y], ...] em ordem crescente de x.
 */
export function curve(keys) {
  const n = keys.length;
  const xs = keys.map(k => k[0]), ys = keys.map(k => k[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// Legendas dos capítulos: entram e saem conduzidas pela própria linha do tempo (como letreiros
// de filme), com os elementos chegando em sequência. A claquete mostra o capítulo atual.
import { $, $$, view, state, clamp, span, smooth, css } from './core.js';
import { C, CHAPTERS, chapterAt } from './chapters.js';

// Janela de cada legenda dentro do capítulo: [entra, entrou, sai, saiu] (0…1 do capítulo).
const WINDOWS = {
  abertura: [-1, -1, 0.13, 0.24],
  marca: [0.03, 0.1, 0.26, 0.33],
  lavagem: [0.1, 0.2, 0.68, 0.8],
  correcao: [0.32, 0.42, 0.82, 0.92],
  ceramic: [0.32, 0.42, 0.8, 0.9],
  camadas: [0.2, 0.3, 0.8, 0.9],
  ppf: [0.25, 0.35, 0.8, 0.9],
  interior: [0.36, 0.46, 0.82, 0.92],
  final: [0.8, 0.86, 0.95, 1.0],
  rota: [0.4, 0.48, 0.66, 0.74],
};

const caps = $$('.cap').map(el => ({ el, id: el.dataset.cap, parts: Array.from(el.children).filter(c => !c.classList.contains('sr-only')), on: null }));
const slate = $('.slate'), slateNum = $('.slate-num'), slateName = $('.slate-name');
const osm = $('.osm');
let slateId = null;

export function renderCaptions(u) {
  for (const c of caps) {
    const ch = C[c.id];
    const w = WINDOWS[c.id];
    if (!ch || !w) continue;
    const t = (u - ch.start) / ch.len;
    const a = state.reduce
      ? (t >= w[0] && t < w[2] ? 1 : 0)
      : smooth(span(t, w[0], w[1])) * (1 - smooth(span(t, w[2], w[3])));
    const on = a > 0.002;
    if (on !== c.on) { c.on = on; c.el.classList.toggle('is-on', on); }
    if (!on) continue;
    if (c.id === 'marca' && view.logoBase) css(c.el, '--y', `${Math.round(view.logoBase)}px`);
    // Cada linha entra um pouco depois da anterior.
    c.parts.forEach((p, i) => {
      const ai = state.reduce ? a : clamp(a * 1.6 - i * 0.18);
      css(p, '--a', ai.toFixed(3));
    });
  }
  const ch = chapterAt(u);
  const show = !!ch.num && !state.covered;
  if (show !== slate._on) { slate._on = show; slate.classList.toggle('is-on', show); }
  if (show && slateId !== ch.id) { slateId = ch.id; slateNum.textContent = ch.num; slateName.textContent = ch.name; }
  const map = u > C.rota.start + 0.6 && !state.covered;
  if (map !== osm._on) { osm._on = map; osm.classList.toggle('is-on', map); }
}

/** Ponto da jornada em que a legenda de um capítulo está inteira na tela. */
export function captionHold(id) {
  const w = WINDOWS[id];
  const ch = C[id];
  if (!w || !ch) return ch ? ch.start + ch.len * (ch.hold ?? 0.5) : 0;
  return ch.start + ch.len * Math.max(0, (w[1] + w[2]) / 2);
}

export { CHAPTERS };

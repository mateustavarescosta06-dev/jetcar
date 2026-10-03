// 02 · POLIMENTO. Sem vídeo e sem 3D: a macro da pintura presa, em três fotos alinhadas (renders da
// cena do polimento em alta resolução: a pintura limpa, os micro-riscos acesos e o reflexo da barra
// de luz; scripts/frames/build_polish.py) e a linha de luz que vem da Lavagem, com a mesma
// inclinação do fio d'água.
// Na ida (para a esquerda) a linha é a luz de inspeção: rente a ela os riscos acendem inteiros e,
// por onde passou, ficam marcados. Na volta (para a direita) a pintura fica limpa atrás dela, e o
// card 02 aparece quando ela passa por cima dele. Depois a barra acende: o reflexo perfeito.
// "Ver antes" compara com a pintura marcada. Tudo por janelas móveis (só transform por quadro).
import { $, $$, view, state, span, smooth, smoother, css, clamp, lerp } from '../core.js';
import { Act } from './act.js';
import { jet, placeWin, placeTrace, sizeBox } from '../win.js';

const T = { lit: [0.0, 0.09], pass1: [0.03, 0.33], pass2: [0.43, 0.72], draw: 0.08, refl: [0.7, 0.8], out: [0.92, 0.995] };

export class PolishAct extends Act {
  constructor(el) {
    super(el);
    this.paint = $('.paint', el);
    this.mid = $('.win-mid', el);
    this.band = $('.win-band', el);
    this.refl = $('.paint-refl', el);
    this.shade = $('.shade', el);
    this.trace = $('.trace', el);
    this.card = $('.card', el);
    this.beforeBtn = $('[data-explore="polish"]', el);
    this.before = false;
  }

  layout() {
    const s = this.stage.getBoundingClientRect();
    const w = s.width || view.w, h = this.stageH || view.h;
    this.w = w; this.h = h;
    sizeBox(this.paint, w, h);
    // a linha atravessa a tela inteira: as pontas ficam fora nos dois lados
    const reach = (h / 2) * Math.tan(jet.theta) + 24;
    this.xL = -reach;
    this.xR = w + reach;
    this.band.style.width = `${Math.round(view.portrait ? w * 0.42 : w * 0.17)}px`;
    // posição do card no palco (sem transformação: ele aparece por recorte)
    const c = this.card.getBoundingClientRect();
    this.cb = { x: c.left - s.left, y: c.top - s.top, w: c.width, h: c.height };
    this.crossAt = null;
  }

  holdFor() { return this.hold; }
  focusPoint(el) { return this.card.contains(el) ? this.hold : null; }
  explore(btn, { jump }) {
    if (!state.flat && Math.abs(this.raw - this.hold) > 0.1) jump(this.hold);
    this.setBefore(!this.before);
  }
  setBefore(on) {
    this.before = on;
    this.beforeBtn.setAttribute('aria-pressed', String(on));
    this.beforeBtn.firstChild.textContent = on ? 'Ver depois' : 'Ver antes';
    this.paint.classList.toggle('is-before', on);
  }

  /** x da linha no meio da altura do palco. */
  lineX(p) {
    if (p < T.pass2[0]) return lerp(jet.xm, this.xL, smoother(span(p, T.pass1[0], T.pass1[1])));
    return lerp(this.xL, this.xR, smoother(span(p, T.pass2[0], T.pass2[1])));
  }

  update() {
    const p = this.p, th = jet.theta;
    if (this.before && !state.flat && Math.abs(this.raw - this.hold) > 0.2) this.setBefore(false);
    const x = state.flat ? this.xR : this.lineX(p);
    // riscos marcados: tudo à direita da linha (na ida, por onde ela passou; na volta, o que falta)
    placeWin(this.mid, x, th);
    // a faixa rente à linha, só na ida (a luz de inspeção)
    const insp = state.flat ? 0 : smooth(span(p, T.pass1[0], T.pass1[0] + 0.04)) * (1 - smooth(span(p, T.pass1[1] - 0.05, T.pass1[1])));
    placeWin(this.band, x, th);
    css(this.band, 'opacity', insp.toFixed(3));
    placeTrace(this.trace, x, this.h / 2, th, 1, this.h);
    css(this.trace, 'opacity', state.flat ? '0' : '1');
    // a barra acende: o reflexo
    css(this.refl, 'opacity', state.flat ? '1' : smooth(span(p, T.refl[0], T.refl[1])).toFixed(3));
    const lit = state.flat ? 1 : smooth(span(p, T.lit[0], T.lit[1])) * (1 - smooth(span(p, T.out[0], T.out[1])));
    css(this.shade, 'opacity', (1 - lit).toFixed(3));
    this.reveal(p, x, th);
  }

  /** O card aparece atrás da linha quando ela passa por cima dele (na volta). */
  reveal(p, x, th) {
    const c = this.card, b = this.cb;
    if (state.flat || !b) { css(c, 'clip-path', ''); css(c, '--a', '1'); css(c, '--pe', 'auto'); css(c, '--draw', '1'); css(c, '--head', '0'); return; }
    const t = Math.tan(th), mid = this.h / 2;
    // x da linha na altura do topo e da base do card, no sistema do card
    const xt = x + (b.y - mid) * t - b.x, xb = x + (b.y + b.h - mid) * t - b.x;
    const pass2 = p >= T.pass2[0];
    let clip, k;
    if (!pass2 || Math.max(xt, xb) <= 0) { k = 0; clip = 'inset(0 100% 0 0)'; }
    else if (Math.min(xt, xb) >= b.w) { k = 1; clip = 'none'; }
    else { k = clamp((xt + xb) / 2 / b.w); clip = `polygon(0 0, ${xt.toFixed(1)}px 0, ${xb.toFixed(1)}px 100%, 0 100%)`; }
    const out = 1 - smooth(span(p, T.out[0] - 0.03, T.out[1] - 0.02));
    css(c, 'clip-path', clip);
    css(c, '--a', (k > 0 ? out : 0).toFixed(3));
    css(c, '--pe', k >= 1 && out > 0.5 ? 'auto' : 'none');
    // a borda é desenhada pela luz logo depois que o card inteiro aparece
    const cross = this.crossAt ?? (this.crossAt = this.pFor(b.x + b.w + Math.abs(b.h / 2 * t)));
    const draw = clamp((p - cross) / T.draw);
    css(c, '--draw', smooth(draw).toFixed(3));
    css(c, '--head', Math.sin(Math.PI * Math.min(1, draw)).toFixed(3));
  }

  /** p da volta em que a linha chega a x (para a borda do card começar a ser desenhada). */
  pFor(x) {
    const u = clamp((x - this.xL) / (this.xR - this.xL));
    // inversa aproximada de smoother: busca binária
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (smoother(m) < u) lo = m; else hi = m; }
    return lerp(T.pass2[0], T.pass2[1], (lo + hi) / 2);
  }
}

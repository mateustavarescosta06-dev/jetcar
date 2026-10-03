// 04 · PPF. A linha vertical que fechou o Ceramic é a borda da película. No desktop a macro da frente
// do carro abre à esquerda dela e o card fica ao lado; no celular a macro ocupa a tela e o card fica
// embaixo. A película atravessa a foto da direita para a esquerda: do lado dela a pintura protegida
// (um pouco mais de brilho e um reflexo largo, sem cor nenhuma; scripts/frames/build_ppf.py), na
// borda a linha de luz e uma sombra finíssima. Você arrasta a borda na foto ou no controle do card.
// Saída: a película escurece em vidro e o vidro ocupa a tela; o Interior começa no mesmo vidro.
import { $, view, state, span, smooth, smoother, css, clamp, lerp } from '../core.js';
import { Act, cardState } from './act.js';
import { placeWin, placeTrace, sizeBox } from '../win.js';

const T = { open: [0.0, 0.12], card: [0.05, 0.16], film1: [0.12, 0.4], film2: [0.56, 0.72], out: [0.72, 0.8], glass: [0.74, 0.97] };
const TILT = 0.05;   // a borda quase vertical, como uma folha deitada sobre a carroceria

export class PpfAct extends Act {
  constructor(el) {
    super(el);
    this.photo = $('.ppf-photo', el);
    this.win = $('.win-film', el);
    this.edge = $('.ppf-edge', el);
    this.cover = $('.ppf-cover', el);
    this.glass = $('.glass', el);
    this.card = $('.card', el);
    this.flOff = $('.fl-off', el); this.flOn = $('.fl-on', el);
    this.input = $('#film', el);
    this.f = 0; this.userF = null;
    this.input.addEventListener('input', () => { this.userF = this.input.value / 100; this.userAt = this.raw; });
    this.input.addEventListener('focus', () => { if (state.flat) this.update(16); });
    // arrastar a borda na própria foto (horizontal; o gesto vertical continua rolando a página)
    let drag = null;
    this.photo.addEventListener('pointerdown', e => { drag = { x: e.clientX, f: this.f }; });
    addEventListener('pointermove', e => {
      if (!drag) return;
      this.userF = clamp(drag.f - (e.clientX - drag.x) / Math.max(1, this.pw * (1 - this.f0)));
      this.userAt = this.raw;
    });
    const end = () => { drag = null; };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
  }

  layout() {
    const s = this.stage.getBoundingClientRect(), r = this.photo.getBoundingClientRect();
    this.px = r.left - s.left; this.pw = r.width || view.w; this.ph = r.height || view.h;
    sizeBox(this.photo, this.pw, this.ph);
    sizeBox(this.stage, s.width || view.w, this.stageH || view.h);   // o vidro cobre o palco
    // a borda começa onde ficou a linha do Ceramic (a costura: --seam no CSS)
    const seam = this.stage.querySelector('.seam')?.getBoundingClientRect();
    const sx = seam && seam.width ? seam.left - s.left + seam.width / 2 : this.px + this.pw;
    this.f0 = clamp(1 - (sx - this.px) / this.pw);
    this.sh = this.stageH || view.h;
    this.flOffW = this.flOff.offsetWidth; this.flOnW = this.flOn.offsetWidth;
  }

  holdFor() { return this.hold; }
  focusPoint(el) { return this.card.contains(el) ? this.hold : null; }
  explore(btn, { jump }) {
    this.userF = null;
    if (state.flat) { this.input.focus({ preventScroll: true }); return; }
    jump(this.hold, this.input);
  }
  settle() { this.update(16); this.f = this.fTarget; this.update(16); }
  get animating() { return Math.abs(this.f - (this.fTarget ?? this.f)) > 1e-3; }

  update(dt = 16) {
    const p = this.p;
    // película: a rolagem leva até a metade (ponto de leitura) e depois até o fim; a pessoa assume
    // quando mexe, até rolar para longe
    const base = state.flat ? 0.5 : smoother(span(p, T.film1[0], T.film1[1])) * 0.5 + smoother(span(p, T.film2[0], T.film2[1])) * 0.5;
    if (this.userF != null && !state.flat && Math.abs(this.raw - this.userAt) > 0.08) this.userF = null;
    this.fTarget = this.userF ?? base;
    const k = state.reduce ? 1 : 1 - Math.exp(-dt / 80);
    this.f += (this.fTarget - this.f) * k;
    if (Math.abs(this.f - this.fTarget) < 1e-4) this.f = this.fTarget;
    if (document.activeElement !== this.input) this.input.value = Math.round(this.f * 100);
    const fv = Number(this.input.value);
    if (fv !== this.said) { this.said = fv; this.input.setAttribute('aria-valuetext', fv < 3 ? 'Sem película' : fv > 97 ? 'Película na frente inteira' : `Película em ${fv}% da frente`); }

    // a borda: do lugar da costura (f = 0) até a borda esquerda da foto (f = 1)
    const x0 = (1 - this.f0) * this.pw, x1 = -this.ph * Math.tan(TILT) * 0.5 - 4;
    const x = lerp(x0, x1, this.f);
    placeWin(this.win, x, TILT);
    placeTrace(this.edge, this.px + x, this.sh / 2, TILT, 1, this.sh);

    // entrada: a foto e o card aparecem em volta da linha
    const open = state.flat ? 1 : smooth(span(p, T.open[0], T.open[1]));
    css(this.cover, 'opacity', (1 - open).toFixed(3));
    const a = cardState(this.card, p, [T.card[0], T.card[1], T.out[0], T.out[1]], 0.1);
    css(this.card, '--tx', state.flat ? '0px' : `${(-(1 - a) * 28).toFixed(1)}px`);
    // rótulos dos dois lados da borda (cada um só aparece se cabe inteiro do seu lado)
    const labels = state.flat ? 1 : open * (1 - smooth(span(p, T.out[0], T.out[1])));
    css(this.flOff, 'opacity', (x - 16 - this.flOffW >= 12 ? labels : 0).toFixed(3));
    css(this.flOn, 'opacity', (this.pw - x - 16 - this.flOnW >= 12 && this.f > 0.02 ? labels : 0).toFixed(3));
    css(this.flOff, 'transform', `translate3d(${(x - 16 - this.flOffW).toFixed(1)}px,0,0)`);
    css(this.flOn, 'transform', `translate3d(${(x + 16).toFixed(1)}px,0,0)`);
    // saída: a película vira vidro e o vidro ocupa a tela
    css(this.glass, 'opacity', state.flat ? '0' : smooth(span(p, T.glass[0], T.glass[1])).toFixed(3));
  }
}

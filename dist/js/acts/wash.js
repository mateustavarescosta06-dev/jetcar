// 01 · LAVAGEM. O filme do hero parou: aqui é a foto 2560 do mesmo quadro, presa por baixo dele
// (passagem no lugar), então o corte não aparece. A foto é feita de dois planos (o galpão atrás e o
// carro na frente, separados por um mapa de profundidade com borda suave) e o carro chega só um pouco
// mais perto que o fundo enquanto você rola; o card desliza do primeiro plano, maior, e assenta. "Ver de perto" aproxima até as gotas no capô, com o recorte no tamanho do
// intermediário (nítido de verdade, não a foto ampliada).
// Saída: a borda do jato acende, a luz corre pela água, vira a linha de luz inteira e a foto apaga em
// volta dela. O Polimento começa no preto com a mesma linha, no mesmo lugar.
import { $, view, state, span, smooth, smoother, css, clamp } from '../core.js';
import { Act, cardState } from './act.js';
import { measureJet, jet, placeTrace } from '../win.js';

const T = { card: [0.04, 0.2], out: [0.54, 0.64], glint: [0.58, 0.68], grow: [0.66, 0.84], shade: [0.7, 0.96] };
// região do recorte de perto, em fração do quadro (scripts/frames/build_stills.py)
const DETAIL = { u0: 0.55, v0: 0.3, u1: 0.95, v1: 0.75 };
const SQUARE = [0.2505, 0.8142];

export class WashAct extends Act {
  constructor(el) {
    super(el);
    this.photo = $('.wash-photo', el);
    this.box = $('.reel-box', el);
    this.detail = $('.wash-detail', el);
    this.far = $('.wash-still', el);
    this.near = $('.wash-near', el);
    this.shade = $('.shade', el);
    this.trace = $('.trace', el);
    this.card = $('.card', el);
    this.zoomBtn = $('[data-explore="wash"]', el);
    this.zoom = false;
  }

  layout() {
    const s = this.stage.getBoundingClientRect(), r = this.box.getBoundingClientRect();
    const sw = s.width || view.w, sh = this.stageH || view.h;
    const box = { left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height };
    measureJet(box, sw, sh, view.portrait);
    this.sh = sh;
    this.L = this.trace.offsetHeight || 3 * Math.max(view.w, view.h);
    // o quadro inteiro (16:9) dentro da caixa: cover no desktop, o recorte quadrado no celular
    let fx, fy, fw, fh;
    if (view.portrait) { fw = box.width / (SQUARE[1] - SQUARE[0]); fh = box.height; fx = -SQUARE[0] * fw; fy = 0; }
    else { const k = Math.max(box.width / (1920 / 1082), box.height); fh = k; fw = k * 1920 / 1082; fx = (box.width - fw) / 2; fy = (box.height - fh) / 2; }
    // o recorte de perto exatamente sobre a mesma região da foto
    css(this.detail, 'left', `${(fx + DETAIL.u0 * fw).toFixed(1)}px`);
    css(this.detail, 'top', `${(fy + DETAIL.v0 * fh).toFixed(1)}px`);
    css(this.detail, 'width', `${((DETAIL.u1 - DETAIL.u0) * fw).toFixed(1)}px`);
    css(this.detail, 'height', `${((DETAIL.v1 - DETAIL.v0) * fh).toFixed(1)}px`);
    // aproximação: o centro das gotas (no celular, dentro do quadrado)
    const cu = view.portrait ? 0.68 : 0.76, cv = 0.56;
    this.box.style.transformOrigin = `${((fx + cu * fw) / box.width * 100).toFixed(2)}% ${((fy + cv * fh) / box.height * 100).toFixed(2)}%`;
  }

  holdFor() { return this.hold; }
  focusPoint(el) { return this.card.contains(el) ? this.hold : null; }

  explore(btn, { jump }) {
    // fora do ponto de leitura, primeiro leva até lá
    if (!state.flat && Math.abs(this.raw - this.hold) > 0.12) jump(this.hold);
    this.setZoom(!this.zoom);
  }
  setZoom(on) {
    this.zoom = on;
    this.zoomBtn.setAttribute('aria-pressed', String(on));
    if (on && !this.detail.src) {
      this.detail.src = this.detail.dataset.src;
      this.detail.decode?.().catch(() => {}).then(() => this.photo.classList.toggle('has-detail', true));
    }
    this.photo.classList.toggle('is-zoom', on);
  }

  update() {
    const p = this.p;
    // card: sobe do primeiro plano (de baixo, um pouco maior) e assenta; a borda é desenhada depois
    const a = cardState(this.card, p, [T.card[0], T.card[1], T.out[0], T.out[1]], 0.1);
    const k = state.flat ? 1 : smoother(span(p, T.card[0], T.card[1]));
    const e = state.flat ? 0 : smooth(span(p, T.out[0], T.out[1]));
    css(this.card, '--ty', `${((1 - k) * 20 - e * 14).toFixed(1)}px`);
    css(this.card, '--sc', (1 + (1 - k) * 0.02).toFixed(4));
    css(this.card, 'opacity', state.flat ? '' : clamp(smooth(span(p, T.card[0], T.card[0] + 0.08)) * (1 - e)).toFixed(3));
    // longe do ponto de leitura a aproximação desfaz (a saída é sempre com a foto inteira)
    if (this.zoom && !state.flat && Math.abs(this.raw - this.hold) > 0.2) this.setZoom(false);
    if (state.flat) return;
    // planos: o carro chega um pouco mais perto que o galpão atrás dele (no começo do ato as duas
    // camadas coincidem: é o mesmo quadro em que o filme parou)
    const depth = smooth(span(p, 0, T.out[1]));
    css(this.far, 'transform', `scale(${(1 + 0.006 * depth).toFixed(5)})`);
    css(this.near, 'transform', `scale(${(1 + 0.02 * depth).toFixed(5)})`);
    // saída: o fio d'água acende, a luz corre por ele e vira a linha inteira; a foto apaga em volta
    const glint = smooth(span(p, T.glint[0], T.glint[1]));
    const grow = smoother(span(p, T.grow[0], T.grow[1]));
    const k0 = jet.len / this.L;
    const x = jet.x + (jet.xm - jet.x) * grow, y = jet.y + (this.sh / 2 - jet.y) * grow;
    placeTrace(this.trace, x, y, jet.theta, k0 + (1 - k0) * grow, this.sh);
    css(this.trace, 'opacity', glint.toFixed(3));
    css(this.shade, 'opacity', smooth(span(p, T.shade[0], T.shade[1])).toFixed(3));
  }
}

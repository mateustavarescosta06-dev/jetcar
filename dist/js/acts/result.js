// RESULTADO. A foto inteira do carro pronto, parada: uma pausa, sem efeito nenhum. O título já está
// na tela quando ela chega (a seção sobe como uma página); no fim do trecho preso o título sai e o
// filme final começa no mesmo quadro (passagem no lugar: a foto é o quadro 84 do filme, em 4K).
import { $, state, span, smooth, css } from '../core.js';
import { Act } from './act.js';

export class ResultAct extends Act {
  constructor(el) {
    super(el);
    this.copy = $('.result-copy', el);
    this.scrim = $('.result-scrim', el);
  }
  focusPoint(el) { return this.copy.contains(el) ? this.hold : null; }
  update() {
    const a = state.flat ? 1 : 1 - smooth(span(this.p, 0.74, 0.97));
    css(this.copy, '--a', a.toFixed(3));
    css(this.scrim, 'opacity', a.toFixed(3));
  }
}

// ENDEREÇO. A linha de luz vira a rota: pela Avenida Boa Viagem até a Rua José Trajano.
// O mapa é um SVG (dados do OpenStreetMap) carregado inline; a rolagem desenha a rota e, no
// fim, o destino acende e a última tela segura o endereço, o pedido da pessoa e o botão.
import { $, view, state, clamp, span, smooth, smoother } from '../core.js';
import { Act } from './act.js';

export class RouteAct extends Act {
  constructor(el) {
    super(el);
    this.map = $('.route-map', el);
    this.copy = $('.route-copy', el);
  }

  load() {
    return fetch('assets/route.svg').then(r => r.text()).then(txt => {
      const box = document.createElement('div');
      box.innerHTML = txt;
      const svg = box.querySelector('svg');
      if (!svg) return;
      svg.setAttribute('aria-hidden', 'true');
      svg.removeAttribute('role');
      this.map.replaceChildren(svg);
      this.svg = svg;
      this.line = svg.querySelector('.route-line');
      this.halo = svg.querySelector('.route-halo');
      this.dest = svg.querySelector('.route-dest');
      this.names = [...svg.querySelectorAll('.route-name')];
      for (const l of [this.line, this.halo]) l.style.strokeDasharray = '1 1';
      this.layout();
    }).catch(() => {});
  }

  layout() {
    if (!this.svg) return;
    // no celular a rota fica centrada na parte de cima (o texto ocupa a de baixo)
    this.svg.setAttribute('viewBox', view.mobile ? '-420 -520 760 1180' : '-760 -560 1600 1000');
  }

  update() {
    const p = this.p;
    const draw = state.reduce ? 1 : smoother(span(p, 0.05, 0.78));
    if (this.line) {
      const off = (1 - draw).toFixed(4);
      this.line.style.strokeDashoffset = off;
      this.halo.style.strokeDashoffset = off;
      const arrive = state.reduce ? 1 : smooth(span(p, 0.74, 0.86));
      this.dest.style.opacity = (0.25 + 0.75 * arrive).toFixed(3);
      this.dest.style.transformBox = 'fill-box';
      for (const n of this.names) n.style.opacity = (0.4 + 0.6 * clamp(draw * 1.5)).toFixed(3);
    }
    this.copy.style.setProperty('--a', (state.reduce ? 1 : smooth(span(p, 0.0, 0.2))).toFixed(3));
  }
}

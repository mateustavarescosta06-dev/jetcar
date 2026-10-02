// 05 · INTERIOR. Fotografia em dois planos (a carroceria com a moldura da porta na frente, a
// cabine atrás) e um vidro entre a câmera e o carro. A linha de luz passa como um reflexo e
// limpa o vidro; a câmera avança pela abertura da porta (a moldura cresce mais rápido que a
// cabine e sai do quadro); depois a cena PARA e vira uma composição para explorar, com pontos
// discretos (banco, volante, acabamentos, superfícies) que mudam o texto do card 05.
// As camadas saem de scripts/frames/interior_layers.py.
import { $, $$, view, pointer, state, clamp, lerp, span, smooth, smoother, css } from '../core.js';
import { Act, cardState } from './act.js';

// pontos no espaço da foto (0…1), escolhidos para caber nos enquadramentos finais do desktop e
// do celular sem cair embaixo do card
const SPOTS = {
  banco: { u: 0.545, v: 0.43, text: 'Banco: tecido, couro e outros revestimentos pedem cuidados diferentes. Conte qual é o do seu carro.' },
  acabamentos: { u: 0.66, v: 0.56, text: 'Acabamentos: costuras, frisos e os cantos entre o banco e o console, onde a sujeira se acumula.' },
  superficies: { u: 0.78, v: 0.505, text: 'Superfícies: painel, console e as laterais das portas.' },
  volante: { u: 0.879, v: 0.33, text: 'Volante: é onde a mão fica o tempo todo. Entra na higienização junto com os comandos em volta.' },
};
const ASPECT = 3072 / 2048;
// janela visível da foto (centro u,v e largura w, em fração da foto): começa na foto inteira e
// termina na cabine (a área escura atrás da carroceria fica fora do quadro)
const VIEW = {
  d: { from: { u: 0.5, v: 0.5, w: 0.98 }, to: { u: 0.73, v: 0.47, w: 0.54 } },
  m: { from: { u: 0.6, v: 0.52, w: 0.7 }, to: { u: 0.7, v: 0.5, w: 0.46 } },
};

export class InteriorAct extends Act {
  constructor(el) {
    super(el);
    this.cabin = $('.cabin', el);
    this.far = $('.cabin-far', el);
    this.near = $('.cabin-near', el);
    this.glass = $('.cabin-glass', el);
    this.band = document.createElement('i');
    this.band.className = 'cabin-band';
    this.cabin.append(this.band);
    this.card = $('.card', el);
    this.text = $('[data-spot-text]', el);
    this.defaultText = this.text.textContent;
    this.spots = $$('.spot', el);
    for (const b of this.spots) b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      for (const o of this.spots) o.setAttribute('aria-pressed', String(o === b && on));
      this.text.textContent = on ? SPOTS[b.dataset.spot].text : this.defaultText;
      this.layout();   // o card muda de altura com o texto
      this.update();
    });
  }

  explore(btn, { jump }) { jump(this.hold, this.spots[0]); }
  focusPoint(el) { return el.closest('.spot') || this.card.contains(el) ? this.hold : null; }

  layout() {
    const r = this.cabin.getBoundingClientRect();
    this.bw = r.width || view.w;
    this.bh = r.height || view.h;
    this.V = view.portrait ? VIEW.m : VIEW.d;
    // área do card dentro da cabine (um ponto embaixo dele fica escondido)
    const c = this.card.getBoundingClientRect();
    this.cardBox = { l: c.left - r.left - 28, r: c.right - r.left + 28, t: c.top - r.top - 28, b: c.bottom - r.top + 28 };
  }

  /** Janela da foto → posição e tamanho do <img> na tela (a janela cobre o palco). */
  frame(win) {
    const Wd = Math.max(this.bw / win.w, this.bh * ASPECT);
    const Hd = Wd / ASPECT;
    return { Wd, Hd, x: this.bw / 2 - win.u * Wd, y: this.bh / 2 - win.v * Hd };
  }
  place(el, f) {
    css(el, 'width', `${Math.round(f.Wd)}px`);
    css(el, 'transform', `translate3d(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px, 0)`);
  }

  update() {
    const p = this.p;
    if (!this.V) this.layout();
    // vidro: reflexo do galpão por cima; a linha passa e limpa
    const wipe = smoother(span(p, 0.04, 0.3));
    const glass = 1 - smooth(span(p, 0.26, 0.34));
    this.glass.style.setProperty('--wipe', `${(wipe * 112 - 6).toFixed(2)}%`);
    this.glass.style.setProperty('--glass', glass.toFixed(3));
    css(this.band, 'transform', `translate3d(${((wipe * 1.12 - 0.06) * this.bw).toFixed(1)}px, 0, 0) skewX(-8deg)`);
    css(this.band, 'opacity', (wipe > 0.001 && wipe < 0.999 ? 1 : 0).toString());
    // avanço pela porta: a cabine (longe) aproxima; a moldura (perto) cresce mais rápido e sai
    const push = smoother(span(p, 0.16, 0.6));
    const px = state.reduce ? 0 : pointer.sx, py = state.reduce ? 0 : pointer.sy;
    const A = this.V.from, B = this.V.to;
    const win = { u: lerp(A.u, B.u, push) + px * 0.004, v: lerp(A.v, B.v, push) + py * 0.003, w: lerp(A.w, B.w, push) };
    const nwin = { u: win.u - push * 0.16 + px * 0.009, v: win.v + push * 0.05 + py * 0.006, w: win.w / (1 + push * 1.3) };
    const f = this.frame(win), n = this.frame(nwin);
    this.place(this.far, f);
    this.place(this.near, n);
    css(this.near, 'opacity', (1 - smooth(span(p, 0.5, 0.6))).toFixed(3));
    // pontos e card: depois que a câmera para
    const a = cardState(this.card, p, [0.5, 0.6], 0.12);
    this.spots.forEach((b, i) => {
      const s = SPOTS[b.dataset.spot];
      const x = f.x + s.u * f.Wd, y = f.y + s.v * f.Hd;
      const ai = clamp((a - i * 0.12) / 0.6);
      const k = this.cardBox;
      const underCard = x > k.l && x < k.r && y > k.t && y < k.b;
      const inView = x > 30 && x < this.bw - 30 && y > 70 && y < this.bh - 20 && !underCard;
      // na metade direita o nome abre para a esquerda (não passa por cima do card)
      b.classList.toggle('is-flip', x > this.bw * 0.55);
      b.style.setProperty('--sx', `${Math.round(x)}px`);
      b.style.setProperty('--sy', `${Math.round(y)}px`);
      b.style.setProperty('--a', (inView ? ai : 0).toFixed(3));
      b.style.setProperty('--pe', inView && ai > 0.5 ? 'auto' : 'none');
    });
  }
}

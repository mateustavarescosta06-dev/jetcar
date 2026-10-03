// 05 · INTERIOR. Fotografia em dois planos (a carroceria com a moldura da porta na frente, a cabine
// atrás). Começa no vidro escuro em que o PPF terminou (passagem no lugar): a linha de luz passa e
// limpa o vidro, e a câmera chega devagar à cabine (pouco movimento: a moldura da porta sai do
// quadro). Depois a cena PARA: pontos para tocar (couro, acabamentos, superfícies, detalhes); o
// primeiro acende sozinho e o card 05 nasce dele. Cada ponto mostra uma lupa parada ao lado dele
// (a foto de 4608 px, perto do tamanho real) e muda o texto do card.
// As camadas saem de scripts/frames/interior_layers.py.
import { $, $$, view, pointer, state, clamp, lerp, span, smooth, smoother, css } from '../core.js';
import { Act } from './act.js';
import { placeWin, placeTrace, sizeBox } from '../win.js';

// pontos no espaço da foto (0…1), escolhidos para caber nos enquadramentos finais do desktop e
// do celular sem cair embaixo do card
const SPOTS = {
  couro: { u: 0.545, v: 0.43, text: 'Couro: limpeza e hidratação de acordo com o revestimento. Tecido, couro e outros materiais pedem cuidados diferentes, então conte qual é o do seu carro.' },
  acabamentos: { u: 0.66, v: 0.56, text: 'Acabamentos: costuras, frisos e os cantos entre o banco e o console, onde a sujeira se acumula.' },
  superficies: { u: 0.78, v: 0.505, text: 'Superfícies: painel, console e as laterais das portas.' },
  detalhes: { u: 0.879, v: 0.33, text: 'Detalhes: volante, comandos e saídas de ar, onde a mão fica o tempo todo.' },
};
const ASPECT = 3072 / 2048;
// recorte do celular (far-m/near-m): u 0,34…1 da foto, altura inteira
const CROP_M = { u0: 0.34, u1: 1 };
// janela visível da foto (centro u,v e largura w, em fração da foto): pouco movimento, só a chegada
const VIEW = {
  d: { from: { u: 0.69, v: 0.48, w: 0.62 }, to: { u: 0.73, v: 0.47, w: 0.54 } },
  m: { from: { u: 0.66, v: 0.51, w: 0.52 }, to: { u: 0.7, v: 0.5, w: 0.46 } },
};
const T = { wipe: [0.03, 0.3], push: [0.12, 0.5], near: [0.34, 0.46], spots: [0.36, 0.5], auto: 0.5, card: [0.52, 0.64] };
const TILT = 0.14;
const LOUPE = 1.7;   // aumento da lupa em relação à foto na tela (perto do tamanho real da foto de 4608 px)

export class InteriorAct extends Act {
  constructor(el) {
    super(el);
    this.cabin = $('.cabin', el);
    this.far = $('.cabin-far', el);
    this.near = $('.cabin-near', el);
    this.glass = $('.glass', el);
    this.trace = $('.trace', el);
    this.card = $('.card', el);
    this.loupe = $('.loupe', el);
    this.text = $('[data-spot-text]', el);
    this.defaultText = this.text.textContent;
    this.spots = $$('.spot', el);
    this.active = null;     // ponto escolhido pela pessoa
    this.auto = false;      // o primeiro ponto aceso sozinho
    for (const b of this.spots) {
      b.addEventListener('click', () => this.pick(b.getAttribute('aria-pressed') === 'true' ? null : b));
      // a lupa aparece com o ponteiro ou o foco em cima do ponto (e some quando sai)
      b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') this.peek(b); });
      b.addEventListener('pointerleave', () => this.peek(null));
      b.addEventListener('focus', () => this.peek(b));
      b.addEventListener('blur', () => this.peek(null));
    }
  }

  pick(b) {
    this.active = b;
    for (const o of this.spots) o.setAttribute('aria-pressed', String(o === b));
    this.text.textContent = b ? SPOTS[b.dataset.spot].text : this.defaultText;
    this.born = true;   // escolher um ponto antes do card chegar faz o card nascer na hora
    this.peek(b);
    this.layout();      // o card muda de altura com o texto
    this.update();
  }
  peek(b) { this.peeking = b; this.update(); }

  // sem pontos (sem JS ou sem a cena), o foco vai para o card
  explore(btn, { jump }) { jump(this.hold, this.spots[0].offsetParent ? this.spots[0] : this.card.querySelector('.card-add')); }
  focusPoint(el) { return el.closest('.spot') || this.card.contains(el) ? this.hold : null; }

  layout() {
    const r = this.cabin.getBoundingClientRect(), s = this.stage.getBoundingClientRect();
    this.bw = r.width || view.w;
    this.bh = r.height || view.h;
    this.sh = this.stageH || view.h;
    sizeBox(this.stage, s.width || view.w, this.sh);
    this.V = view.portrait ? VIEW.m : VIEW.d;
    // a <picture> escolhe o recorte do celular pela mesma condição de view.portrait
    this.crop = view.portrait ? CROP_M : null;
    // área do card dentro da cabine (um ponto embaixo dele fica escondido)
    const c = this.card.getBoundingClientRect();
    this.cardBox = { l: c.left - r.left - 28, r: c.right - r.left + 28, t: c.top - r.top - 28, b: c.bottom - r.top + 28 };
    this.cardC = { x: c.left - r.left + c.width / 2, y: c.top - r.top + c.height / 2 };
    const reach = (this.sh / 2) * Math.tan(TILT) + 24;
    this.xL = -reach; this.xR = (s.width || view.w) + reach;
    this.loupeSize = this.loupe.offsetWidth || 180;
  }

  /** Janela da foto → posição e tamanho do <img> na tela (a janela cobre o palco). */
  frame(win) {
    const Wd = Math.max(this.bw / win.w, this.bh * ASPECT);
    const Hd = Wd / ASPECT;
    return { Wd, Hd, x: this.bw / 2 - win.u * Wd, y: this.bh / 2 - win.v * Hd };
  }
  place(el, f) {
    const c = this.crop || { u0: 0, u1: 1 };
    // posição em pixels inteiros do aparelho: parada, a foto não é reamostrada pela metade de um pixel
    const d = view.dpr || 1, snap = v => (Math.round(v * d) / d).toFixed(2);
    css(el, 'width', `${snap(f.Wd * (c.u1 - c.u0))}px`);
    css(el, 'transform', `translate3d(${snap(f.x + c.u0 * f.Wd)}px, ${snap(f.y)}px, 0)`);
  }
  /** Com o recorte, a janela não pode sair dele (a imagem tem que cobrir o palco). */
  fit(f) {
    if (this.crop) f.x = clamp(f.x, this.bw - this.crop.u1 * f.Wd, -this.crop.u0 * f.Wd);
    return f;
  }

  update() {
    const p = this.p;
    if (!this.V) this.layout();
    // vidro: o mesmo do fim do PPF; a linha passa e limpa (o vidro fica só à direita dela)
    const wipe = state.flat ? 1 : smoother(span(p, T.wipe[0], T.wipe[1]));
    const x = lerp(this.xL, this.xR, wipe);
    placeWin(this.glass, x, TILT);
    css(this.glass, 'visibility', wipe >= 1 ? 'hidden' : '');
    placeTrace(this.trace, x, this.sh / 2, TILT, 1, this.sh);
    css(this.trace, 'opacity', wipe > 0 && wipe < 1 ? '1' : '0');
    // chegada à cabine: pouco movimento; a moldura da porta (perto) anda mais e sai
    const push = state.flat ? 1 : smoother(span(p, T.push[0], T.push[1]));
    const px = state.reduce ? 0 : pointer.sx, py = state.reduce ? 0 : pointer.sy;
    const A = this.V.from, B = this.V.to;
    const win = { u: lerp(A.u, B.u, push) + px * 0.003, v: lerp(A.v, B.v, push) + py * 0.002, w: lerp(A.w, B.w, push) };
    const nwin = { u: win.u - push * 0.1 + px * 0.006, v: win.v + push * 0.03 + py * 0.004, w: win.w / (1 + push * 0.6) };
    const f = this.fit(this.frame(win)), n = this.fit(this.frame(nwin));
    this.f = f;
    this.place(this.far, f);
    this.place(this.near, n);
    css(this.near, 'opacity', state.flat ? '0' : (1 - smooth(span(p, T.near[0], T.near[1]))).toFixed(3));

    // pontos: aparecem depois que a câmera para; o primeiro acende sozinho e o card nasce dele
    const spotsA = state.flat ? 1 : smooth(span(p, T.spots[0], T.spots[1]));
    const autoOn = !state.flat && p >= T.auto && p < 0.97 && !this.active;
    if (autoOn !== this.auto) { this.auto = autoOn; this.spots[0].classList.toggle('is-auto', autoOn); }
    const first = this.spots[0];
    this.spots.forEach((b, i) => {
      const s = SPOTS[b.dataset.spot];
      const sx = f.x + s.u * f.Wd, sy = f.y + s.v * f.Hd;
      const ai = clamp((spotsA - i * 0.14) / 0.58);
      const k = this.cardBox;
      const underCard = sx > k.l && sx < k.r && sy > k.t && sy < k.b;
      const inView = sx > 30 && sx < this.bw - 30 && sy > 70 && sy < this.bh - 20 && !underCard;
      // na metade direita o nome abre para a esquerda (não passa por cima do card)
      b.classList.toggle('is-flip', sx > this.bw * 0.55);
      b.style.setProperty('--sx', `${Math.round(sx)}px`);
      b.style.setProperty('--sy', `${Math.round(sy)}px`);
      b.style.setProperty('--a', (inView ? ai : 0).toFixed(3));
      b.style.setProperty('--pe', inView && ai > 0.5 ? 'auto' : 'none');
      b._at = [sx, sy];
    });
    // card: nasce do primeiro ponto (cresce a partir do lado dele) depois que ele acende
    const born = state.flat || this.born ? 1 : smoother(span(p, T.card[0], T.card[1]));
    const c = this.card;
    const [fx, fy] = first._at || [0, 0];
    css(c, '--a', born.toFixed(3));
    css(c, '--pe', born > 0.5 ? 'auto' : 'none');
    css(c, '--ox', `${(fx - this.cardC.x).toFixed(0)}px`);
    css(c, '--oy', `${(fy - this.cardC.y).toFixed(0)}px`);
    css(c, '--grow', born.toFixed(3));
    const draw = state.flat || this.born ? 1 : clamp((p - T.card[1] + 0.02) / 0.1);
    css(c, '--draw', smooth(draw).toFixed(3));
    css(c, '--head', Math.sin(Math.PI * Math.min(1, draw)).toFixed(3));
    if (p < T.card[0] - 0.05 && !state.flat) this.born = false;
    this.renderLoupe();
  }

  /** A lupa: parada ao lado do ponto, com a foto grande aumentada (nunca segue o cursor). */
  renderLoupe() {
    const b = this.peeking || this.active, L = this.loupe, f = this.f;
    const on = !!b && !!f && Number(b.style.getPropertyValue('--a')) > 0.5;
    L.classList.toggle('is-on', on);
    if (!on) return;
    const [sx, sy] = b._at;
    const size = this.loupeSize;
    // ao lado do ponto, do lado oposto ao nome; dentro da cabine
    const flip = b.classList.contains('is-flip');
    const lx = clamp(flip ? sx + 30 : sx - 30 - size, 8, this.bw - size - 8);
    const ly = clamp(sy - size - 24, 70, this.bh - size - 8);
    css(L, 'transform', `translate3d(${lx.toFixed(0)}px,${ly.toFixed(0)}px,0)`);
    // a imagem da lupa: a mesma foto, LOUPE vezes maior, centrada no ponto
    const img = this.far.currentSrc || this.far.src;
    const c = this.crop || { u0: 0, u1: 1 };
    const W = f.Wd * (c.u1 - c.u0) * LOUPE, H = f.Hd * LOUPE;
    const ix = (sx - (f.x + c.u0 * f.Wd)) * LOUPE, iy = (sy - f.y) * LOUPE;
    const inner = L.firstElementChild;
    if (inner._src !== img) { inner._src = img; inner.style.backgroundImage = `url("${img}")`; }
    css(inner, 'backgroundSize', `${W.toFixed(0)}px ${H.toFixed(0)}px`);
    css(inner, 'backgroundPosition', `${(size / 2 - ix).toFixed(0)}px ${(size / 2 - iy).toFixed(0)}px`);
  }
}

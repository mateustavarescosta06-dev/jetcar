// Um ato: uma seção alta com um palco preso. A rolagem dentro da seção vira o progresso p (0…1)
// do ato; cada ato decide o que p significa na sua cena. Atos com WebGL compartilham uma única
// tela (o app move o canvas para o palco do ato mais visível).
import { $, view, state, clamp } from '../core.js';

export class Act {
  constructor(el) {
    this.el = el;
    this.id = el.dataset.act;
    this.stage = $('.stage', el);
    this.slot = $('.gl-slot', el);
    this.spanD = Number(el.dataset.span || 0);
    this.spanM = Number(el.dataset.spanM ?? el.dataset.span ?? 0);
    this.hold = Number(el.dataset.hold ?? 0);
    this.gl = false;        // desenha no WebGL
    this.ready = true;      // assets carregados
    this.top = 0;           // posição da seção na página (px)
    this.travel = 0;        // rolagem presa (px)
    this.raw = 0;           // progresso sem suavização
    this.p = 0;             // progresso suavizado
    this.vis = 0;           // fração da tela ocupada pelo palco
    this.visible = false;
    this.enter = 0;         // 0 quando o palco aparece embaixo, 1 quando prende
    this.leave = 0;         // 0 enquanto preso, 1 quando o palco saiu por cima
    this.snap = null;       // cópia 2D do último quadro (quando outro ato usa o canvas)
    this.snapKey = null;
    this.lag = 70;          // suavização do progresso (ms)
  }

  get span() { return state.reduce ? 0 : (view.mobile ? this.spanM : this.spanD); }

  /** Altura da seção e posição (o app chama depois de cada mudança de layout). */
  setHeight() {
    this.el.style.height = state.reduce || this.span === 0 ? '' : `${Math.round((this.span + 1) * view.svh)}px`;
  }
  measure(scrollY) {
    this.top = this.el.getBoundingClientRect().top + scrollY;
    this.travel = this.span * view.svh;
    this.height = this.el.offsetHeight;
  }

  /** Progresso alvo para uma posição de rolagem. */
  progressAt(y) {
    if (state.reduce || this.travel <= 0) return this.forced ?? this.hold;
    return clamp((y - this.top) / this.travel);
  }
  /** Rolagem (px) que leva o ato até o progresso p. */
  scrollFor(p) { return Math.round(this.top + (state.reduce ? 0 : p * this.travel)); }
  /** Ponto de leitura para âncoras (o id pode escolher outro ponto dentro do ato). */
  holdFor() { return this.hold; }

  /** Atualiza visibilidade e progresso a cada quadro. */
  track(y, dt) {
    const vh = view.h;
    let top;
    if (state.reduce || this.travel <= 0) top = this.top - y;
    else top = y < this.top ? this.top - y : y > this.top + this.travel ? this.top + this.travel - y : 0;
    const stageH = this.stage ? this.stage.offsetHeight || vh : vh;
    const a = Math.max(0, top), b = Math.min(vh, top + stageH);
    this.vis = clamp((b - a) / vh);
    this.visible = b > a + 1;
    this.enter = clamp(1 - (this.top - y) / vh);
    this.leave = this.travel > 0 ? clamp((y - this.top - this.travel) / vh) : clamp((y - this.top) / vh);
    this.raw = this.progressAt(y);
    if (state.reduce || state.jumping) this.p = this.raw;
    else {
      this.p += (this.raw - this.p) * (1 - Math.exp(-dt / this.lag));
      if (Math.abs(this.raw - this.p) < 1e-4) this.p = this.raw;
    }
  }

  /** Estado que define o quadro (para saber se a cópia 2D ainda vale). */
  key() { return Math.round(this.p * 2000); }

  load() { return Promise.resolve(); }
  layout() {}
  /** DOM do ato (cards, rótulos). Chamado enquanto visível. */
  update() {}
  /** WebGL: ajusta post e desenha. */
  render() {}
  /** Precisa de quadros mesmo sem rolagem (animação no tempo). */
  get animating() { return false; }
}

/** Envelope de um card: entra em [a, b], sai em [c, d] (sem sair se c ≥ 1). */
export function cardState(el, p, [a, b, c = 2, d = 3], drawSpan = 0.12) {
  const ein = clamp((p - a) / (b - a));
  const eout = c < 1.5 ? clamp((p - c) / (d - c)) : 0;
  const v = ein * (1 - eout);
  const ease = t => 1 - (1 - t) ** 3;
  const alpha = ease(v);
  // a borda é desenhada pela luz logo depois de o card chegar
  const draw = clamp((p - b + drawSpan * 0.35) / drawSpan);
  el.style.setProperty('--a', alpha.toFixed(3));
  el.style.setProperty('--pe', alpha > 0.5 ? 'auto' : 'none');
  el.style.setProperty('--draw', ease(draw).toFixed(3));
  el.style.setProperty('--head', Math.sin(Math.PI * Math.min(1, draw * 1.02)).toFixed(3));
  return alpha;
}

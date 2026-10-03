// Um ato: uma seção alta com um palco preso. A rolagem dentro da seção vira o progresso p (0…1)
// do ato; cada ato decide o que p significa na sua cena. Atos com WebGL compartilham uma única
// tela (o app move o canvas para o palco do ato mais visível).
import { $, $$, view, state, clamp, css } from '../core.js';

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
    this.lag = 45;          // suavização do progresso (ms): o Lenis já suaviza a roda, isto assenta os degraus da rolagem
    // passagem no lugar: o ato seguinte começa preso por baixo deste (data-handoff = quantas telas
    // antes do fim), com o mesmo quadro; quando este termina, some, e o corte não aparece
    this.handoff = el.dataset.handoff != null ? Number(el.dataset.handoff) : null;
    this.handsOff = false;  // o próximo ato é uma passagem no lugar (o app marca)
  }

  /** Precisa do WebGL agora (o app só dá o canvas para quem precisa). */
  get glNeeded() { return this.gl; }

  get span() { return state.flat ? 0 : (view.mobile ? this.spanM : this.spanD); }

  /** Altura da seção e posição (o app chama depois de cada mudança de layout). */
  setHeight() {
    // rolagem presa (span telas) + a altura do palco (lvh): o trecho preso do CSS sticky fica
    // igual ao travel, também no celular, onde lvh > svh
    this.el.style.height = state.flat || this.span === 0 ? '' : `${Math.round(this.span * view.svh + view.h)}px`;
  }
  measure(scrollY) {
    this.top = this.el.getBoundingClientRect().top + scrollY;
    this.travel = this.span * view.svh;
    this.height = this.el.offsetHeight;
    // altura do palco medida aqui, no layout: ler offsetHeight a cada quadro, depois de outro ato
    // ter escrito estilos, forçava um layout por ato por quadro
    this.stageH = this.stage ? this.stage.offsetHeight || view.h : view.h;
  }

  /** Progresso alvo para uma posição de rolagem. */
  progressAt(y) {
    if (state.flat || this.travel <= 0) return this.forced ?? this.hold;
    return clamp((y - this.top) / this.travel);
  }
  /** Rolagem (px) que leva o ato até o progresso p. */
  scrollFor(p) { return Math.round(this.top + (state.flat ? 0 : p * this.travel)); }
  /** Ponto de leitura para âncoras (o id pode escolher outro ponto dentro do ato). */
  holdFor() { return this.hold; }

  /** Atualiza visibilidade e progresso a cada quadro. */
  track(y, dt) {
    const vh = view.h;
    let top;
    if (state.flat || this.travel <= 0) top = this.top - y;
    else top = y < this.top ? this.top - y : y > this.top + this.travel ? this.top + this.travel - y : 0;
    const stageH = this.stageH || vh;
    const a = Math.max(0, top), b = Math.min(vh, top + stageH);
    this.vis = clamp((b - a) / vh);
    this.visible = b > a + 1;
    this.enter = clamp(1 - (this.top - y) / vh);
    this.leave = this.travel > 0 ? clamp((y - this.top - this.travel) / vh) : clamp((y - this.top) / vh);
    this.raw = this.progressAt(y);
    // terminou e o próximo já está por baixo com o mesmo quadro: sai da frente
    if (this.handsOff && this.stage) {
      const gone = !state.flat && this.travel > 0 && y > this.top + this.travel + 0.5;
      if (gone !== this.gone) { this.gone = gone; this.stage.classList.toggle('is-gone', gone); }
      // saiu da frente: não conta como visível (não desenha, não busca quadro, solta o canvas)
      if (gone) { this.visible = false; this.vis = 0; }
    }
    if (state.flat || state.jumping) this.p = this.raw;
    else {
      this.p += (this.raw - this.p) * (1 - Math.exp(-dt / this.lag));
      if (Math.abs(this.raw - this.p) < 1e-4) this.p = this.raw;
    }
  }

  /** Estado que define o quadro (para saber se a cópia 2D ainda vale). */
  key() { return Math.round(this.p * 2000); }

  /** Atos em HTML: as fotos do palco carregam em sequência (na ordem da página) e já decodificadas,
   *  para a passagem no lugar não mostrar uma foto pela metade. */
  load() {
    if (this.gl || !this.stage) return Promise.resolve();
    const imgs = $$('img', this.stage).filter(i => !i.dataset.src);
    return Promise.all(imgs.map(i => { i.loading = 'eager'; return i.decode?.().catch(() => {}); }));
  }
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
  css(el, '--a', alpha.toFixed(3));
  css(el, '--pe', alpha > 0.5 ? 'auto' : 'none');
  css(el, '--draw', ease(draw).toFixed(3));
  css(el, '--head', Math.sin(Math.PI * Math.min(1, draw * 1.02)).toFixed(3));
  return alpha;
}

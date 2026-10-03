// FINAL. O segundo filme: do carro pronto (o mesmo quadro da foto do resultado, presa por cima: a
// passagem não aparece) a câmera recua até o galpão do começo, o quadro 0. O último quadro troca pela
// foto nítida do mesmo quadro e a marca fecha a página: JETCAR, seu carro em outro nível, Agendar.
// Desktop: scrub do trecho f84 → f0 do filme (scripts/encode-open.sh). Celular: sem vídeo (menos
// vídeo no celular): a foto do resultado fica e a marca aparece sobre ela.
// O vídeo só é baixado quando o ato chega perto e é liberado longe dele.
import { $, view, state, span, smooth, css } from '../core.js';
import { Act } from './act.js';
import { Scrub } from '../scrub.js';

const CLIP = { mp4: 'assets/final/final.mp4', webm: 'assets/final/final.webm', frames: 85 };
const T = { scrub: [0.05, 0.8], sharp: [0.8, 0.86], copy: [0.8, 0.95] };
const TM = { copy: [0.12, 0.5] };

export class FinalAct extends Act {
  constructor(el) {
    super(el);
    this.reel = $('.reel', el);
    this.video = $('.reel-video', el);
    this.start = $('.reel-start', el);
    this.end = $('.reel-end', el);
    this.copy = $('.final-copy', el);
    this.scrim = $('.final-scrim', el);
  }

  /** Vídeo só no desktop (no celular, a foto parada). */
  get wantsVideo() { return !state.flat && !view.portrait; }
  get videoOn() { return this.wantsVideo && this.scrub?.state === 'ready'; }

  track(y, dt) {
    super.track(y, dt);
    // perto (duas telas antes, até uma depois): baixa; longe: solta o arquivo e o decodificador
    const near = y > this.top - 2.5 * view.svh && y < this.top + this.height + view.svh;
    if (near && this.wantsVideo) {
      if (!this.scrub) { this.scrub = new Scrub(this.video, CLIP); this.scrub.onFrame = () => { this.reel.classList.add('is-live'); }; }
      this.scrub.load();
    } else if (!near && this.scrub && this.scrub.state !== 'idle') {
      this.scrub.release();
      this.reel.classList.remove('is-live');
    }
  }

  settle() {
    this.update(16);
    if (this.scrub) this.scrub.t = this.scrub.target;
    this.update(16);
    return new Promise(r => { const v = this.video; if (!v || !v.seeking) return r(); v.addEventListener('seeked', () => r(), { once: true }); });
  }

  focusPoint(el) { return this.copy.contains(el) ? this.hold : null; }

  update(dt = 16) {
    const p = this.p;
    // o modo (filme ou fotos) só muda antes do recuo começar: o vídeo que termina de baixar no meio
    // do ato não troca a imagem de repente
    if (p <= T.scrub[0] + 0.02 || !this.videoOn) this.useVideo = this.videoOn;
    const video = this.useVideo;
    const ph = view.portrait ? TM : T;
    const copy = state.flat ? 1 : smooth(span(p, ph.copy[0], ph.copy[1]));
    css(this.copy, '--a', copy.toFixed(3));
    css(this.copy, 'pointer-events', copy > 0.5 ? '' : 'none');
    css(this.scrim, 'opacity', copy.toFixed(3));
    if (view.portrait || state.flat) { css(this.end, 'opacity', state.flat ? '1' : '0'); css(this.start, 'opacity', '1'); return; }
    // o filme pela rolagem; sem vídeo (ainda baixando ou falhou), corte pelo escuro entre a foto do
    // começo e a do fim (uma fusão das duas mostraria dois carros ao mesmo tempo)
    const s = span(p, T.scrub[0], T.scrub[1]);
    if (video && this.visible) this.scrub.seek(s * this.scrub.dur, dt);
    css(this.start, 'opacity', video ? '1' : (1 - smooth(span(s, 0.38, 0.5))).toFixed(3));
    const end = video ? smooth(span(p, T.sharp[0], T.sharp[1])) : smooth(span(s, 0.56, 0.72));
    css(this.end, 'opacity', end.toFixed(3));
  }
}

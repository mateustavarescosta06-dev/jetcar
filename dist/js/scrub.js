// Vídeo controlado pela rolagem: os dois únicos scrubs da página (abertura e final).
// - O arquivo inteiro vira um Blob, então a busca de quadro não depende da rede nem de Range, e só
//   é baixado quando o ato chega perto (load()); longe dele, o Blob e o decodificador são liberados.
// - A rolagem não escreve currentTime: escreve um alvo, e o playhead anda até ele a uma fração por
//   quadro (a roda chega em rajadas; escrever direto reproduzia cada degrau). Uma busca de cada
//   vez: com o decodificador ocupado, a próxima espera (rajadas não empilham buscas).
// - Só busca quadro com o ato visível. Parado, o vídeo não decodifica nada.
import { state } from './core.js';

const WEBM = typeof document !== 'undefined' && !!document.createElement('video').canPlayType?.('video/webm; codecs="vp9"');

export class Scrub {
  /**
   * @param {HTMLVideoElement} video
   * @param {{ mp4: string, webm?: string, frames: number, fps?: number }} opts
   */
  constructor(video, { mp4, webm, frames, fps = 24 }) {
    this.v = video;
    this.fps = fps;
    this.frames = frames;
    this.dur = (frames - 1) / fps;
    this.url = WEBM && webm ? webm : mp4;
    this.state = 'idle';     // idle → loading → ready | failed
    this.t = null;           // playhead suavizado (s)
    this.target = 0;
    this.shown = -1;         // quadro na tela
    this.onFrame = null;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    video.addEventListener('seeked', () => { this.shown = Math.round(video.currentTime * fps); this.onFrame?.(); });
  }

  /** Baixa o clipe (uma vez). Resolve true quando o primeiro quadro já pode ser mostrado. */
  load() {
    if (this.state !== 'idle') return this.ready;
    this.state = 'loading';
    const v = this.v;
    this.ready = fetch(this.url).then(r => (r.ok ? r.blob() : null)).then(b => new Promise(res => {
      if (!b || this.state !== 'loading') return res(false);
      this.blob = URL.createObjectURL(b);
      v.src = this.blob;
      v.addEventListener('loadeddata', () => { this.state = 'ready'; this.shown = 0; res(true); }, { once: true });
      v.addEventListener('error', () => { this.state = 'failed'; res(false); }, { once: true });
      v.load();
    })).catch(() => { this.state = 'failed'; return false; });
    // iOS: a primeira interação libera a decodificação para buscar quadros sem tocar
    if (!Scrub.primed) {
      Scrub.primed = true;
      const prime = () => { for (const s of Scrub.all) s.v.play?.().then(() => s.v.pause()).catch(() => {}); removeEventListener('touchstart', prime); };
      addEventListener('touchstart', prime, { passive: true });
    }
    Scrub.all.add(this);
    return this.ready;
  }

  /** Longe do ato: solta o arquivo e o decodificador (volta a baixar se a pessoa voltar). */
  release() {
    if (this.state === 'idle') return;
    const v = this.v;
    v.removeAttribute('src');
    v.load();
    if (this.blob) URL.revokeObjectURL(this.blob);
    this.blob = null;
    this.state = 'idle';
    this.t = null;
    this.shown = -1;
    Scrub.all.delete(this);
  }

  /** Leva o playhead em direção a t (segundos). Chamar só com o ato visível. */
  seek(t, dt = 16) {
    if (this.state !== 'ready') return;
    const v = this.v;
    t = Math.max(0, Math.min(this.dur, t));
    this.target = t;
    this.t = this.t == null || state.reduce ? t : this.t + (t - this.t) * (1 - Math.exp(-dt / 55));
    if (Math.abs(this.t - t) < 0.5 / this.fps) this.t = t;
    const frame = Math.round(this.t * this.fps);
    if (!v.seeking && frame !== this.shown && Math.abs(v.currentTime * this.fps - frame) > 0.25) v.currentTime = frame / this.fps;
  }

  /** O quadro na tela já é o do alvo (testes e capturas). */
  get settled() { return this.state !== 'ready' || (!this.v.seeking && this.shown === Math.round(this.target * this.fps)); }
}
Scrub.all = new Set();
Scrub.primed = false;

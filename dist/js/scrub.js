// Vídeo controlado pela rolagem: os dois únicos scrubs da página (abertura e final).
// - O arquivo inteiro vira um Blob, então a busca de quadro não depende da rede nem de Range, e só
//   é baixado quando o ato chega perto (load()); longe dele, o Blob e o decodificador são liberados.
// - A rolagem não escreve currentTime: escreve um alvo, e o playhead anda até ele a uma fração por
//   quadro (a roda chega em rajadas; escrever direto reproduzia cada degrau). Uma busca de cada
//   vez: com o decodificador ocupado, a próxima espera (rajadas não empilham buscas).
// - Só busca quadro com o ato visível. Parado, o vídeo não decodifica nada.
// - Os clipes têm quadros intermediários calculados (scripts/frames/interp.sh: 48 ou 72 por segundo
//   de filme). O que aparece é um canvas logo acima do vídeo: cada quadro que a busca entrega entra
//   por cima do anterior ao longo de alguns quadros de tela (uma fusão de ~40 ms), então a imagem
//   anda contínua mesmo quando a busca pula quadros. Parada, é exatamente o quadro do vídeo. Se o
//   navegador não desenha o vídeo no canvas (conferido na primeira vez), fica o vídeo puro.
// - O formato é o que o aparelho decodifica por hardware (a busca de quadro mais rápida): o WebM
//   (VP9, mais nítido no mesmo peso) onde o VP9 tem hardware, senão o H.264; sem essa informação,
//   o WebM onde toca.
import { state } from './core.js';

const TAU = 30;   // ms: constante de tempo da fusão entre quadros
const FORMAT = (async () => {
  const v = document.createElement('video');
  const can = { webm: !!v.canPlayType('video/webm; codecs="vp9"'), mp4: !!v.canPlayType('video/mp4; codecs="avc1.64002A"') };
  const mc = navigator.mediaCapabilities;
  const hw = async contentType => {
    try { const r = await mc.decodingInfo({ type: 'file', video: { contentType, width: 1920, height: 1080, bitrate: 12e6, framerate: 48 } }); return r.supported && r.powerEfficient; }
    catch { return false; }
  };
  if (mc?.decodingInfo) {
    if (can.webm && await hw('video/webm; codecs="vp09.00.41.08"')) return 'webm';
    if (can.mp4 && await hw('video/mp4; codecs="avc1.64002A"')) return 'mp4';
  }
  return can.webm ? 'webm' : 'mp4';
})();

/** O canvas da fusão: um por vídeo, logo depois dele (abaixo da foto que fecha cada scrub). */
function surface(video) {
  let c = video.nextElementSibling;
  if (c?.classList.contains('reel-blend')) return c;
  c = document.createElement('canvas');
  c.className = 'reel-blend';
  c.setAttribute('aria-hidden', 'true');
  c.hidden = true;
  video.after(c);
  return c;
}

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
    this.src = { mp4, webm };
    this.state = 'idle';     // idle → loading → ready | failed
    this.t = null;           // playhead suavizado (s)
    this.target = 0;
    this.shown = -1;         // quadro que a última busca entregou
    this.onFrame = null;
    this.canvas = surface(video);
    this.g = null;
    this.mix = 0;            // quanto do quadro novo ainda falta entrar no canvas (0: o canvas é o quadro)
    this.ok = false;         // o canvas mostra o vídeo de fato (conferido)
    this.tries = 0;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    video.addEventListener('seeked', () => {
      if (this.state !== 'ready') return;
      this.shown = Math.round(video.currentTime * this.fps - 0.2);
      this.mix = 1;
      if (state.reduce) this.flush();
      this.onFrame?.();
    });
  }

  /** Desenha o quadro atual do vídeo sobre o canvas com opacidade a (1 substitui). */
  paint(a) {
    const v = this.v, c = this.canvas;
    if (!v.videoWidth || (!this.ok && this.tries > 4)) return false;   // cinco conferências sem quadro: desiste
    if (c.width !== v.videoWidth || c.height !== v.videoHeight) { c.width = v.videoWidth; c.height = v.videoHeight; this.g = null; a = 1; }
    this.g ||= c.getContext('2d', { alpha: false });
    if (!this.g) return false;
    if (!this.ok) a = 1;   // até conferir, sempre o quadro inteiro
    this.g.globalAlpha = a;
    try { this.g.drawImage(v, 0, 0, c.width, c.height); } catch { return false; }
    if (!this.ok) this.check();
    return true;
  }

  /** Confere (uma vez) que o desenho trouxe o quadro: num quadro de verdade, nem tudo é preto. */
  check() {
    this.tries++;
    let lit = false;
    try {
      const p = (Scrub.probe ||= Object.assign(document.createElement('canvas'), { width: 4, height: 4 }));
      const g = p.getContext('2d', { willReadFrequently: true });
      g.drawImage(this.canvas, 0, 0, 4, 4);
      const d = g.getImageData(0, 0, 4, 4).data;
      for (let i = 0; i < d.length && !lit; i += 4) lit = d[i] + d[i + 1] + d[i + 2] > 9;
    } catch { lit = false; }
    this.ok = lit;
    this.canvas.hidden = !lit;
  }

  /** A fusão: a cada quadro de tela, o quadro novo entra mais um pouco. */
  blend(dt) {
    if (this.mix <= 0) return;
    if (state.reduce) { this.flush(); return; }
    const k = 1 - Math.exp(-Math.min(dt, 100) / TAU);
    this.mix *= 1 - k;
    if (this.mix < 0.04) this.flush();
    else this.paint(k);
  }

  /** O canvas passa a ser exatamente o quadro do vídeo. */
  flush() {
    this.paint(1);
    this.mix = 0;
  }

  /** Baixa o clipe (uma vez). Resolve true quando o primeiro quadro já pode ser mostrado. */
  load() {
    if (this.state !== 'idle') return this.ready;
    this.state = 'loading';
    const v = this.v;
    this.ready = FORMAT.then(f => fetch(this.src[f] || this.src.mp4)).then(r => (r.ok ? r.blob() : null)).then(b => new Promise(res => {
      if (!b || this.state !== 'loading') return res(false);
      this.blob = URL.createObjectURL(b);
      v.src = this.blob;
      v.addEventListener('loadeddata', () => { this.state = 'ready'; this.shown = 0; this.flush(); res(true); }, { once: true });
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

  /** Longe do ato: solta o arquivo, o decodificador e o canvas (volta a baixar se a pessoa voltar). */
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
    this.mix = 0;
    this.ok = false;
    this.tries = 0;
    this.canvas.hidden = true;
    this.canvas.width = this.canvas.height = 0;
    this.g = null;
    Scrub.all.delete(this);
  }

  /** Leva o playhead em direção a t (segundos). Chamar só com o ato visível (a cada quadro). */
  seek(t, dt = 16) {
    if (this.state !== 'ready') return;
    const v = this.v;
    this.blend(dt);
    t = Math.max(0, Math.min(this.dur, t));
    this.target = t;
    this.t = this.t == null || state.reduce ? t : this.t + (t - this.t) * (1 - Math.exp(-dt / 40));
    if (Math.abs(this.t - t) < 0.5 / this.fps) this.t = t;
    const frame = Math.round(this.t * this.fps);
    // um pouco depois do começo do quadro (no limite exato, alguns navegadores mostram o anterior;
    // o WebM guarda o tempo em milissegundos)
    if (!v.seeking && frame !== this.shown && Math.abs(v.currentTime * this.fps - 0.2 - frame) > 0.25) v.currentTime = (frame + 0.2) / this.fps;
  }

  /** Testes e capturas: leva o vídeo ao quadro do alvo (depois da busca em andamento) e deixa o
   *  canvas exatamente nele. */
  done() {
    if (this.state !== 'ready') return Promise.resolve();
    const v = this.v, goal = Math.round(this.target * this.fps);
    this.t = this.target;
    return new Promise(res => {
      const step = () => {
        if (v.seeking) return v.addEventListener('seeked', step, { once: true });
        if (this.shown !== goal) { v.currentTime = (goal + 0.2) / this.fps; return v.addEventListener('seeked', step, { once: true }); }
        this.flush();
        res();
      };
      step();
    });
  }

  /** O quadro na tela já é o do alvo (testes e capturas). */
  get settled() { return this.state !== 'ready' || (!this.v.seeking && this.mix === 0 && this.shown === Math.round(this.target * this.fps)); }
}
Scrub.all = new Set();
Scrub.primed = false;

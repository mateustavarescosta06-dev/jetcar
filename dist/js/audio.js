// Som ambiente opcional, gerado no navegador (nenhum arquivo de áudio): o "ar" de um estúdio
// fechado (ruído grave filtrado e um zumbido baixo que respira devagar) e um sopro que acompanha
// a velocidade da rolagem, como a câmera passando. Só liga quando a pessoa pede; nunca sozinho.
import { state } from './core.js';

let ctx = null, master = null, whoosh = null, whooshF = null, on = false;

function noiseBuffer(ac, seconds = 4) {
  const len = ac.sampleRate * seconds;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  // ruído marrom (mais grave que o branco), sem estalos no ponto de repetição
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
  const fade = Math.floor(ac.sampleRate * 0.05);
  for (let i = 0; i < fade; i++) { const k = i / fade; d[i] *= k; d[len - 1 - i] *= k; }
  return buf;
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const buf = noiseBuffer(ctx);

  // ar do estúdio
  const room = ctx.createBufferSource();
  room.buffer = buf; room.loop = true;
  const roomF = ctx.createBiquadFilter();
  roomF.type = 'lowpass'; roomF.frequency.value = 260; roomF.Q.value = 0.3;
  const roomG = ctx.createGain(); roomG.gain.value = 0.32;
  room.connect(roomF).connect(roomG).connect(master);
  room.start();

  // zumbido baixo que respira
  const hum = ctx.createGain(); hum.gain.value = 0.05;
  for (const [f, det] of [[55, -4], [82.5, 3]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = det;
    o.connect(hum); o.start();
  }
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.025;
  lfo.connect(lfoG).connect(hum.gain); lfo.start();
  hum.connect(master);

  // sopro da rolagem
  const w = ctx.createBufferSource();
  w.buffer = buf; w.loop = true; w.playbackRate.value = 1.6;
  whooshF = ctx.createBiquadFilter(); whooshF.type = 'bandpass'; whooshF.frequency.value = 400; whooshF.Q.value = 0.9;
  whoosh = ctx.createGain(); whoosh.gain.value = 0;
  w.connect(whooshF).connect(whoosh).connect(master);
  w.start();
  return true;
}

/** Liga/desliga (chamado pelo botão do menu). Devolve se ficou ligado. */
export async function setSound(want) {
  if (want && !ctx && !build()) return false;
  if (!ctx) return false;
  on = want;
  const t = ctx.currentTime;
  if (want) {
    await ctx.resume().catch(() => {});
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(0.5, t, 0.6);
  } else {
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(0, t, 0.25);
    setTimeout(() => { if (!on) ctx.suspend().catch(() => {}); }, 900);
  }
  return want;
}

let v = 0;
/** A cada quadro: o sopro segue a velocidade da rolagem (suavizada). */
export function renderSound() {
  if (!on || !ctx) return;
  v += (Math.min(1, Math.abs(state.vel) / 2.5) - v) * 0.08;
  const t = ctx.currentTime;
  whoosh.gain.setTargetAtTime(v * 0.22, t, 0.08);
  whooshF.frequency.setTargetAtTime(300 + v * 1400, t, 0.1);
}

document.addEventListener('visibilitychange', () => {
  if (!ctx || !on) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else ctx.resume().catch(() => {});
});

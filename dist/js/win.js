// Janela móvel: um recorte em meio plano (ou faixa) cuja borda é uma reta inclinada que anda na
// horizontal. Por quadro só mudam transformações: a janela anda e gira em volta da borda, e a imagem
// de dentro faz o movimento contrário, então fica parada na tela (nada é redesenhado).
// O CSS (.win) põe a janela alta e larga com a borda esquerda no meio da altura do recipiente; o
// recipiente informa o próprio tamanho em --cw/--ch (sizeBox).
import { css } from './core.js';

/** Escreve o tamanho do recipiente (px) para as imagens das janelas dentro dele. */
export function sizeBox(el, w, h) {
  el.style.setProperty('--cw', `${Math.round(w)}px`);
  el.style.setProperty('--ch', `${Math.round(h)}px`);
}

/** Borda da janela na reta que passa por x (no meio da altura do recipiente), inclinada theta
 *  (radianos a partir da vertical; positivo = desce para a direita). */
export function placeWin(win, x, theta) {
  const inner = win._inner || (win._inner = win.querySelector('img') || win.firstElementChild);
  css(win, 'transform', `translate3d(${x.toFixed(1)}px,0,0) rotate(${(-theta).toFixed(4)}rad)`);
  if (inner) css(inner, 'transform', `rotate(${theta.toFixed(4)}rad) translate3d(${(-x).toFixed(1)}px,0,0)`);
}

/** A linha de luz (elemento .trace): centro em (x, y) do palco, inclinação theta, comprimento k
 *  (fração do elemento, 0…1; 1 atravessa qualquer tela). */
export function placeTrace(el, x, y, theta, k = 1, h) {
  css(el, 'transform', `translate3d(${x.toFixed(1)}px,${(y - h / 2).toFixed(1)}px,0) rotate(${(-theta).toFixed(4)}rad) scaleY(${k.toFixed(4)})`);
}

// ——— A linha entre a Lavagem e o Polimento ———
// Ela nasce na borda do jato do quadro congelado (o fio d'água mais claro, do bico até onde a água
// bate no capô) e mantém essa inclinação no Polimento. Coordenadas em fração do quadro 16:9.
const JET = [[0.622, 0.06], [0.69, 0.28]];
const FRAME_ASPECT = 1920 / 1082;
// recorte quadrado do celular (freeze-m, scrub-m): u 0,2505…0,8142 do quadro, altura inteira
const SQUARE = [0.2505, 0.8142];

export const jet = { x: 0, y: 0, theta: 0.5, len: 100, ready: false };

/** Recalcula a linha a partir da caixa onde a foto do quadro aparece (o .reel-box da lavagem). */
export function measureJet(box, stageW, stageH, square) {
  let fx, fy, fw, fh;   // onde o quadro inteiro (16:9) cai na tela
  if (square) {
    fw = box.width / (SQUARE[1] - SQUARE[0]);
    fh = box.height;
    fx = box.left - SQUARE[0] * fw;
    fy = box.top;
  } else {
    // object-fit: cover no palco inteiro, centrado
    const s = Math.max(stageW / FRAME_ASPECT, stageH);
    fh = s; fw = s * FRAME_ASPECT;
    fx = (stageW - fw) / 2; fy = (stageH - fh) / 2;
  }
  const a = [fx + JET[0][0] * fw, fy + JET[0][1] * fh];
  const b = [fx + JET[1][0] * fw, fy + JET[1][1] * fh];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  Object.assign(jet, {
    x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2,
    theta: Math.atan2(dx, dy),
    len: Math.hypot(dx, dy),
    // x da reta no meio da altura do palco
    xm: a[0] + (stageH / 2 - a[1]) * (dx / dy),
    ready: true,
  });
  return jet;
}

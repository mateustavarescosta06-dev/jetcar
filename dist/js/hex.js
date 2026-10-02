// Geometria da colmeia (hexágonos com topo plano) compartilhada entre DOM e canvas.
import { view, clamp } from './core.js';

export const hive = { cells: [], r: 60, a: 52, cx: 0, cy: 0, maxD: 1 };

/** Monta as células que cobrem o palco a partir do centro (cx, cy). */
export function buildHive(cx, cy) {
  const r = clamp(Math.min(view.w, view.h) * 0.105, 46, 104);
  const a = (Math.sqrt(3) / 2) * r;
  const cells = [];
  const cols = Math.ceil(view.w / (1.5 * r)) + 2, rows = Math.ceil(view.h / (2 * a)) + 2;
  for (let c = -cols; c <= cols; c++) {
    for (let k = -rows; k <= rows; k++) {
      const x = cx + c * 1.5 * r, y = cy + k * 2 * a + (Math.abs(c) % 2 ? a : 0);
      if (x + r < 0 || x - r > view.w || y + a < 0 || y - a > view.h) continue;
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      // Eixo de giro perpendicular ao raio: as peças "abrem" como uma onda a partir do centro.
      const ax = d ? -dy / d : 0, ay = d ? dx / d : 1;
      cells.push({ x, y, d, ax, ay });
    }
  }
  cells.sort((p, q) => p.d - q.d);
  Object.assign(hive, { cells, r, a, cx, cy, maxD: cells.length ? cells[cells.length - 1].d : 1 });
  return hive;
}

export function hexPath(ctx, x, y, r) {
  ctx.moveTo(x + r, y);
  for (let i = 1; i < 6; i++) ctx.lineTo(x + r * Math.cos((i * Math.PI) / 3), y + r * Math.sin((i * Math.PI) / 3));
  ctx.closePath();
}

/** Progresso do giro de uma célula (0→1) dado o progresso global t da onda. */
export const cellFlip = (cell, t) => {
  const delay = (cell.d / hive.maxD) * 0.6;
  return clamp((t - delay) / 0.4);
};

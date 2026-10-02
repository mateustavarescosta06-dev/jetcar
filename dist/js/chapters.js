// A jornada é um único plano-sequência dividido em capítulos de rolagem.
// len: duração em telas (100svh). hold: ponto do capítulo onde a cena está "assentada"
// (usado ao navegar pelo menu). shot: qual cena desenha o capítulo.
export const CHAPTERS = [
  { id: 'abertura', len: 3.4, hold: 0, shot: 'film' },
  { id: 'marca', len: 2.8, hold: 0.42, shot: 'film' },
  { id: 'lavagem', len: 3.2, hold: 0.3, shot: 'film', num: '01', name: 'Lavagem técnica' },
  { id: 'correcao', len: 3.0, hold: 0.55, shot: 'studio', num: '02', name: 'Correção de pintura' },
  { id: 'ceramic', len: 2.7, hold: 0.55, shot: 'studio', num: '03', name: 'Ceramic Coating' },
  { id: 'camadas', len: 3.4, hold: 0.5, shot: 'studio', name: 'Camadas da pintura' },
  { id: 'ppf', len: 2.6, hold: 0.5, shot: 'studio', num: '04', name: 'PPF' },
  { id: 'interior', len: 3.0, hold: 0.55, shot: 'studio', num: '05', name: 'Higienização' },
  { id: 'final', len: 3.4, hold: 0.62, shot: 'film' },
  { id: 'rota', len: 2.8, hold: 0.7, shot: 'map' },
];

/** Início/fim de cada capítulo, em telas. */
export const C = {};
let acc = 0;
for (const ch of CHAPTERS) {
  ch.start = acc;
  ch.end = acc + ch.len;
  C[ch.id] = ch;
  acc = ch.end;
}
export const TOTAL = acc;

/** Posição global (em telas) de um ponto t (0…1) dentro do capítulo. */
export const at = (id, t) => C[id].start + C[id].len * t;
/** Progresso local 0…1 de u dentro do capítulo (sem limitar). */
export const local = (id, u) => (u - C[id].start) / C[id].len;

export function chapterAt(u) {
  for (let i = CHAPTERS.length - 1; i >= 0; i--) if (u >= CHAPTERS[i].start) return CHAPTERS[i];
  return CHAPTERS[0];
}

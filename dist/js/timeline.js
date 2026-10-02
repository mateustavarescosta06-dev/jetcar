// Linha do tempo da rolagem, em "unidades" (1 unidade = 85% da altura visível da tela).
// O conteúdo rola normalmente, como em qualquer site. Cada bloco abaixo tem uma altura
// mínima em unidades; o início real de cada bloco é medido na página e todas as
// transições do palco são definidas em relação a esses inícios (S).
export const BLOCKS = [
  { id: 'inicio', units: 0 }, // altura vem do CSS (100svh)
  { id: 'marca', units: 1.4 },
  { id: 'portal', units: 1.3 },
  { id: 'servicos', units: 1.7 },
  { id: 'lavagem', units: 1.9 },
  { id: 'polimento', units: 2.1 },
  { id: 'ceramic', units: 2.0 },
  { id: 'protecao', units: 2.6 },
  { id: 'ppf', units: 2.0 },
  { id: 'higienizacao', units: 2.1 },
  { id: 'contato', units: 3.0, portraitUnits: 2.2 }, // em pé, o formulário rola por cima do arco
  { id: 'local', units: 2.2 },
];

/** Início de cada bloco, em unidades (medido). */
export const S = {};
/** Intervalos de cada transição. Recalculados quando a página muda de tamanho. */
export const T = {};
/** Rótulos da moldura por cena (a partir de `from`). */
export const FRAME_META = [
  { key: 'wash', name: 'Lavagem técnica', icon: 'i-wash', count: '01 / 05', hint: ['Passe o cursor pela espuma', 'Toque nas bolhas'] },
  { key: 'polish', name: 'Polimento', icon: 'i-polish', count: '02 / 05', hint: ['Mova o cursor e guie o reflexo', 'Toque e guie o reflexo'] },
  { key: 'ceramic', name: 'Ceramic Coating', icon: 'i-ceramic', count: '03 / 05', hint: ['Passe o cursor pela superfície', 'Toque na superfície'] },
  { key: 'layers', name: 'Proteção da pintura', icon: 'i-layers', count: 'Camadas', hint: ['Mova o cursor e gire as camadas', 'Escolha Ceramic ou PPF'] },
  { key: 'ppf', name: 'PPF', icon: 'i-ppf', count: '04 / 05', hint: ['Mova o cursor e veja a película', 'Toque e veja a película'] },
  { key: 'interior', name: 'Higienização', icon: 'i-seat', count: '05 / 05', hint: ['Passe o cursor e desembace o vidro', 'Desembace com o dedo'] },
];

/** Recalcula S e T. `starts`: início de cada bloco; `end`: fim do último; `sheet`: quando a seção clara cobre o palco. */
export function buildTimeline(starts, end, sheet) {
  Object.assign(S, starts);
  const s = S;
  Object.assign(T, {
    end,
    sheet,
    // Abertura: o filme entra no logo, o logo assenta e a câmera mergulha no farol.
    brand: {
      fade: [0.22, 0.85],
      pull: [0.22, s.marca + 0.75],
      hold: [s.marca + 0.75, s.portal - 0.05],
      ui: [s.marca + 0.6, s.marca + 0.95, s.portal - 0.2, s.portal + 0.1],
      portal: [s.portal - 0.05, s.portal + 0.72],
    },
    // O farol vira a moldura dos serviços.
    frame: { preview: [s.portal - 0.5, s.portal - 0.02], morph: [s.portal + 0.72, s.servicos - 0.02] },
    wash: { foam: [s.servicos - 0.3, s.servicos + 0.25, s.polimento - 0.65, s.polimento - 0.15], reveal: [s.polimento - 0.82, s.polimento - 0.04] },
    polish: { disc: [s.polimento + 0.08, s.polimento + 0.7], end: s.ceramic - 0.55 },
    hive: { flip: [s.ceramic - 0.55, s.ceramic + 0.12] },
    layers: { tilt: [s.protecao - 0.62, s.protecao + 0.04], explode: [s.protecao - 0.22, s.protecao + 0.4], swap: [s.protecao + 0.8, s.protecao + 1.15], collapse: [s.ppf - 0.66, s.ppf - 0.04] },
    ppf: { sweep: [s.ppf + 0.02, s.ppf + 0.72], door: [s.higienizacao - 0.72, s.higienizacao - 0.04] },
    interior: { fog: [s.higienizacao - 0.08, s.higienizacao + 1.3], card: [s.contato - 0.62, s.contato + 0.02] },
    contact: { gather: [s.contato - 0.36, s.contato + 0.4], hint: [s.contato - 0.1, s.contato + 0.35, s.local - 0.95, s.local - 0.62], flatten: [s.local - 0.6, s.local - 0.05] },
    place: { slit: [s.local - 0.16, s.local + 0.34], letters: [s.local + 0.24, s.local + 0.8] },
  });
  const from = [-Infinity, s.polimento - 0.4, s.ceramic - 0.15, s.protecao - 0.25, s.ppf - 0.3, s.higienizacao - 0.35];
  FRAME_META.forEach((m, i) => { m.from = from[i]; });
}

// Valores nominais até a primeira medição.
{
  const starts = {};
  let acc = 0;
  for (const b of BLOCKS) { starts[b.id] = acc; acc += b.units || 1.18; }
  buildTimeline(starts, acc, acc + 0.2);
}

export const SERVICES = [
  { id: 'lavagem', name: 'Lavagem técnica', img: 'assets/wash.webp', description: 'A base do cuidado automotivo: uma limpeza voltada à carroceria, às rodas e aos detalhes externos.', points: ['Conte à equipe como você usa o veículo e quais áreas precisam de atenção.', 'A avaliação do carro orienta o cuidado e o acabamento.'] },
  { id: 'polimento', name: 'Polimento', img: 'assets/polish.webp', description: 'Um tratamento do acabamento da pintura para realçar o brilho e trabalhar imperfeições superficiais, conforme a avaliação do veículo.', points: ['A condição da pintura determina a abordagem do tratamento.', 'Converse sobre o resultado esperado antes de definir o serviço.'] },
  { id: 'ceramic', name: 'Ceramic Coating', img: 'assets/ceramic.webp', description: 'Um revestimento cerâmico aplicado ao acabamento. A preparação da superfície faz parte da definição do tratamento.', points: ['A equipe orienta sobre a indicação para o seu carro.', 'Consulte os cuidados de manutenção após a aplicação.'] },
  { id: 'ppf', name: 'PPF', img: 'assets/ppf.webp', description: 'Paint Protection Film: uma película transparente de proteção aplicada sobre a pintura.', points: ['A cobertura pode ser discutida por áreas do veículo.', 'Peça orientação sobre aplicação, acabamento e cuidados posteriores.'] },
  { id: 'higienizacao', name: 'Higienização', img: 'assets/interior.webp', description: 'Uma atenção dedicada ao interior: bancos, superfícies e os detalhes do ambiente interno.', points: ['Informe o tipo de revestimento e os pontos que exigem atenção.', 'A equipe avalia as necessidades do interior antes de definir o serviço.'] },
];

// Fotos (ilustrativas) e o ponto que deve permanecer visível quando a moldura recorta.
export const IMAGES = {
  wash: { src: 'assets/wash.webp', w: 1536, h: 1024, fx: 0.52, fy: 0.5 },
  polish: { src: 'assets/polish.webp', w: 1536, h: 1024, fx: 0.6, fy: 0.42 },
  ceramic: { src: 'assets/ceramic.webp', w: 1536, h: 1024, fx: 0.42, fy: 0.5 },
  ppf: { src: 'assets/ppf.webp', w: 1536, h: 1024, fx: 0.6, fy: 0.45 },
  interior: { src: 'assets/interior.webp', w: 1536, h: 1024, fx: 0.64, fy: 0.5 },
};

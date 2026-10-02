// Linha do tempo da rolagem, em "unidades" (1 unidade ≈ 0,88 da altura da tela).
// Cada cena entrega a próxima a partir da sua geometria final: ajuste os números aqui.
export const T = {
  total: 23,
  hero: { copy: [-1, 0, 0.12, 0.62] },
  // Recuo de dentro da haste do T até o logo inteiro; pausa; mergulho no farol.
  brand: { pull: [0.42, 1.75], hold: [1.75, 2.5], portal: [2.5, 3.45], copy: [1.7, 1.95, 2.35, 2.6] },
  wash: { copy: [3.55, 3.95, 4.8, 5.05], foam: [3.25, 3.7, 5.05, 5.7], reveal: [5.0, 5.95] },
  // Imagem inteira → disco giratório → estilhaça em colmeia.
  polish: { disc: [5.95, 6.55], copy: [6.35, 6.75, 7.2, 7.45], end: 7.85 },
  hive: { flip: [7.85, 8.85] },
  ceramic: { copy: [8.95, 9.35, 9.85, 10.1] },
  // Vista explodida das camadas da pintura (interlúdio claro).
  layers: { tilt: [10.15, 10.8], explode: [10.55, 11.2], copy: [10.85, 11.2, 11.95, 12.2], swap: [11.35, 11.85], collapse: [12.2, 12.95] },
  ppf: { copy: [13.1, 13.5, 13.95, 14.2], sweep: [13.05, 14.0], door: [14.15, 14.95] },
  interior: { fog: [14.3, 16.0], copy: [14.85, 15.25, 15.9, 16.15], card: [16.2, 16.95] },
  contact: { gather: [16.5, 17.35], copy: [17.15, 17.55, 19.1, 19.35], flatten: [19.3, 19.8] },
  place: { slit: [19.72, 20.3], letters: [20.25, 20.8], copy: [20.65, 21.05, 21.75, 21.95], final: [21.85, 22.5] },
  final: { copy: [22.25, 22.7, 99, 100] },
};

export const CHAPTERS = [
  { id: 'inicio', label: 'Início', u: 0 },
  { id: 'marca', label: 'JETCAR', u: 2.1, hidden: true },
  { id: 'lavagem', label: 'Lavagem técnica', u: 4.35 },
  { id: 'polimento', label: 'Polimento', u: 6.95 },
  { id: 'ceramic', label: 'Ceramic Coating', u: 9.6 },
  { id: 'camadas', label: 'Camadas', u: 11.55, hidden: true },
  { id: 'ppf', label: 'PPF', u: 13.75 },
  { id: 'higienizacao', label: 'Higienização', u: 15.55 },
  { id: 'contato', label: 'Contato', u: 18.2 },
  { id: 'local', label: 'Boa Viagem', u: 21.35 },
];

// Ponto de leitura de cada bloco de texto (usado ao focar com o teclado).
export const ACT_FOCUS = {
  hero: 0, brand: 2.1, wash: 4.35, polish: 6.95, ceramic: 9.6, layers: 11.55, ppf: 13.75, interior: 15.55, contact: 18.2, place: 21.35, final: 23,
};

export const SERVICES = [
  { name: 'Lavagem técnica', img: 'assets/wash.webp', description: 'A base do cuidado automotivo. Uma limpeza voltada à carroceria, às rodas e aos detalhes externos.', points: ['Conte à equipe como você usa o veículo e quais áreas precisam de atenção.', 'A avaliação do carro orienta o cuidado e o acabamento.'] },
  { name: 'Polimento', img: 'assets/polish.webp', description: 'Um tratamento do acabamento da pintura para realçar o brilho e trabalhar imperfeições superficiais, conforme a avaliação do veículo.', points: ['A condição da pintura determina a abordagem do tratamento.', 'Converse sobre o resultado esperado antes de definir o serviço.'] },
  { name: 'Ceramic Coating', img: 'assets/ceramic.webp', description: 'Um revestimento cerâmico aplicado ao acabamento. A preparação da superfície faz parte da definição do tratamento.', points: ['A equipe orienta sobre a indicação para o seu carro.', 'Consulte os cuidados de manutenção após a aplicação.'] },
  { name: 'PPF', img: 'assets/ppf.webp', description: 'Paint Protection Film: uma película transparente de proteção aplicada sobre a pintura.', points: ['A cobertura pode ser discutida por áreas do veículo.', 'Peça orientação sobre aplicação, acabamento e cuidados posteriores.'] },
  { name: 'Higienização', img: 'assets/interior.webp', description: 'Uma atenção dedicada ao interior: bancos, superfícies e os detalhes do ambiente interno.', points: ['Informe o tipo de revestimento e os pontos que exigem atenção.', 'A equipe avalia as necessidades do interior antes de definir o serviço.'] },
];

// Fotos (ilustrativas) e o ponto que deve permanecer visível em telas estreitas.
export const IMAGES = {
  wash: { src: 'assets/wash.webp', w: 1536, h: 1024, fx: 0.56, fy: 0.5 },
  polish: { src: 'assets/polish.webp', w: 1536, h: 1024, fx: 0.6, fy: 0.42 },
  ceramic: { src: 'assets/ceramic.webp', w: 1536, h: 1024, fx: 0.42, fy: 0.5 },
  ppf: { src: 'assets/ppf.webp', w: 1536, h: 1024, fx: 0.62, fy: 0.45 },
  interior: { src: 'assets/interior.webp', w: 1536, h: 1024, fx: 0.7, fy: 0.5 },
};

# REPORT · JETCAR v6

O que foi construído, como foi verificado e o que ainda falta. O processo está em `BRIEF.md`
(o pedido) e `PLAN.md` (a análise em 11 pontos, feita antes de construir).

## Frase de teste

"É o site em que a luz da JETCAR percorre o carro e cada etapa do tratamento é revelada
conforme você explora."

## Gramática

**Baias de serviço** (nova): a página é o corredor de uma oficina percorrido baia por baia.
Cada baia tem mídia e controle próprios e se entra e sai dela pela luz. As oito gramáticas da
skill perderam pelos motivos da tabela em `PLAN.md` §0 (a mais próxima, o filmic one-shot, é
exatamente o que o usuário rejeitou na v5; continuous world exige câmera contínua, proibida
pelo brief; gallery mostraria os cinco lado a lado, também proibido).

## Assinatura: JETCAR Light Trace

Uma linha branca (núcleo de 1 a 2 px, halo curto, nunca colorida) que muda de função:

| Onde | Função | Onde está no código |
|---|---|---|
| Hero | Varre o galpão uma vez e acende o carro (o reflexo corre pela carroceria); na saída deita no piso | `hero.js` (`uTraceX`, `uFloorLine`) |
| 01 Lavagem | Atravessa a água congelada e desenha a borda do card 01 | `wash.js` (barra 0), `.card-trace` |
| 02 Polimento | É a luz de inspeção que revela os micro-riscos; o card 02 fica na ponta da trajetória | `polish.js`, `studio.js` (`uInspBar`) |
| 03 Ceramic | Corre entre as camadas separadas e ativa o coating (as gotas se formam por onde ela passa) | `protect.js` (luz 3, `T.scan`, `T.act`) |
| 04 PPF | É a borda da película que atravessa a carroceria; sobe pelo para-brisa na saída | `protect.js` (`PHOTO`, `uClimb`) |
| 05 Interior | É o reflexo que limpa o vidro na passagem para dentro | `interior.js` (`.cabin-band`) |
| Navegação | Trilho no topo com as cinco paradas, acende até a baia atual | `ui.js` (`.lane-lit`) |
| Endereço | Vira a rota pela orla até a Rua José Trajano | `route.js` |

## Gate de impressões digitais

Contra a v5 (única linha do registro): difere em gramática, navegação, hero, sequência e
assinatura (5 de 6); repete os ingredientes do fechamento (rota e formulário), em outra ordem
e com outro papel. Passa (mínimo 4). Linhas adicionadas em `scrollcraft/FINGERPRINTS.md`.

## Jornada construída

| Ato | Telas (desktop/celular) | Dispositivo | Sentimento planejado | Feel check (uma palavra, rolando as capturas a frio) |
|---|---|---|---|---|
| Hero | 1,5 / 1,2 | Foto em planos reais (placa projetada, carro recortado, letreiro atrás do teto, pilar perto) com dolly de câmera e varredura de luz | calma | calma |
| 01 Lavagem | 2,6 / 2,2 | Único scrub (1,75 s do master, em moldura) que congela; gotas 3D refratando, algumas fora da moldura; card 01 | curiosidade → impacto → pausa | impacto, depois pausa |
| 02 Polimento | 2,4 / 2,0 | Capô 3D no escuro, luz de inspeção revelando micro-riscos, boina passando; o ponteiro inclina a luz; "Ver antes" | descoberta | silêncio |
| 03 + 04 Proteção | 4,4 / 3,6 | Vista explodida 3D (cinco camadas, separação controlada pela pessoa), linha entre camadas, coating segurando gotas; foto do carro com a película atravessando (controle próprio); card 04 empilha sobre o 03 | domínio, assombro (PICO) | controle |
| 05 Interior | 2,4 / 2,2 | Foto em dois planos atrás de um vidro; a linha limpa o vidro, a câmera passa pela porta e PARA; quatro pontos e card 05 | intimidade | proximidade |
| Resultado | fluxo | Foto inteira 2× do carro pronto, linha passa uma vez | orgulho | resolvido |
| Pedido | fluxo | Configurador: carro → o que melhorar (seis opções) → mensagem pronta → Direct | decisão | precisão |
| Endereço | 1,6 / 1,4 | Mapa SVG (OSM), a rota é desenhada pela rolagem e termina com o pedido | chegada | chegada |

Diferença entre o planejado e o sentido: o pico lê como "controle" mais que "assombro" nas
capturas paradas; o assombro depende do movimento (camadas abrindo, a linha correndo entre
elas), que precisa ser conferido num aparelho real. Nenhum ato lê no máximo de intensidade
fora do pico; o polimento, antes dele, é o mais quieto.

Famílias de dispositivo: parallax com perspectiva real, scrub, ponteiro, arrastar 3D, reveal,
oclusão, hotspot, desenho de rota, formulário (nove; nenhuma repetida em seguida).
Alternância: assistir → assistir/explorar → explorar → explorar/assistir → explorar →
assistir → agir → assistir.

## Assets (todos derivados do que já existia, sem créditos gastos)

| Asset | De onde | Tratamento |
|---|---|---|
| Hero | `poster.webp` (a foto que originou o vídeo, 4,3× mais nítida que o quadro 0) | Recorte (BiRefNet lite), placa limpa (LaMa), ampliação 2× (Real-ESRGAN), normais (Depth Anything V2 Small, salvas sem perdas) |
| Lavagem | Master 5,25 a 7,0 s | Scrub com GOP denso (H.264 GOP 8/4 e VP9), versão quadrada para celular, congelamento ampliado 2× |
| PPF | Master 2,25 s | Ampliação 2× (3200 px) e máscara do carro |
| Resultado | Master 3,5 s (carro seco e nítido; os planos molhados do fim pareciam manchados) | Ampliação 2× e recorte vertical para celular |
| Interior | Foto da v5 | Ampliação 2× (3072 px), dois planos com contorno desenhado à mão |
| Endereço | OpenStreetMap | SVG gerado de `map.json` |

Teste de busca do scrub (auditoria de vídeo): GOP denso buscou cerca de 5,7× mais rápido que o
GOP padrão no Chromium.

## Verificação feita

- Capturas de cada ato a 0/25/50/75/100% em 1440×900 e iPhone 14 Pro, folhas de contato lidas;
  360×640 nos pontos de leitura; movimento reduzido (desktop) em todas as seções.
- Problemas encontrados nas capturas e corrigidos: escada de blocos no reflexo do hero (normal
  map com compressão com perdas ampliada; refeito sem perdas e reflexo um pouco mais macio);
  NaN em potências de base negativa em quatro shaders (quebraria em GPUs D3D/Metal); fim da
  lavagem deixava um retângulo preto sobre o fundo (agora a exposição inteira vai ao preto);
  luz de fundo do Ceramic cruzando a barra do site; pontos do interior embaixo do card ou fora
  do quadro; trilho marcando a baia errada nas bordas e depois do interior; texto do hero saindo
  da árvore de acessibilidade ao rolar; ordem do Tab indo e voltando no ato Proteção; rótulos
  dos controles deslizantes sem texto de valor.
- Teclado: Tab pela página inteira (todos os controles alcançáveis e visíveis no foco, voltando
  a rolagem ao ponto de leitura de cada ato).
- Interação (desktop e celular): incluir no pedido pelos cards e sincronia com o formulário,
  "Ver antes", separação e película pelo teclado, pontos do interior, mensagem, link do Direct,
  copiar, pedido aparecendo no endereço, menu com Escape, som, trilho levando ao PPF, sem
  rolagem horizontal, sem erros de página.
- Revisão adversarial em quatro dimensões (execução, acessibilidade, brief, WebGL), cada achado
  verificado por um segundo agente antes de corrigir. Resultado na seção abaixo.
- `npm run check`.

## Não verificado

- Aparelhos reais (Safari no iPhone e um Android médio): fluidez das cenas 3D, busca de quadros
  do scrub ao rolar rápido, arrastar camadas e película no toque, teclado do iPhone no pedido.
- Decodificação H.264: o Chromium dos testes não tem o codec (usa o WebM); o MP4 só roda no
  Safari, que não foi testado aqui.
- Fluidez em geral: o WebGL por software dos testes é lento e não mede quadros por segundo.

## Desvios do plano

- O letreiro do hero virou um plano no WebGL (letras do próprio logo), não HTML/SVG: só assim o
  teto do carro o oculta com a silhueta exata. O título, o texto e os botões continuam em HTML.
- Spans do celular: hero 1,2 (plano: 1,3).
- Lavagem no celular: recorte quadrado do vídeo (plano: 4:5), com o card embaixo.
- Resultado: quadro de 3,5 s do master em vez de `finish.webp`, pela auditoria de vídeo.
- Luz de fundo do Ceramic só aparece no reflexo (o tubo visível cruzava a barra do site).

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
  conferido por um segundo agente que tentava refutá-lo. Resultado na seção abaixo.
- `npm run check`.

## Revisão adversarial

44 achados: 41 confirmados e corrigidos, 3 refutados pelo segundo agente. A conferência também
pegou uma regressão numa correção minha (o card revelado pelo foco do clique continuava aceso ao
sair de cena), corrigida para reagir só ao foco do teclado.

- **Sem WebGL** os atos guardavam a rolagem presa: âncoras passavam do ponto, a rota não
  aparecia e os botões dos cards não respondiam ao clique. Agora a página fica parada
  (`state.flat`) como no movimento reduzido.
- **Movimento reduzido**: card 04 sem clique, controles invisíveis recebendo foco, card 03
  escurecido, palco mais alto que o canvas. Corrigidos; no celular as camadas aparecem acima dos
  cards.
- **Acessibilidade**: rótulo dos botões de alternância mudando junto com `aria-pressed`, menu sem
  prender o foco (a página atrás agora fica `inert`), anel de foco invisível no rodapé vermelho,
  mensagem do pedido relida a cada tecla, rodapé dentro do `main`, contraste de títulos pequenos,
  alvos de toque, `og:image` relativa.
- **Execução**: o foco do clique fazia a página pular; o canvas não redesenhava ao trocar de
  dono ou mudar de tamanho com a página parada; o vídeo da lavagem podia travar o carregamento
  de tudo o que vinha depois (agora usa a foto se não responder em 6 s); arrastar no toque era
  cancelado pela rolagem; resolução dinâmica caía para 55% em telas de 30 Hz; trecho preso do
  CSS diferente do JS no celular.
- **Brief**: a linha do Ceramic acendia o rótulo espelhado (Primer quando passava no verniz);
  no celular o mapa cortava o começo da rota e a avenida; o Explorar do card 01 não explorava
  (agora faz um giro curto em volta da água); a linha como navegação sumia até 1080 px (agora
  uma linha fina com as cinco paradas embaixo da barra, a baia atual marcada no menu e o
  registro do percurso no rodapé); texto alternativo e contagem de respostas errados.
- **WebGL**: a foto do PPF era desenhada antes da sombra e das camadas transparentes (que
  ficavam por cima dela); faixa borrada no pé da foto; gotas virando discos escuros durante o
  congelamento e normais erradas nas gotas esticadas; fotos sem mipmaps cintilando; giro da
  boina dependente da taxa de quadros; sem checagem de render target meio-float (agora cai para
  os pôsteres em vez de tela preta); shaders compilados só na entrada de cada cena (agora logo
  depois de carregar).
- Refutados: texto de valor dos controles deslizantes (já existia), alvos de 44 px (passam no
  nível AA; aumentados assim mesmo) e os cerca de 15 arrays curtos por quadro nas luzes (custo
  desprezível; sem mudança).

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

## v6.1 · Nitidez (media pipeline e rendering pipeline)

Pedido: "a NITIDEZ está inaceitável… CORRIJA A FONTE, NÃO TENTE ESCONDER O PROBLEMA COM CSS OU
SHADERS". Auditoria completa, com números e testes, em `audit/IMAGE_QUALITY_AUDIT.md`. Ordem
seguida: nitidez, depois profundidade, movimento e "uau"; nenhum efeito novo antes da nitidez.

### O que mudou

- **Fonte e mídia**: quadros do master extraídos uma vez, sem perdas, em BT.709; Real-ESRGAN com a
  textura do original devolvida (`detail_blend.py`: o ESRGAN apagava couro, costura, concreto e
  tela da grade); níveis desktop alto / padrão / celular com enquadramento próprio, todos
  reduções Lanczos do mesmo intermediário (`build_stills.py`); WebP q92 com sharp_yuv (q95 no carro
  e no congelado), máscaras sem perdas; scrub H.264 CRF 18 / VP9 CRF 20, sem quadros B, GOP 8/4,
  marcado BT.709; o código escolhe o nível pelos pixels do aparelho.
- **Render**: escala alta 2 / padrão 1,5 / baixa 1,25 / piso 1,0 com uma escada medida (tempo de
  GPU ou quadros perdidos) que derruba efeitos antes da resolução e volta a subir; sem grão; bloom
  só em fontes de luz; curva de tom que deixa o branco das fotos chegar a 255; desfoque que nunca
  mistura a meia resolução no assunto em foco; fotos em sRGB; viés de mip −0,5 medido no teste de
  filtros; código morto da v5 removido.
- **Por cena**: lavagem com foco no plano da moldura (só as gotas da frente desfocam, sem "favo");
  polimento sem desfoque, com duas paradas no mesmo ponto (riscos → limpo) e o card 02 na primeira
  ("A luz encontra a pintura."); Ceramic em materiais físicos (MeshPhysicalMaterial, luzes de área
  LTC nas posições das barras, mapa de ambiente PMREM, verniz e coating com transmissão, gotas
  d'água com refração); borda da película do PPF abaixo do limiar do bloom; interior em pixels
  inteiros na parada.
- **Pôsteres** (primeiro quadro e modo sem WebGL): 2880×1800, 1440 e 1170×2532, perfil alto, q90.
- **Depois da revisão de completude** (o que o desfoque, o bloom e o grão escondiam): mapa dos
  micro-riscos em ângulo dobrado, brilhos analíticos com a largura do pixel, normal do capô por
  pixel, DPR relido quando muda, "refração" da película limitada a meio pixel, carro do hero mais
  à direita do título.

### Verificação

- Testes de mídia com números (WebP q88/92/95, CRF 18–24 alinhado, filtros de textura com 630
  quadros capturados, A/B do ESRGAN no tamanho de exibição, matriz de cor, busca real de quadro
  no Chromium: 20 buscas aleatórias em cada versão do scrub, todas no quadro certo, 17–65 ms
  depois do aquecimento; corte vídeo → foto a 40,1 dB no desktop e 37,9 dB no celular).
- Simulação da escada de qualidade em quatro cenários (GPU rápida, GPU fraca, carregamento lento
  seguido de folga, iPhone sem timer de GPU), que achou e corrigiu um erro: sem timer, uma GPU que
  só fazia 30 fps parecia uma tela de 30 Hz.
- Matriz de capturas com o código final no perfil alto fixo: entrada, card, meio e saída de cada
  serviço, mais hero, resultado, pedido e endereço (28 momentos) em 1920×1080, 2560×1440,
  1440×900@2 e 390×844@3, sem erros de console; folhas de contato e recortes 1:1 dos assuntos em
  foco conferidos. E o que o aparelho recebe de fato: o celular no perfil padrão e o retina nos
  perfis padrão e baixo (escala de render × assunto em foco, com SSIM e energia de detalhe).
- Comparação ANTES (v5 em produção) × DEPOIS no mesmo tamanho de tela (retina e iPhone), sete
  pares com o quadro inteiro e um recorte 1:1 do assunto.
- Com a imagem nítida, a verificação achou e corrigiu na fonte (auditoria, seção 11): o chuvisco
  de pontos dos flocos metálicos do polimento, o mapa de micro-riscos do celular com outro desenho
  (um contador de laço com o nome da escala), riscos com quinas (segmentos retos no lugar de arcos
  com degradê cônico), o Ceramic em meia resolução fora do perfil alto, o título do resultado
  sobre o farol no celular e o texto do hero colado na borda nos modos sem WebGL e sem JavaScript.
- Modos de reserva (sem WebGL no desktop, no iPhone e em 360×640; sem JavaScript) e testes de
  interação (cards ↔ pedido, "Ver antes", separador e película pelo teclado, pontos do interior,
  mensagem e Direct, cópia, som, trilho, sem rolagem horizontal).

### Limites

- As fontes não passam de 1916 px e o vídeo tem ~1300 px de detalhe real: o ESRGAN reconstrói
  bordas e a textura volta do original, mas detalhe novo só com fotos reais ou imagens novas em 4K
  (créditos só com autorização).
- Sem aparelhos reais aqui: o Chromium dos testes usa WebGL por software, não decodifica H.264 e
  não mede fluidez. Falta calibrar a escada no Safari do iPhone e num Android médio.

## v6.2 · Ritmo, fluidez e variedade (sem redesenho)

Pedido: "Menos movimento. Melhor movimento." Dois scrubs no máximo (a abertura e o final), cenas
ligadas por cortes no mesmo quadro em vez de movimento constante, um único pico (o Ceramic) com
silêncio antes dele, cada card entrando de um jeito. Plano, score, verificação e a revisão de ritmo
em `PLAN-v62.md` (seções 9 e 10).

### O que mudou

- Vídeo: de um trecho em moldura na lavagem para dois filmes na tela inteira, só onde o plano
  precisa de movimento: a abertura (a câmera chega ao capô e a água bate) e o final (o recuo do carro
  pronto ao galpão do começo). Cada um termina numa foto nítida do mesmo quadro. No celular, só o
  jato num quadrado; o final sem vídeo.
- Lavagem, Polimento, PPF e Interior viraram fotos e HTML (janelas móveis só com `transform`);
  WebGL só na abertura (até o vídeo assumir) e no Ceramic. Pesado e leve se alternam.
- Passagens no lugar: o ato seguinte fica preso por baixo do anterior com o mesmo quadro (hero →
  lavagem, lavagem → polimento, Ceramic → PPF, PPF → interior, resultado → final).
- Silêncio tipográfico antes do pico; o pedido em quatro passos.
- Fluidez: Lenis com `lerp` 0,15 e roda 1:1, progresso dos atos com 30 ms (antes 70), altura do
  palco medida no layout (antes cada ato forçava um layout por quadro), estilos escritos só quando
  mudam; vídeo baixado perto, buscas só com o ato visível, solto longe.
- Total preso: 13,0 telas no desktop (v6.1: 14,9) e 10,2 no celular.

### Não verificado

- Fluidez real (o renderizador por software não mede): o Ceramic, as janelas móveis do polimento e
  a busca de quadros dos dois scrubs no Safari do iPhone e num Android médio.

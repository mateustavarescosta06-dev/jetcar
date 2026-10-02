# PLAN · JETCAR v6

Análise feita antes de construir, na ordem pedida. §1 e §2 são as auditorias (arquivos completos
em `audit/`); §3 a §11 são as decisões.

## 0. Gramática, assinatura e gate

### Gramática: "Baias de serviço" (nova)

As oito gramáticas da skill e por que perderam:

| Gramática | Por que não serve à JETCAR |
|---|---|
| Filmic one-shot | É a v5: um plano-sequência controlado pela rolagem. O usuário rejeitou exatamente isso. |
| Chaptered editorial | O hero dela é uma página de título sem mídia e proíbe scrub e cena atrás do texto; aqui o hero precisa do carro em camadas. |
| Live surface | Não há produto de software para operar. |
| Continuous world | Exige um único mundo e uma câmera contínua: proibido pelo brief. |
| Typographic poster | O argumento é o carro e a luz, não uma frase. |
| Gallery / catalog | Mostra a coleção lado a lado; o brief proíbe a grade dos cinco e pede uma ordem de processo. |
| Split stage | Antes/depois é só um trecho (PPF), não o site inteiro. |
| Rhythmic cutlist | Energia de evento; a JETCAR precisa de calma e pausa. |

**Baias de serviço.** A página é o corredor de uma oficina percorrido baia por baia. Cada baia é
um espaço próprio, com mídia própria (foto, vídeo curto, 3D em tempo real, HTML) e um controle
próprio. Entra-se e sai-se de cada baia pela luz.

- **Serve para:** um serviço físico aplicado em etapas a um objeto; a pergunta de quem visita é
  "o que vocês fazem no meu carro, e em que ordem".
- **Sequência:** hero (o carro chega e a luz o encontra) → cinco baias na ordem real do
  processo, cada uma com CENA → CARD → INTERAÇÃO → TRANSIÇÃO → entrega (resultado,
  ordem de serviço, rota). Numeração 01–05 porque a ordem do processo é informação.
- **Navegação:** a própria linha de luz: um trilho no topo com as cinco baias como paradas
  clicáveis, que acende conforme você passa. No rodapé ele é o registro do percurso.
- **Final:** a entrega. A pessoa escreve a própria ordem de serviço (configurador) e a linha
  vira a rota até a porta; a última tela segura o pedido dela e o botão de agendar.
- **Proíbe:** câmera contínua entre baias; a mesma mídia ou dispositivo em duas baias
  seguidas; os cinco serviços lado a lado; vídeo em tela cheia; scrub em mais de uma baia;
  card solto sobre imagem sem relação física com a cena (cada card se prende a algo: trajetória
  da luz, borda da película, superfície); cards com vidro, blur, raio grande ou sombra genérica;
  tilt, magnet e lanterna seguindo o cursor; troca contínua de cor de fundo.

### Assinatura: JETCAR Light Trace

Uma única linha de luz branca, sempre com o mesmo desenho (núcleo branco de 1 a 2 px, halo
curto e frio-neutro, nunca colorida), que muda de função a cada baia:

| Onde | Função da linha |
|---|---|
| Hero | Revela o carro: varre o galpão uma vez, o reflexo corre pela carroceria, e depois deita no piso. |
| 01 Lavagem | Atravessa a água congelada (cada gota acende quando a linha passa) e desenha a borda do card 01. |
| 02 Polimento | É a luz de inspeção: cruza o capô devagar e revela os micro-riscos; termina na borda do card 02. |
| 03 Ceramic | Separa as camadas (desliza entre elas e acende as bordas) e ativa o coating (a água passa a formar gotas). |
| 04 PPF | Acompanha a borda da película que atravessa a carroceria. |
| 05 Interior | É o reflexo que limpa o vidro na passagem para dentro. |
| Navegação | Trilho no topo com as cinco paradas; acende até a baia atual. |
| Endereço | Vira a rota pela orla até a Rua José Trajano. |

### Gate de impressões digitais

O registro estava vazio. Registrei a v5 como linha existente (construída antes da skill) e
comparei:

| Dimensão | v5 (existente) | v6 (planejada) | Difere? |
|---|---|---|---|
| Gramática | Filmic one-shot | Baias de serviço | sim |
| Navegação | Barra fixa com links, som, Agendar e fio de progresso | Trilho de luz com as cinco baias como paradas | sim |
| Hero | Filme em tela cheia controlado pela rolagem, profundidade por deformação, logo atravessado | Composição parada em planos separados, a luz revela, carro ocluindo o letreiro | sim |
| Sequência | 10 capítulos num trilho único de 30,3 telas | Hero + 5 baias de mídias diferentes + entrega, cerca de 15 telas presas | sim |
| Fechamento | Rota no mapa dentro do filme, depois formulário | Foto do resultado, ordem de serviço, rota que termina com o pedido | não (mesmos ingredientes) |
| Assinatura | Câmera atravessa a letra A | Light Trace com função diferente em cada baia | sim |

5 de 6. Passa.

## 1. Auditoria do site atual (v5)

Completa em `audit/AUDIT_SITE.md` (10 capítulos × 5 pontos, desktop e celular, movimento reduzido,
sem WebGL, sem JavaScript, árvore de acessibilidade). Resumo:

- **Parece vídeo:** 42% do trilho (12,8 de 30,3 telas) é o filme de IA arrastado pela rolagem, com
  mistura entre quadros e o "idleDrift" mexendo sozinho. O primeiro serviço só fica legível na tela 6,5.
- **Qualidade:** quadros WebP de 1280×720 (960×540 no celular) esticados em tela cheia: 1,3× no
  desktop, 2,6× em tela retina e 3,85× no iPhone; blocos de compressão no clarão do farol.
- **3D falso:** a deformação 2,5D abre uma fresta preta de ~15 px no para-choque, recorte serrilhado do
  carro contra o letreiro, "roda girando" que vira raio de arame, zooms 2D em quadro chato.
- **Serviços sem site:** cada serviço é um número + título + 1–2 frases legíveis por ~1 tela; sem card,
  sem ação por serviço, legendas com `visibility:hidden` fora da janela (somem da árvore de
  acessibilidade e do Tab), números vermelhos a 1,2–1,8:1 sobre a pintura cinza.
- **Funciona e fica:** o configurador, as dúvidas, o rodapé, a rota no mapa, o diagrama de camadas, a
  identidade (Barlow, vermelho, botões inclinados), a acessibilidade básica e os fallbacks.

## 2. Auditoria dos vídeos

Completa em `audit/VIDEO_AUDIT.md`. Resumo:

- Só existe um vídeo de origem: `porsche-scroll.mp4`, 1916×1080, 24 fps, H.264 CRF 24 (já
  recomprimido), I-quadro a cada 0,25 s, 6 Mb/s, faixa TV sem tags de cor, quase monocromático,
  sombras esmagadas (7–11% dos pixels a 4 códigos do preto). Sem cortes: uma aproximação até 9,3 s e
  um recuo até 15 s.
- `poster.webp` (1672×941) é a foto que originou o quadro 0 e tem **4,3–4,5× mais nitidez**: virou a
  fonte do hero.
- Trechos a evitar: 7,04–8,0 s (névoa que deforma, tremor), 8,42–8,88 s (mão fantasma), 9,29–10,96 s
  (borrão da luva, clarão), e os planos molhados do fim como "resultado" (parecem manchados).
- Teste de busca (Chromium, blob, VP9): GOP denso (-g 8) busca **~5,7× mais rápido** que o GOP padrão
  (mediana pareada 166 vs 942 ms, p95 420 vs 2389 ms com a máquina carregada; 56–123 ms sozinho).
- Decisões: lavagem = 5,25→7,0 s (f126→f168, 43 quadros, congela no quadro mais nítido do jato);
  PPF = 2,25 s (o carro inteiro); resultado = 3,5 s (I-quadro, seco e nítido); todos ampliados 2× com
  Real-ESRGAN; vídeo nunca em tela cheia (moldura de 62vw no desktop, quadrada no celular).

## 2b. Referências (o que cada uma empresta)

Pesquisa completa, com capturas e o que não copiar, em `audit/REFS.md`.

| Referência | O que a JETCAR usa |
|---|---|
| Porsche 911 Turbo S (página do modelo) | O carro esconde só as letras do meio do letreiro, nunca a primeira nem a última; o primeiro quadro já é uma foto pronta. A JETCAR separa letreiro e carro em velocidades diferentes (a Porsche os move juntos). |
| Porsche Car Configurator | Pedido com hierarquia simples e uma linha de resumo ("Seu pedido") que acompanha até a rota. |
| McLaren W1 | Cada capítulo com um dispositivo diferente (assistir ↔ explorar); controle de cena com `role`, `aria-label` e alternativa de teclado. |
| Ferrari F80 | Anatomia dos rótulos técnicos: título em caixa alta, linha fina, quadradinho no ponto; o que evitar: órbita longa controlada pela rolagem. |
| Lamborghini Temerario | Card de serviço = número + nome condensado + uma linha + uma ação. |
| Polestar 5 | Moldura de linha fina desenhada pela luz e índice com marcador que anda: o trilho de luz da navegação. |
| Lucid Air | Mapa escuro com uma única rota branca e rótulos em caixa alta: o fim da linha de luz. |
| Apple AirPods Pro | Uma mudança por vez com o objeto preso (a linha passa e só uma coisa muda). |
| iyO One (Awwwards) | Vista explodida num só eixo com a camada transparente no meio; a JETCAR deixa a pessoa controlar a separação. |
| XPEL / STEK | A película aparece pela borda e pelo brilho, sem cor; a borda é a linha de luz. |
| Olivier Larose / NAYA (card stacking) | O empilhamento usado uma vez, no pico (card 04 sobre o 03). |


## 3. Layer contract do hero

Câmera virtual com perspectiva real (FOV 32° no desktop, 40° no celular), olhando o carro a
6 m. Cada plano é uma camada separada no WebGL, posicionada na sua profundidade; o movimento
vem da câmera, então a velocidade relativa de cada plano é consequência da distância, não de
um número escolhido à mão. Só a tipografia e os controles ficam no HTML.

| Plano | Asset e profundidade | Movimento independente | Velocidade relativa (dolly) | Oclusão | Contato físico | Rolagem | Pointer (só ponteiro fino) |
|---|---|---|---|---|---|---|---|
| Far environment | Placa limpa do galpão (carro e reflexo removidos), parede a 14 m | Nenhum próprio | 1× (escala 1,00 → 1,05) | Atrás de tudo | Linha parede/piso no horizonte | Dolly lento | ±2 px |
| Midground | Piso brilhante como plano horizontal real, com o reflexo do carro gerado do recorte (espelhado, desfocado pela rugosidade) e tiras de luz verticais da arquitetura | O reflexo do carro acompanha o carro; as tiras ficam | perspectiva do chão (0 a 2×) | Sob o carro | Sombra de contato sob os pneus | Dolly | — |
| Atmosfera | Feixe de luz do teto e névoa baixa no piso, planos de volume suaves a 9–11 m | Respiração lenta própria (tempo) | 1,2× | Atrás do carro, não lava o texto | — | Afina ao aproximar | — |
| Tipografia de fundo | Letreiro JETCAR (o próprio logo, HTML/SVG) a 9 m, entre parede e carro | — | 1,4× | **O teto do carro oclui a base das letras** (máscara com a silhueta exata do recorte) | — | Escala com o dolly, some na saída | ±3 px |
| Focal subject | Carro recortado com alfa real, ampliado 2×, normais para a luz, a 6 m | A luz percorre a carroceria | 2,5× (1,00 → 1,30) | Oclui letreiro e piso | **Pneus no piso**: pivô de escala na linha de contato | Dolly até o capô | ±6 px |
| Near foreground | Borda de pilar com tira de luz (a arquitetura do galpão), a 1,8 m, fora de foco | — | 6× (sai de quadro) | Oclui a borda do quadro e um pedaço do galpão, nunca o carro inteiro nem o texto | Chão | Atravessa e sai pela lateral | ±12 px |
| Tipografia/controles | H1, texto, Agendar, Ver serviços em HTML, canto inferior esquerdo | — | estável | Sempre na frente | — | Sobe e some entre 55% e 85% | nenhum |

Abertura (antes de rolar): o galpão escuro, o carro inteiro apoiado no piso, o letreiro JETCAR
grande atrás do teto, a headline legível no canto. A linha varre uma vez (1,6 s) e deixa o carro
aceso. Meio: a câmera avança, o pilar passa pela lateral, o letreiro fica atrás do carro.
Saída: perto do capô, a linha deita no piso e desce até a borda da tela, onde vira a borda de
cima da moldura da baia 01.

Celular: câmera mais alta e mais aberta, carro centralizado mais baixo, letreiro acima do carro
(sem oclusão), headline embaixo; o pilar fica fora.

## 4. Feeling curve e análise do pico

| Ato | Sentimento | O que causa |
|---|---|---|
| Hero | calma | O carro parado no escuro; a linha o encontra uma vez |
| 01 Lavagem | curiosidade → impacto → pausa | Água sob a rolagem; congela; o jato fica suspenso fora da moldura; card 01 |
| 02 Polimento | descoberta (silêncio) | Preto; a luz de inspeção revela o que não se via; você guia a luz |
| 03 + 04 Proteção | **PICO**: domínio e assombro | Você separa a pintura; a luz corre entre as camadas; a de cima segura a água; card 04 empilha; película atravessa a carroceria |
| 05 Interior | intimidade | Pelo vidro para dentro; para; você toca os detalhes |
| Resultado | orgulho | Foto inteira do carro pronto, a luz passa uma vez |
| Configurador | decisão | Três passos precisos |
| Endereço | chegada | A linha vira a rota e termina na porta com o seu pedido |

Pico: Ceramic sozinho seria um pico curto (só separar e juntar); PPF sozinho é um antes/depois.
Juntos contam uma única transformação (de pintura exposta a pintura protegida), e o card
stacking nasce exatamente do sentido deles: o card 04 assume a frente e o 03 recua como uma
camada por baixo. Então o pico é **um ato só, Proteção (03 + 04)**, com o maior espaço de
rolagem (4,4 telas contra 2,6 do segundo maior), o maior investimento de asset (a única cena 3D
interativa de verdade) e o Polimento, escuro e lento, logo antes como silêncio.

## 5. Scroll journey

1. **Recognition**: é um carro como o seu, num lugar que cuida de carro.
2. **Curiosity**: a lavagem não é qualquer lavagem (tempo suspenso, água no espaço).
3. **Discovery**: a luz mostra o que o olho não via no verniz.
4. **Peak / Understanding**: proteção são camadas; você as separa e vê a de cima trabalhar; a
   película fecha por cima.
5. **Intimacy**: o lado de dentro também.
6. **Resolve**: o carro pronto.
7. **Commitment**: monte o pedido e veja onde fica.

## 6. Scroll score

| Beat | Device | Feeling | Visual change | User input | Exit | Span (desk / cel) |
|---|---|---|---|---|---|---|
| Hero | **parallax** de planos reais (dolly com perspectiva) + varredura de luz | calma | Linha revela o carro; dolly; pilar passa; letreiro atrás do carro | Rolagem; ponteiro mínimo | A linha deita no piso e vira a borda da moldura 01 | 1,5 / 1,3 |
| 01 Lavagem | **scrub** curto (5 s de footage numa moldura) → congelamento 3D | curiosidade → impacto → pausa | Jato bate; congela; gotas 3D em três profundidades saem da moldura; linha atravessa as gotas e desenha o card 01 | Rolagem (tempo); arrastar/ponteiro olha em volta do momento congelado | As luzes da oficina apagam; o card fica; preto | 2,6 / 2,2 |
| 02 Polimento | **pointer** (luz de inspeção) numa cena presa | descoberta | Preto → linha de LED cruza o capô e revela micro-riscos; a boina passa e deixa pintura corrigida; card 02 na ponta da trajetória | Ponteiro move a luz sutilmente (arrastar no toque); alternar antes/depois no card | A linha encolhe numa fenda horizontal | 2,4 / 2,0 |
| 03 + 04 Proteção | **drag** (separação controlada) em 3D real → **reveal** horizontal (película) + **card stacking** | domínio, assombro | Fenda abre o laboratório; painel se separa em cinco camadas com rótulos; a linha passa entre elas e ativa o coating (gotas); camadas fecham; card 04 empilha sobre o 03; a linha varre e revela a frente do carro; a película atravessa a carroceria com a linha na borda | Arrastar as camadas (ou controle deslizante, ou teclado); arrastar a borda da película | A linha da borda sobe pelo para-brisa como reflexo | 4,4 / 3,6 |
| 05 Interior | **occlusion** (moldura da porta e reflexo do vidro passam pela câmera) → composição parada com **hotspots** | intimidade | Reflexo limpa o vidro; a porta sai pela lateral; cabine parada com quatro pontos | Tocar/passar nos pontos; teclado | A cena sai como página | 2,4 / 2,2 |
| Resultado | **flow + in** (foto inteira) | orgulho | Foto do carro pronto, linha passa uma vez, CTA | Nenhum (CTA) | Fluxo normal | fluxo |
| Configurador | formulário (fluxo) | decisão | Três passos | Digitar, escolher, agendar | Fluxo normal | fluxo |
| Endereço | **draw** (a rota é desenhada pela rolagem) | chegada | Mapa da orla; a linha corre pela Av. Boa Viagem e entra na Rua José Trajano | Rolagem; abrir no mapa | Segura com o pedido e o botão de agendar | 1,6 / 1,4 |
| Dúvidas, rodapé | fluxo | — | — | Abrir perguntas | — | fluxo |

Checagens: famílias usadas (parallax, scrub, pointer, drag/reveal, occlusion/hotspot,
flow, form, draw) ≥ 4; nenhuma igual em seguida; um único scrub; um pico com o maior span;
o ato antes do pico é o mais quieto; total preso ≈ 14,9 telas no desktop (fora da faixa
6–7 atos a 13,6–13,8). Alternância: assistir (hero) → assistir/explorar (lavagem: assiste
o jato, explora o congelado) → explorar (polimento) → explorar/assistir (pico) → explorar
(interior) → assistir (resultado) → agir (configurador) → assistir (rota).

## 7. Lista de devices

| Device | Família | Onde | Implementação |
|---|---|---|---|
| Planos reais com dolly | parallax (com perspectiva verdadeira) | Hero | WebGL: planos em profundidade, câmera perspectiva |
| Varredura de luz | assinatura | Hero, todas | WebGL (cena) + SVG/CSS (cards, trilho, rota) |
| Scrub curto em moldura | scrub | 01 | `<video>` com GOP denso (WebM VP9 + MP4 H.264), playhead suavizado |
| Congelamento com gotas 3D | 3D | 01 | WebGL: quadro congelado + gotas instanciadas com refração e foco |
| Luz de inspeção guiada | pointer | 02 | WebGL: verniz com riscos que só aparecem sob a luz |
| Vista explodida controlada | drag (3D) | 03 | WebGL: cinco camadas com espessura, rótulos HTML, `input range` acessível |
| Card stacking | stack | 03 → 04 | HTML/CSS: 04 sobe e fixa, 03 recua e escurece |
| Película que atravessa | reveal horizontal | 04 | WebGL sobre foto 2× com borda de refração e linha |
| Passagem pelo vidro | occlusion | 05 | HTML: camadas da foto (porta, cabine) e reflexo |
| Hotspots | hotspot | 05 | `button` com rótulo, foco e teclado |
| Foto inteira + CTA | flow + in | Resultado | `<img>` 2× + HTML |
| Ordem de serviço | form | Configurador | HTML (lógica da v5) |
| Rota desenhada | draw | Endereço | SVG a partir do `map.json` (OSM) |
| Trilho de luz | nav | Topo | HTML/SVG com links |

## 8. Signature move

Light Trace (ver §0). Regra de desenho: em WebGL e no DOM a linha tem o mesmo núcleo, o mesmo
halo e o mesmo branco (#fff com halo `rgba(255,255,255,.35)` de 6 a 10 px). Ela nunca
pisca nem fica colorida; muda de função, não de estilo.

## 9. Estratégia de assets

Sem geração (sem chave e sem autorização de créditos), então tudo sai dos assets existentes.
Se um dia gerar algo, usar um único preâmbulo de estilo (rascunho em `ASSETS.md`).

| Cena | Mídia | Origem | Tratamento |
|---|---|---|---|
| Hero | Foto em camadas + 3D de luz | Quadro limpo do plano aberto (master ou `poster.webp`) | Recorte com alfa (BiRefNet), placa limpa (LaMa), ampliação 2× (Real-ESRGAN), normais do carro (Depth Anything) |
| 01 Lavagem | Vídeo curto + 3D | Trecho do master (jato/luva) | Encode para scrub (GOP 8, VP9 + H.264, 1080p na moldura, nunca tela cheia), quadro de congelamento em PNG ampliado |
| 02 Polimento | 3D | Procedural | Material de verniz da v5 refeito para a cena |
| 03 Ceramic | 3D | Procedural | Cinco camadas com materiais próprios |
| 04 PPF | Foto + 3D | Close frontal do master | Ampliação 2× |
| 05 Interior | Foto em camadas | `interior.webp` | Ampliação 2×, profundidade, camadas com recorte |
| Resultado | Foto | `finish.webp` | Ampliação 2× |
| Endereço | SVG | `map.json` (OSM) | — |

Regra de resolução: nenhum vídeo em tela cheia; fotos de tela cheia com pelo menos 2560 px de
largura no desktop; o que for 3D renderiza na resolução da tela (com resolução dinâmica).

## 10. Plano desktop/mobile

| Ato | Desktop (1440×900) | Celular (390×844, e 360×640) |
|---|---|---|
| Hero | Carro à direita do centro, letreiro atrás do teto, texto embaixo à esquerda, pilar à esquerda | Carro centralizado mais baixo e menor, letreiro acima (sem oclusão), texto embaixo, sem pilar |
| 01 | Moldura 16:9 a 62vw à direita, "01" grande atrás, card à esquerda sobrepondo a borda | Moldura 4:5 no alto (recorte do vídeo próprio, 720p), card embaixo |
| 02 | Capô em diagonal, card na ponta da trajetória da luz à direita | Capô mais fechado, luz em diagonal, card embaixo; arrastar move a luz |
| 03 + 04 | Pilha à direita, card à esquerda, rótulos nas bordas | Pilha no alto, rótulos curtos, card embaixo; controle deslizante grande |
| 05 | Cabine inteira, pontos nos quatro itens, card à direita | Recorte vertical da cabine, pontos maiores, card embaixo |
| Resultado | Foto inteira 16:9 | Recorte vertical próprio |
| Endereço | Mapa largo | Mapa vertical, rota curta |

Mais: spans menores no celular, metade das gotas, sem MSAA, DPR até 2.

**Movimento reduzido:** nada preso; cada baia vira uma composição parada no seu ponto de
leitura (hero com o carro aceso, lavagem congelada, polimento com a luz no meio, pilha
separada, película no meio, interior com os pontos, rota desenhada), com os mesmos cards e os
controles funcionando sem animação. Sem vídeo.

**Sem WebGL / sem JavaScript:** pôsteres renderizados da própria cena (desktop e celular) no
lugar de cada canvas, conteúdo completo em fluxo.

## 11. Plano de verificação

1. Depois de cada ato: capturas reais a 0/25/50/75/100% do ato em 1440×900 e 390×844 (e
   360×640 no fim), folha de contato, leitura das imagens.
2. Procurar: corte seco, camadas desalinhadas, carro flutuando (pneu fora do piso), texto
   escondido, overflow, card cobrindo conteúdo, recorte ruim, quadro ruim, emenda, contraste.
3. Ponteiro: capturas com o ponteiro em posições diferentes para provar que os pixels mudam.
4. Interações: arrastar camadas, película, pontos do interior, alternar antes/depois,
   configurador do começo ao fim (mensagem, copiar, link do Direct), menu, trilho de navegação,
   teclado (Tab em toda a página), foco visível.
5. Movimento reduzido, sem WebGL, sem JavaScript, 360×640.
6. Console sem erros, nenhum request falho, nenhum overflow horizontal, contraste medido.
7. `npm run check`.
8. Feel check: rolar a página fria, uma palavra por ato, comparar com a curva.
9. Prévia na Vercel aberta no endereço real.
10. Declarar o que não deu para verificar: aparelho real (iPhone/Android), decodificador H.264
    (o Chromium daqui não tem).

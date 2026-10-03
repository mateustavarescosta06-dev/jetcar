# PLAN · JETCAR v6.2 (ritmo, fluidez, variedade, performance)

Pedido do usuário depois de ver a v6.1: "A versão atual da JETCAR evoluiu MUITO... Agora não quero
reinventar novamente o design." O que melhorar: **fluidez, ritmo, variedade, performance e
sensação de website**. Diagnóstico dele: "O problema atual não é falta de movimento. É o
contrário. Existe movimento/vídeo demais durante a experiência."

Regras que ele fixou (resumo fiel):

- vídeo só quando o plano precisa de movimento; no máximo **dois grandes scrubs**: hero (entrada)
  e final (revelação e saída); "Não quero cinco serviços = cinco vídeos";
- "A fluidez precisa vir da CONEXÃO entre cenas. Não de movimento permanente": uma cena termina
  exatamente onde a próxima começa (match cut), o conteúdo não precisa estar sempre em movimento;
- curva: CINEMA → PAUSA → DESCOBERTA → MOVIMENTO → INTERAÇÃO → SILÊNCIO VISUAL → PICO → RESOLUÇÃO;
  um único pico: **Ceramic**;
- alternar capítulos pesados e leves; vídeo sem decodificar fora da tela, WebGL só quando ativo,
  foto parada = navegador descansando; rolagem rápida, suavização sutil, sem scroll-jacking;
- cada serviço com exatamente um card, e o card nunca entra do mesmo jeito duas vezes seguidas;
- a Light Trace nunca com a mesma função duas vezes;
- teste final: "Se eu desligar os vídeos, ainda existe um site excelente aqui?" SIM. "Os vídeos
  tornam os momentos certos muito melhores?" SIM.

Referências lidas: `SKILL.md`, `devices.md`, `hero-depth.md`, `approved-collection.md`, `feel.md`,
`uniqueness.md` da skill scroll-craft (no máximo dois `scrub`, quatro famílias sem repetir em
seguida, um pico com o maior espaço e silêncio antes dele, final que resolve, `transform`/`opacity`).

## 1. Auditoria de movimento da v6.1

| Capítulo (telas desk/cel) | O que se mexe | O movimento traz informação que uma foto não traria? | Decisão |
|---|---|---|---|
| Hero (1,5 / 1,2) | câmera avança sobre a foto em camadas, a luz varre, atmosfera respira | sim: a profundidade e a luz encontrando o carro | fica como abertura parada (camadas) e entrega ao **scrub 01** |
| 01 Lavagem (2,6 / 2,2) | scrub de 1,75 s na moldura, linha atravessa, gotas 3D voando para fora, card | o jato sim; as gotas voando e a moldura não | o trecho de vídeo vira o fim do scrub 01; a lavagem passa a ser **o quadro congelado em camadas, parado** |
| 02 Polimento (2,4 / 2,0) | capô 3D, barra de luz cruza, politriz 3D passa, segunda passada | a luz revelando os riscos sim; a politriz (objeto de computação gráfica) não | **foto macro presa**; a linha revela riscos, correção e reflexo; sem politriz, sem câmera |
| 03 Ceramic (metade de 4,4 / 3,6) | 3D físico, camadas se separam, linha entre camadas, gotas no coating | sim: material e camadas respondendo à luz | **pico**: fica, ganha o maior espaço e a cena só para ele |
| 04 PPF (outra metade) | foto, película atravessa, card 04 viaja preso à borda e pousa no 03 | a borda passando sim; o card viajando não | **capítulo próprio em split** (macro + card ao lado); o card fica parado |
| 05 Interior (2,4 / 2,2) | linha limpa o vidro, câmera desliza até a cabine, pontos | o vidro sim (é a transição); o deslize não | composição parada, pontos e macros; o card nasce depois dos pontos |
| Resultado (fluxo) | linha varre a foto | não | **foto pura**, sem efeito, e passa a ser a pausa antes do **scrub 02** |
| Endereço (1,6 / 1,4) | rota desenhada | sim (o caminho) | fica, mais curto |

Diagnóstico: todos os atos presos tinham movimento ligado à rolagem, nenhum silêncio autoral, e
quatro atos WebGL seguidos (pesado → pesado → pesado → pesado). Total preso: 14,9 telas.
Fluidez: Lenis com `lerp` 0,09 e o progresso de cada ato suavizado de novo por cima (70 ms):
duas camadas de amortecimento = atraso perceptível entre o dedo e a cena. A cada quadro, cada
ato lia `offsetHeight` do palco depois de outro ato ter escrito estilos (layout forçado por ato
por quadro).

## 2. Curva e pico

| # | Capítulo | Sentimento | O que causa |
|---|---|---|---|
| 1 | Hero + scrub 01 | intriga | o carro parado no escuro em camadas; a rolagem vira câmera e a água bate |
| 2 | 01 Lavagem | precisão | o jato congelado numa foto nítida; nada se mexe além de um respiro da água |
| 3 | 02 Polimento | satisfação | a linha passa e os riscos aparecem; na volta a pintura fica limpa e o reflexo perfeito |
| 4 | Silêncio | antecipação | preto, tipografia grande, o carro quase invisível e parado |
| 5 | 03 Ceramic (**pico**) | assombro técnico | a pintura se abre em cinco camadas reais, a luz passa entre elas, você inclina |
| 6 | 04 PPF | segurança | uma película que só se vê pela borda e pelo brilho, ao lado do card |
| 7 | 05 Interior | cuidado | a cabine parada; você toca os pontos e chega perto do couro |
| 8 | Resultado | desejo | o carro inteiro, parado, nítido, sem efeito |
| 9 | Final + scrub 02 | resolução | a câmera recua até o galpão do começo; JETCAR, Agendar |
| 10 | Agendamento | clareza | interface limpa, três passos |
| 11 | Endereço | chegada | a linha vira a rota |

Pico, como alguém contaria: "a pintura se abriu em camadas na minha frente e a luz passou por
dentro delas". O silêncio antes dele é autoral (capítulo 4), não tela vazia.

Frase de teste (mantida): "É o site em que a luz da JETCAR percorre o carro e cada etapa do
tratamento é revelada conforme você explora."

## 3. Score

| Capítulo | Dispositivo | Família | Peso | Telas (desk / cel) | Card: como entra | Light Trace |
|---|---|---|---|---|---|---|
| Hero + scrub 01 | camadas paradas → vídeo controlado (f0→f168) → congela | scrub | PESADO | 3,0 / 2,6 (com a lavagem) | título já na tela | revela o carro |
| 01 Lavagem | foto congelada em camadas, respiro mínimo | parallax / still | LEVE | (no mesmo ato) | desliza do primeiro plano | nasce de um fio d'água e atravessa a tela |
| 02 Polimento | still preso + máscara guiada pela linha | reveal | LEVE/MÉDIO | 1,6 / 1,4 | revelado pela linha | diagnostica |
| Silêncio | tipografia editorial no fluxo | flow / type | LEVE | ~1 tela de fluxo | — | — |
| 03 Ceramic | 3D físico, camadas, ponteiro | 3D / drag | PESADO | 3,4 / 2,8 (o maior) | fica enquanto separa | iluminação física (luz de área) |
| 04 PPF | split: macro + máscara | reveal / split | MÉDIO | 1,4 / 1,2 | ao lado da macro | borda da película |
| 05 Interior | foto em planos, pontos, macros | pointer / hotspot | LEVE | 1,4 / 1,2 | nasce de um ponto | limpa o vidro na entrada |
| Resultado + scrub 02 | foto parada → vídeo (f84→f0) → JETCAR | scrub | PESADO | 2,2 / 1,8 | — | — |
| Agendamento | HTML | flow / form | LEVE | fluxo | — | — |
| Endereço | mapa SVG | draw | LEVE | 1,0 / 0,8 | — | vira rota |

Alternância: PESADO → LEVE → LEVE/MÉDIO → LEVE → PESADO → MÉDIO → LEVE → PESADO → LEVE → LEVE.
Dois scrubs, sete famílias, nenhuma repetida em seguida, o pico com o maior espaço e silêncio
antes dele. Preso no total: ~13 telas no desktop (contra 14,9), e a primeira baia (Lavagem)
legível na tela 2, não na 5.

Mídia (por tempo de tela, aproximado): vídeo ~20%, foto ~40%, 3D ~15%, HTML/tipografia ~25%.

## 4. Transições (a cena termina onde a próxima começa)

- **Hero → scrub**: a foto em camadas é o próprio quadro 0 do filme. A câmera volta ao
  enquadramento do quadro 0, o letreiro e o título saem, e o vídeo entra no mesmo quadro.
- **Scrub → Lavagem**: o último quadro do vídeo (f168) troca pela foto 2560 do mesmo quadro
  (40 dB entre os dois). O vídeo para de decodificar. Agora é foto, e o card desliza.
- **Lavagem → Polimento**: um fio d'água no capô acende e vira a Light Trace; a linha atravessa a
  tela e apaga a foto atrás dela (fica preto). A linha é um elemento fixo da página: não desliza
  quando o palco do ato seguinte sobe, e entra no Polimento já como a luz de inspeção.
- **Polimento → Silêncio**: o reflexo perfeito apaga por último; o preto já é o fundo do silêncio.
- **Silêncio → Ceramic**: do preto, a fenda de luz abre o laboratório (já existia).
- **Ceramic → PPF**: as camadas fecham, a cena apaga no preto; a borda de luz vira a borda da
  película na macro.
- **PPF → Interior**: a macro se aproxima do para-brisa até o vidro escuro ocupar o quadro; corte
  no escuro; a linha limpa o vidro do interior (já existia).
- **Interior → Resultado**: a cabine apaga; a foto do carro inteiro entra parada.
- **Resultado → scrub 02**: a foto do resultado é o quadro 84 do filme em 4K; o vídeo começa no
  mesmo quadro e recua até o quadro 0, o galpão do começo (o fim espelha a abertura).

## 5. Performance

- Lenis com `lerp` 0,15 e roda 1:1; suavização do progresso dos atos de 70 para 30 ms.
- Nada de ler layout por quadro: altura do palco medida no layout, não no `track()`.
- Vídeo: o arquivo só é baixado perto do ato (Blob), só faz busca de quadro com o ato visível, e
  é liberado longe dele. Fora dos dois scrubs não existe vídeo na página.
- WebGL só no hero (até o vídeo assumir) e no Ceramic; lavagem, polimento e PPF passam a ser HTML
  (imagens na resolução do aparelho, sem escala de render).
- Animação só em `transform`, `opacity` e `clip-path`; nada de `transition: all`, nem `left`,
  `top`, `width`, `height` animados (os rótulos da película usavam `left`/`right` por quadro).

## 6. Celular

- Hero em camadas próprio (como hoje) e um clipe curto: o recorte quadrado do jato (f126→f168,
  o `scrub-m` atual), que congela na `freeze-m`.
- Polimento, PPF e interior com recortes próprios; o split do PPF vira pilha (macro em cima, card
  embaixo).
- Final: a foto do resultado em pé (pausa) e um clipe quadrado curto do recuo.
- Ceramic simplificado no perfil padrão (já existe a escada de qualidade).

## 7. Assets (sem gerar nada novo: créditos só com autorização)

| Asset | Origem | Tratamento |
|---|---|---|
| Scrub 01 (desktop) | master f0→f168 | f0–f125 extraídos em BT.709 e ampliados com Real-ESRGAN (f126–f168 já existem), textura de volta (`detail_blend.py`), 1920 px, H.264 CRF 18 / VP9 CRF 20, GOP denso |
| Scrub 02 (desktop) | os mesmos quadros f84→f0, invertidos | mesmo pipeline |
| Scrub 01/02 (celular) | recortes quadrados | 1080×1080 |
| Lavagem em camadas | `freeze-2560` (f168) | profundidade (Depth Anything Small): água da frente separada do capô; capô limpo por LaMa onde a água sai |
| Polimento | render da própria cena do polimento (3D da v6.1) em alta resolução | três quadros alinhados: pintura, riscos acesos, pintura corrigida com o reflexo |
| PPF | `front-3200` | versão "com película" no mesmo enquadramento (brilho e casca de laranja finíssima), sem cor |

O que só um asset novo resolveria (fica como opção, com autorização de créditos): um clipe real da
película sendo aplicada, o portão abrindo com o carro saindo no final, macros reais de couro.

## 8. Verificação

- Contact sheets por capítulo (entrada, card, meio, saída) em 1920, 2560, retina, 390×844 e 360×640.
- **Revisão de ritmo**: rolar do início ao fim sem parar (sequência de quadros a passo fixo) e
  anotar onde cansa, onde fica lento, onde parece travar, onde há movimento demais, onde não muda
  nada, onde dois capítulos parecem iguais.
- **Sem vídeo**: bloquear os dois vídeos e conferir que a página continua completa e boa.
- Movimento reduzido, sem WebGL, sem JavaScript, teclado e console.
- Performance: trabalho por quadro em cada capítulo, WebGL desenhando só no hero e no Ceramic,
  vídeo sem buscas fora da tela.

## 9. Como ficou (implementação)

Mudanças em relação ao score da seção 3, decididas na construção:

- **Hero e Lavagem em dois atos** ligados por uma passagem no lugar (`data-handoff="0"`): o hero
  termina na foto do último quadro do filme e a Lavagem, presa por baixo, começa na mesma foto. O
  hero entrega o WebGL ao vídeo no quadro 0 (a câmera da composição volta à câmera original do
  filme, o letreiro, o pilar, a atmosfera e o título saem, e o canvas apaga sobre o vídeo parado
  no mesmo quadro; deslocamento medido entre os dois: zero). No celular o filme é só o jato, num
  quadrado.
- **A linha entre Lavagem e Polimento** nasce na borda mais clara do jato (o fio d'água do bico
  até o capô, inclinado ~29°) e mantém essa inclinação no Polimento. A foto apaga em volta dela; o
  Polimento começa no preto com a mesma linha (passagem no lugar).
- **Polimento em HTML**: três renders alinhados da cena da v6.1 (pintura limpa, micro-riscos acesos
  pelo máximo de três posições da luz de inspeção, reflexo da barra) em janelas móveis. Ida: a luz
  de inspeção (riscos inteiros rente à linha, marcados por onde ela passou). Volta: a pintura fica
  limpa atrás dela e o card 02 aparece quando ela passa por ele (recorte pela linha). Depois a barra
  acende (o reflexo perfeito) e a cena apaga no preto do silêncio.
- **Ceramic → PPF**: a cena apaga e sobra uma costura vertical de luz (`--seam`); no PPF a costura é
  a borda da película. **PPF → Interior**: a película escurece em vidro, o Interior começa no mesmo
  vidro e a linha o limpa.
- **Resultado e Final em dois atos**: o resultado é a pausa (foto parada, título); o final começa
  preso por baixo no mesmo quadro 84 e recua até o quadro 0, que troca pela foto nítida e recebe a
  marca. No celular o final não tem vídeo (menos vídeo no celular): a foto fica e a marca aparece.
- **Pedido em quatro passos**: carro → o que melhorar (brilho, marcas, proteção, limpeza, interior,
  não sei) → serviços (sugeridos pelo passo anterior, a pessoa muda) → contato.
- Lavagem com **dois planos** (Depth Anything V2 Small, máscara de borda bem suave: o carro chega
  1,4% mais perto que o fundo ao longo do ato; no começo as camadas coincidem com o quadro do filme).

## 10. Verificação

- **Passagens**: hero (fim) × lavagem (começo) 68 dB (a mesma foto); WebGL × vídeo no quadro 0 sem
  deslocamento (correlação de fase 0,0 px); Ceramic (fim) × PPF (começo) e PPF × Interior no mesmo
  lugar nas capturas de desktop e celular.
- **Sem vídeo** (MP4/WebM bloqueados): o hero fica com o avanço em WebGL da v6.1 e entra na foto do
  jato depois de um escuro; o final corta pelo escuro da foto do resultado para a do galpão (a fusão
  das duas mostrava dois carros: corrigido). Resposta ao teste: SIM, o site continua inteiro.
- **Desempenho** (rastreio passo a passo numa tela pequena, para o renderizador por software dar
  conta): quadros WebGL só no hero até o vídeo assumir e no Ceramic; depois do Ceramic, nenhum (antes
  da correção ele seguia desenhando quadros pretos por baixo do PPF: palco que saiu da frente agora
  não conta como visível). O vídeo da abertura é solto duas telas depois do hero; o do final só baixa
  2,5 telas antes e é solto depois; buscas de quadro só com o ato visível.
- **Modos parados** (movimento reduzido, sem WebGL, sem JavaScript): todas as baias legíveis, cada
  uma no ponto de leitura, cards empilhados; nenhuma linha ou véu sobrando.
- **Teclado**: a ordem do Tab segue a página (barra, hero, cada card com os controles da sua baia,
  pedido, endereço, dúvidas, rodapé) e o foco leva o ato ao ponto onde o controle aparece.

### Revisão de ritmo

A página inteira rolada em passos de meia tela (1280×800 e 390×844), lendo a sequência como alguém
que só rola:

| Trecho | Primeira leitura | O que mudou |
|---|---|---|
| Hero → Lavagem → Polimento | denso e variado: composição, filme, foto com card, linha, pintura | nada |
| Polimento → silêncio | o preto e a tipografia funcionam como respiro antes do pico | nada |
| Ceramic | longo demais: oito quadros seguidos com a mesma composição (camadas e card) | 3,4 → 3,0 telas (2,8 → 2,5 no celular); continua o maior capítulo |
| PPF, Interior | cada um com começo, interação e saída próprios | 1,5 → 1,2 e 1,5 → 1,3 |
| Resultado → Final | o mesmo carro por umas três telas (pausa + começo do recuo): parece parado | 0,7 → 0,5 e 1,8 → 1,4 |
| Endereço | a rota cabe em menos rolagem | 1,0 → 0,9 |

Total preso no desktop: 15,3 → **13,0 telas** (v6.1: 14,9); celular: **10,2**. Nenhum trecho com
movimento contínuo além dos dois filmes; dois capítulos parecidos em seguida só no resultado →
final, que é a mesma imagem de propósito (o corte invisível), agora mais curto.

Mídia por tempo de tela no desktop (aproximado, ~17 telas): vídeo ~15% (os dois filmes), foto
~35%, 3D ~20% (o Ceramic, o pico com o maior espaço, e a abertura antes do filme), HTML e
tipografia ~30%. O 3D passou um pouco do alvo (10–15%) porque o pico precisa do maior trecho.

## 11. Refino depois da publicação

Pedido: "a rolagem pode ficar um pouco mais fluída, ainda dá um pouco a impressão que tá meio
acelerado e travado" e "detalhes sutis, como referências ao automotivo e à Praia de Boa Viagem".

- Rolagem: Lenis com `lerp` 0,10 (antes 0,15: a roda parava de repente e cada giro parecia um
  tranco) e `wheelMultiplier` 0,9 (menos distância por giro); progresso dos atos assentado em 45 ms
  (antes 30); ~8% mais rolagem nos atos com movimento (14,1 telas presas no desktop, 10,8 no
  celular); as janelas móveis e o vidro com 200vmax de lado em vez de 300vmax (um terço da área
  nas camadas da GPU; cobrem a tela até ~0,5 rad de inclinação).
- Detalhes: "Praia de Boa Viagem" ao longo da orla no mapa (gerador `scripts/data/build_route_svg.py`),
  as coordenadas da loja no endereço e no rodapé, "Sol forte e maresia: perto da praia, a pintura
  sente primeiro." no silêncio, a faixa quadriculada de chegada no alto do rodapé, e "a poucas
  quadras da Praia de Boa Viagem" no endereço e nas dúvidas.

Pedido seguinte: "o vídeo ainda parece vários frames separados, por isso não parece ser algo fluído
e contínuo". Causa medida: poucos quadros para a distância de rolagem (no desktop ~16 px por
quadro no jato e ~13 px no final; no celular ~18 px), e cada troca era um corte seco (a busca
mostra um quadro de cada vez).

- Mais quadros: um calculado entre cada dois no desktop (48 por segundo de filme: abertura com 337
  quadros, final com 169) e dois no celular (72 por segundo, 127 quadros), por
  `scripts/frames/interp.sh` (ffmpeg minterpolate, compensação de movimento bidirecional, sem
  modelo). Os originais ficam intactos e os novos são posições intermediárias do que já existe
  (conferido no jato e nas gotas: sem fantasma). Agora: ~3 px por quadro na aproximação, ~8 no
  jato, ~6 no final e no celular. O ritmo não mudou: a aproximação continua com 55% do scrub e o
  jato com 45%.
- Fusão no player (`js/scrub.js`): um canvas logo acima do vídeo recebe cada quadro que a busca
  entrega por cima do anterior em ~40 ms. Durante a rolagem a imagem anda contínua; parada, é o
  quadro exato (diferença zero contra o vídeo no teste). Se o navegador não desenha o vídeo no
  canvas, fica o vídeo puro.
- Busca mais rápida: a página escolhe o formato que o aparelho decodifica por hardware
  (`mediaCapabilities`: WebM onde o VP9 tem hardware, senão H.264), o H.264 foi para o nível 4.2
  (1080p até 60 por segundo) e o playhead assenta em 40 ms.
- Cortes com as fotos (medidos contra a foto): abertura 41,6 dB (H.264) e 42,0 dB (VP9); final
  46,7 / 41,3 dB (H.264) e 46,7 / 44,2 dB (VP9); celular 40,2 dB (H.264, antes 38,4) e 39,1 dB (VP9).
- Peso: abertura 8,3 MB (H.264) e 10,2 MB (VP9); final 3,9 / 4,9 MB; celular 2,1 / 2,5 MB.

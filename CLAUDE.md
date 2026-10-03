# Contexto e direção do projeto JETCAR

## Objetivo do usuário

Site completo e interativo para @jetcarbv. Histórico das direções:

- v3: site com conteúdo em fluxo e transições em moldura.
- v4 (prévia): identidade editorial própria (Barlow, vermelho chapado), textos em voz humana.
- v5 (publicada em produção em https://jetcar-rho.vercel.app a partir da `main`): filme automotivo controlado pela rolagem em WebGL (um plano-sequência, logo atravessado pela câmera).
- v6 (atual, no branch `claude/jetcar-cinematic-flow`, só prévia até o usuário aprovar a produção): o usuário pediu uma revisão profunda seguindo a skill scroll-craft (/nateherk-design). Problemas da v5 que ele apontou: parecia um vídeo controlado pela rolagem, alguns trechos de vídeo com qualidade ruim, "3D" que era transformação/paralaxe e serviços sem arquitetura de site. A v6 precisa ser claramente um WEBSITE: cenas distintas (nada de câmera contínua ou flythrough), pelo menos quatro famílias de dispositivo sem repetir em seguida, vídeo como uma ferramenta entre outras, alternância ASSISTIR/EXPLORAR, cada serviço com cena, card editorial, interação e transição próprios. Frase de teste dele: "É o site em que a luz da JETCAR percorre o carro e cada etapa do tratamento é revelada conforme você explora." O brief completo, a análise em 11 pontos, as auditorias e as referências estão em `scrollcraft/builds/jetcar-v6/`.
- v6.1 (nitidez, mesmo branch, prévia): o usuário achou a imagem "soft, comprimida, borrada" e pediu para reconstruir o MEDIA PIPELINE e o RENDERING PIPELINE antes de qualquer efeito novo ("CORRIJA A FONTE, NÃO TENTE ESCONDER O PROBLEMA COM CSS OU SHADERS"; ordem: nitidez, profundidade, movimento, uau). A auditoria com todas as medidas, os testes (WebP q88/92/95, CRF 18–24, filtros de textura com pixels, A/B do ESRGAN) e as decisões está em `scrollcraft/builds/jetcar-v6/audit/IMAGE_QUALITY_AUDIT.md`. Linguagem pedida: MOVIMENTO → corte invisível → FOTO NÍTIDA → CARD → INTERAÇÃO → corte → MOVIMENTO; assunto em foco de cada serviço sempre nítido (lavagem: roda/água/superfície; polimento: reflexo da luz na pintura; ceramic: capô; PPF: borda da película; interior: couro/costura/acabamento). Limite honesto: as fontes não passam de 1916 px (o vídeo master tem ~1300 px de detalhe real); o próximo salto depende de fotos reais ou de imagens novas em 4K (créditos só com autorização).

Proibido (pedidos explícitos, v5 e v6): cartões inclinados, "3D" de CSS (rotateY/translateZ aleatórios), cubos, objetos flutuando sem motivo, logo girando, giro de 360° no carro, partículas gratuitas, tipografia com perspectiva exagerada, elementos voando na direção da pessoa, paralaxe excessiva, lens flare barato, neon/ciano/cyberpunk/gamer/NFT, vídeo ruim em tela cheia, vídeo fingindo ser 3D, texto rasterizado em vídeo, grade com os cinco serviços, cards de SaaS (vidro, blur, raio grande, sombra genérica, ícone no canto), o mesmo efeito cinco vezes, tilt/magnet/lanterna seguindo o cursor.

## Requisitos preservados

- O hero é o Porsche 911 Turbo S do filme, agora como fotografia em camadas (placa do galpão, carro recortado, letreiro JETCAR atrás do carro, pilar na frente, atmosfera) com profundidade real; o carro esconde parte do letreiro, mas o título continua legível. A primeira tela funciona antes de rolar.
- Assinatura obrigatória: o JETCAR Light Trace, uma linha de luz branca que muda de função a cada baia (tabela em `scrollcraft/builds/jetcar-v6/PLAN.md` §0).
- Cinco serviços confirmados pelo perfil, nesta ordem: 01 Lavagem técnica, 02 Polimento (correção de pintura), 03 Ceramic Coating, 04 PPF, 05 Higienização interna.
- Local: link https://maps.apple/p/uRv~vCQ0G1zNn4, que o Apple Maps resolve para Rua José Trajano, Boa Viagem, Recife – PE (−8.12055, −34.89937). Rua e coordenadas vêm desse link; não acrescentar número, CEP ou complemento sem confirmação.
- Não inventar telefone, horários, preços, depoimentos, garantias, datas de fundação ou resultados de clientes.
- Contato pelo Instagram https://www.instagram.com/jetcarbv/ (Direct: https://ig.me/m/jetcarbv). O perfil tem WhatsApp, mas o número não foi fornecido.
- O filme e as fotos foram gerados como ilustrações, não são trabalhos reais da empresa; o rodapé avisa ("Fotos e vídeo ilustrativos").

## Arquitetura atual (v6, gramática "Baias de serviço")

HTML/CSS/JavaScript em módulos ES, sem bundler nem etapa de build. `dist/` é a pasta publicada e é fonte mantida à mão, incluindo assets e as bibliotecas em `dist/vendor` (Three.js r186 reduzido ao que o site usa, e Lenis). O vídeo master fica fora dela, em `source/`.

A página é o corredor de uma oficina percorrido baia por baia. Cada ato é um `section[data-act]` com um palco preso (`.stage`, sticky, altura `--lvh`); o JS dá à seção a altura `span × svh + lvh` e o progresso `p` do ato (0…1) é a rolagem dentro dele, suavizado. Com movimento reduzido ou sem WebGL (`state.flat`) nada fica preso: cada ato vira uma composição parada no seu `data-hold`, com o conteúdo empilhado. Entre e depois dos atos vem conteúdo em fluxo normal (resultado, pedido, dúvidas, rodapé). Todo texto, card e botão é HTML.

| Ato | Seção | Telas (desktop/celular) | Dispositivo | Card |
|---|---|---|---|---|
| hero | `#inicio` | 1,5 / 1,2 | Foto em camadas projetada em geometria 3D, luz analítica | título + Agendar |
| wash | `#lavagem` | 2,6 / 2,2 | Único trecho de vídeo (scrub de 1,75 s em moldura, nunca em tela cheia) que congela; gotas 3D que refratam e saem da moldura | 01 |
| polish | `#polimento` | 2,4 / 2,0 | Capô 3D escuro; a luz de inspeção revela micro-riscos; duas paradas no mesmo ponto (riscos, depois limpo) com "Ver antes" comparando; o ponteiro inclina a luz | 02 |
| protect | `#ceramic` | 4,4 / 3,6 | PICO. Vista explodida das cinco camadas em materiais físicos (MeshPhysicalMaterial com luzes de área e mapa de ambiente; separação controlada pela pessoa), linha entre as camadas, gotas d'água com refração no coating; depois a foto do carro e a película atravessando (controle próprio) | 03 e 04 empilhados |
| interior | `#interior` | 2,4 / 2,2 | Foto em dois planos (moldura da porta na frente, cabine atrás), vidro limpo pela linha, depois PARA com pontos para explorar | 05 |
| route | `#endereco` | 1,6 / 1,4 | Mapa SVG (OpenStreetMap) com a rota desenhada pela linha | pedido |

- `dist/index.html`: barra (marca, trilho de luz `nav.lane` com as cinco paradas, Endereço, som, Agendar, menu), os atos, resultado, pedido (`#config`), dúvidas e rodapé. Cada card: `svg.card-trace` (a borda desenhada pela linha), número, título, texto, Explorar, Incluir no pedido.
- `dist/style.css`: tokens (cores, escala de 4 px, `--svh`/`--lvh`), barra e trilho, cards (`--a`, `--pe`, `--draw`, `--head` vindos do JS; nunca `visibility`, para não sair da árvore de acessibilidade), cada baia, versões 1080/960/760/380 px (no celular em pé, a foto do resultado fica no alto e o título embaixo do carro, nunca sobre o farol), e os modos `.no-js`, `.no-gl` e `.reduced` (palco solto, conteúdo empilhado, cards fixos).
- `dist/app.js`: ponto de entrada. Medidas, alturas, Lenis, âncoras (`holdFor`/`scrollFor` de cada ato; corte no preto em saltos longos), botões Explorar, foco por teclado leva ao ponto do ato, ponteiro, resolução dinâmica, carregamento em sequência e o canvas WebGL único: ele vai para o `.gl-slot` do ato GL mais visível (com histerese) e o ato que perde o canvas recebe uma cópia 2D do último quadro. `?debug` expõe `window.__jetcar` (`settle()` para as capturas).
- `dist/js/core.js`: estado, medidas da tela, ponteiro e utilidades (`span`, `smooth`, `smoother`, `css`).
- `dist/js/acts/act.js`: classe base dos atos (altura, progresso, visibilidade, `hold`, movimento reduzido) e `cardState()` (janela de entrada/saída do card e o desenho da borda).
- `dist/js/acts/hero.js`, `wash.js`, `polish.js`, `protect.js`, `interior.js`, `route.js`: um arquivo por ato, cada um com o próprio cronograma em `p`. Ritmo e enquadramento se ajustam nesses arquivos e nos `data-span`/`data-span-m`/`data-hold` do HTML.
- `dist/js/gl/engine.js`: renderizador (alvo HDR, MSAA, profundidade de campo pelo alfa que nunca mistura a meia resolução no que está em foco, bloom só em fontes de luz acima de 4, curva de tom 'photo' (identidade até 1) ou 'hdr', vinheta leve, pontilhado fixo de ±1 nível; sem grão). Qualidade: perfis alto 2 / padrão 1,5 / baixo 1,25 / piso 1,0 (escala de render, até o DPR) e a escada `EFFECTS`/`SCALES` que o app desce e sobe medindo o tempo de GPU (`EXT_disjoint_timer_query_webgl2`) ou os quadros perdidos: efeitos secundários, bloom, amostras do desfoque, atmosfera e multiamostragem caem antes da resolução. `?quality=high|standard|low` fixa o perfil (capturas e comparações).
- `dist/js/gl/physical.js`: capô do Ceramic em materiais físicos (camadas, gotas, mapa de ambiente PMREM do estúdio, `AreaBars`: as barras como RectAreaLight). As tabelas LTC das luzes de área vêm de `vendor/three-ltc.js`, carregado só por essa cena. A transmissão (verniz, coating, gotas) fica em resolução cheia e só cai para a metade no fim da escada de efeitos (`protect.js`).
- `dist/js/gl/glsl.js`: barras de luz analíticas (o reflexo é a menor distância entre o raio refletido e cada barra), ruído, cor.
- `dist/js/gl/studio.js`: luzes de estúdio (`StudioLights.set`), materiais da pintura do polimento (verniz; flocos de 0,33 mm que, menores que um pixel, viram a média das inclinações em vez de um chuvisco de pontos; micro-riscos revelados pela barra de inspeção `uInspBar`, num mapa desenhado com degradês cônicos para a direção da tangente seguir o arco sem saltos, com o tamanho escolhido pela largura do canvas), fundo, piso e números do fundo (já desfocados na própria textura).
- `dist/js/ui.js`: menu (a página atrás fica `inert`), trilho de luz (acende até a baia atual; até 1080 px vira uma linha fina embaixo da barra e a baia atual fica marcada no menu), barra sólida só sobre o conteúdo em fluxo, movimento reduzido (lembrado no aparelho), som, pedido (carro → o que melhorar: Lavagem, Pintura, Ceramic, PPF, Interior, Avaliação → mensagem pronta → Direct), "Incluir no pedido" dos cards, proteção contra a rolagem do teclado no iPhone.
- `dist/js/audio.js`: som ambiente opcional gerado no navegador (desligado por padrão).
- `dist/js/logo-data.js`: gerado (não editar à mão); o hero usa as letras para o letreiro.

Regras das transições: cada baia começa e termina pela luz (fenda que abre e fecha, linha que deita no piso, vidro que a linha limpa); nunca a mesma mídia em duas baias seguidas; um único scrub de vídeo; o pico é o ato Proteção e os cards são as pausas.

## Visual

Identidade da v4 sobre o galpão escuro: Barlow (texto) e Barlow Condensed 700/800 e 800 itálico (títulos, números, botões), OFL, em `assets/fonts`. Vermelho `#d7261e` (`--red`), gradiente bem leve só nos botões; botões em paralelogramo (via `::before`). Cards editoriais em formato de configurador ("01 / LAVAGEM / TÉCNICA / O primeiro toque. / EXPLORAR →"), fundo chapado, borda fina desenhada pela linha de luz, sem vidro, blur, raio ou sombra. Rótulos técnicos com fio e quadradinho. Texto direto, sem travessões, sem slogans genéricos, sem inventar dados.

## Executar e verificar

`npm start` serve http://localhost:3000 (`?debug` expõe `window.__jetcar`). `npm run check` valida a sintaxe dos scripts, os arquivos referenciados e os trechos da lavagem.

QA da v6 com Playwright/Chromium usando WebGL por software (ANGLE/SwiftShader): capturas de cada ato em 0/25/50/75/100% em 1440×900 e iPhone 14 Pro, 360×640, movimento reduzido, sem WebGL e sem JavaScript, ordem do Tab e erros de console. Na v6.1, a matriz de nitidez: entrada, card, meio e saída de cada serviço em 1920×1080, 2560×1440, 1440×900@2 e 390×844@3, sempre com `?debug&quality=high` (sem isso a escada de qualidade desce no renderizador por software), mais recortes 1:1 e a comparação com a v5; e o que o aparelho recebe de fato: o celular no perfil padrão (`?quality=standard`) e o retina nos perfis padrão e baixo, para ver o que a escala de render faz com o assunto em foco. O Chromium do teste não decodifica H.264 (usa o WebM). O renderizador por software é lento e não mede fluidez. Ainda falta conferir em aparelhos reais (Safari/iPhone e um Android médio): fluidez das cenas 3D, busca de quadros no scrub da lavagem, arrastar camadas e película no toque, teclado no formulário.

## Assets e orçamento

- Vídeo master: `source/porsche-scroll.mp4`, 15 s em 1080p, custo já pago de 30 créditos no Higgsfield (limite autorizado naquela geração: 35). Não gerar novos vídeos nem gastar créditos sem nova autorização do usuário.
- Receita de todos os assets (fontes, modelos, licenças e comandos) em `scripts/frames/README.md`. Só modelos com licença comercial: Real-ESRGAN (BSD-3), BiRefNet lite (MIT), LaMa (Apache-2.0), Depth Anything V2 **Small** (Apache-2.0). Não usar Depth Anything V2 Base/Large.
- Níveis de cada foto: desktop alto, desktop padrão e celular com enquadramento próprio, todos reduções de um intermediário (Real-ESRGAN 4×/2× com a textura do original devolvida por `scripts/frames/detail_blend.py`), nunca ampliação de outro nível; `scripts/frames/build_stills.py` (cwebp q92 sharp_yuv; q95 no carro e no congelado). O código escolhe pelo tamanho em px do aparelho (`pickLevel`/`glWidth` em `js/core.js`; `srcset`/`sizes` no HTML).
- `assets/hero/`: `plate.webp` (3344), `plate-m.webp` (miolo em 2× para a câmera em pé), `car.webp` (2×) e `car-3x.webp`, normais do carro.
- `assets/wash/`: `scrub.mp4`/`.webm` 1920×1082 e `scrub-m.*` 1080×1080 (H.264 CRF 18 / VP9 CRF 20, sem quadros B, GOP 8/4, BT.709, `scripts/encode-wash.sh`); `freeze-1920/2560.webp` e `freeze-m.webp` (o último quadro do trecho, q95; o corte vídeo → foto mede 40 dB).
- `assets/protect/`: `front-1920/2560/3200.webp`, `front-m.webp` (retrato: farol e capô) e as máscaras sem perdas. `result-1920/2560/3200.webp` e `result-m.webp`. `assets/interior/`: `far-3584/4608.webp`, `near-3584.webp` e o recorte do celular `far-m`/`near-m`.
- `assets/route.svg`: mapa a partir de `scripts/data/map.json` (OpenStreetMap, ODbL); a atribuição aparece no mapa e no rodapé.
- `assets/posters/` e `og.jpg`: quadros das cenas 3D para sem WebGL e carregamento (2880×1800, 1440 e 1170×2532, perfil alto, q90), gerados com `node scripts/posters.cjs` (site rodando).
- Logo: `jetcar-mask.png` é a fonte; `scripts/trace-logo.cjs` gera `jetcar-logo.svg` e `js/logo-data.js`.

## Melhorias prioritárias

1. Fonte com detalhe real: fotos reais do trabalho (ou, com autorização de créditos, novas imagens em 4K nativo) para o hero, PPF, resultado, congelado da lavagem e a parada do interior (mínimos na auditoria, seção 7). É o que falta para a nitidez passar do limite atual.
2. Validar em aparelhos reais a escada de qualidade (Safari no iPhone sem timer de GPU: decide por quadros perdidos) e o custo dos materiais físicos (transmissão) num Android médio.
3. Integrar perfil, telefone/WhatsApp e dados comerciais quando o usuário enviar.
4. Ajustar ritmo (spans e cronogramas dos atos) e enquadramentos conforme o retorno do usuário.

Preserve acessibilidade, teclado, preferência de redução de movimento e os fallbacks (sem WebGL: pôsteres e conteúdo empilhado; sem JavaScript: conteúdo empilhado com pôsteres).

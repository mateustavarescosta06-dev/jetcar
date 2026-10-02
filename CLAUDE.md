# Contexto e direção do projeto JETCAR

## Objetivo do usuário

Site completo e interativo para @jetcarbv. Histórico das direções:

- v3: site com conteúdo em fluxo e transições em moldura.
- v4 (prévia): identidade editorial própria (Barlow, vermelho chapado), textos em voz humana.
- v5 (publicada em produção em https://jetcar-rho.vercel.app a partir da `main`): filme automotivo controlado pela rolagem em WebGL (um plano-sequência, logo atravessado pela câmera).
- v6 (atual, no branch `claude/jetcar-cinematic-flow`, só prévia até o usuário aprovar a produção): o usuário pediu uma revisão profunda seguindo a skill scroll-craft (/nateherk-design). Problemas da v5 que ele apontou: parecia um vídeo controlado pela rolagem, alguns trechos de vídeo com qualidade ruim, "3D" que era transformação/paralaxe e serviços sem arquitetura de site. A v6 precisa ser claramente um WEBSITE: cenas distintas (nada de câmera contínua ou flythrough), pelo menos quatro famílias de dispositivo sem repetir em seguida, vídeo como uma ferramenta entre outras, alternância ASSISTIR/EXPLORAR, cada serviço com cena, card editorial, interação e transição próprios. Frase de teste dele: "É o site em que a luz da JETCAR percorre o carro e cada etapa do tratamento é revelada conforme você explora." O brief completo, a análise em 11 pontos, as auditorias e as referências estão em `scrollcraft/builds/jetcar-v6/`.

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
| polish | `#polimento` | 2,4 / 2,0 | Capô 3D escuro; a luz de inspeção revela micro-riscos; o ponteiro inclina a luz; "Ver antes" | 02 |
| protect | `#ceramic` | 4,4 / 3,6 | PICO. Vista explodida 3D das cinco camadas (separação controlada pela pessoa), linha entre as camadas, gotas no coating; depois a foto do carro e a película atravessando (controle próprio) | 03 e 04 empilhados |
| interior | `#interior` | 2,4 / 2,2 | Foto em dois planos (moldura da porta na frente, cabine atrás), vidro limpo pela linha, depois PARA com pontos para explorar | 05 |
| route | `#endereco` | 1,6 / 1,4 | Mapa SVG (OpenStreetMap) com a rota desenhada pela linha | pedido |

- `dist/index.html`: barra (marca, trilho de luz `nav.lane` com as cinco paradas, Endereço, som, Agendar, menu), os atos, resultado, pedido (`#config`), dúvidas e rodapé. Cada card: `svg.card-trace` (a borda desenhada pela linha), número, título, texto, Explorar, Incluir no pedido.
- `dist/style.css`: tokens (cores, escala de 4 px, `--svh`/`--lvh`), barra e trilho, cards (`--a`, `--pe`, `--draw`, `--head` vindos do JS; nunca `visibility`, para não sair da árvore de acessibilidade), cada baia, versões 1080/960/760/380 px, e os modos `.no-js`, `.no-gl` e `.reduced` (palco solto, conteúdo empilhado, cards fixos).
- `dist/app.js`: ponto de entrada. Medidas, alturas, Lenis, âncoras (`holdFor`/`scrollFor` de cada ato; corte no preto em saltos longos), botões Explorar, foco por teclado leva ao ponto do ato, ponteiro, resolução dinâmica, carregamento em sequência e o canvas WebGL único: ele vai para o `.gl-slot` do ato GL mais visível (com histerese) e o ato que perde o canvas recebe uma cópia 2D do último quadro. `?debug` expõe `window.__jetcar` (`settle()` para as capturas).
- `dist/js/core.js`: estado, medidas da tela, ponteiro e utilidades (`span`, `smooth`, `smoother`, `css`).
- `dist/js/acts/act.js`: classe base dos atos (altura, progresso, visibilidade, `hold`, movimento reduzido) e `cardState()` (janela de entrada/saída do card e o desenho da borda).
- `dist/js/acts/hero.js`, `wash.js`, `polish.js`, `protect.js`, `interior.js`, `route.js`: um arquivo por ato, cada um com o próprio cronograma em `p`. Ritmo e enquadramento se ajustam nesses arquivos e nos `data-span`/`data-span-m`/`data-hold` do HTML.
- `dist/js/gl/engine.js`: renderizador (alvo HDR, MSAA, profundidade de campo pelo alfa, bloom, curva de filme, vinheta, grão). `pickQuality()` define o perfil (celular: sem MSAA, menos bloom e amostras).
- `dist/js/gl/glsl.js`: barras de luz analíticas (o reflexo é a menor distância entre o raio refletido e cada barra), ruído, cor.
- `dist/js/gl/studio.js`: luzes de estúdio (`StudioLights.set`), materiais da pintura (verniz, flocos, micro-riscos revelados pela barra de inspeção `uInspBar`) e das camadas.
- `dist/js/ui.js`: menu (a página atrás fica `inert`), trilho de luz (acende até a baia atual; até 1080 px vira uma linha fina embaixo da barra e a baia atual fica marcada no menu), barra sólida só sobre o conteúdo em fluxo, movimento reduzido (lembrado no aparelho), som, pedido (carro → o que melhorar: Lavagem, Pintura, Ceramic, PPF, Interior, Avaliação → mensagem pronta → Direct), "Incluir no pedido" dos cards, proteção contra a rolagem do teclado no iPhone.
- `dist/js/audio.js`: som ambiente opcional gerado no navegador (desligado por padrão).
- `dist/js/logo-data.js`: gerado (não editar à mão); o hero usa as letras para o letreiro.

Regras das transições: cada baia começa e termina pela luz (fenda que abre e fecha, linha que deita no piso, vidro que a linha limpa); nunca a mesma mídia em duas baias seguidas; um único scrub de vídeo; o pico é o ato Proteção e os cards são as pausas.

## Visual

Identidade da v4 sobre o galpão escuro: Barlow (texto) e Barlow Condensed 700/800 e 800 itálico (títulos, números, botões), OFL, em `assets/fonts`. Vermelho `#d7261e` (`--red`), gradiente bem leve só nos botões; botões em paralelogramo (via `::before`). Cards editoriais em formato de configurador ("01 / LAVAGEM / TÉCNICA / O primeiro toque. / EXPLORAR →"), fundo chapado, borda fina desenhada pela linha de luz, sem vidro, blur, raio ou sombra. Rótulos técnicos com fio e quadradinho. Texto direto, sem travessões, sem slogans genéricos, sem inventar dados.

## Executar e verificar

`npm start` serve http://localhost:3000 (`?debug` expõe `window.__jetcar`). `npm run check` valida a sintaxe dos scripts, os arquivos referenciados e os trechos da lavagem.

QA da v6 com Playwright/Chromium usando WebGL por software (ANGLE/SwiftShader): capturas de cada ato em 0/25/50/75/100% em 1440×900 e iPhone 14 Pro, 360×640, movimento reduzido, sem WebGL e sem JavaScript, ordem do Tab e erros de console. O Chromium do teste não decodifica H.264 (usa o WebM). O renderizador por software é lento e não mede fluidez. Ainda falta conferir em aparelhos reais (Safari/iPhone e um Android médio): fluidez das cenas 3D, busca de quadros no scrub da lavagem, arrastar camadas e película no toque, teclado no formulário.

## Assets e orçamento

- Vídeo master: `source/porsche-scroll.mp4`, 15 s em 1080p, custo já pago de 30 créditos no Higgsfield (limite autorizado naquela geração: 35). Não gerar novos vídeos nem gastar créditos sem nova autorização do usuário.
- Receita de todos os assets (fontes, modelos, licenças e comandos) em `scripts/frames/README.md`. Só modelos com licença comercial: Real-ESRGAN (BSD-3), BiRefNet lite (MIT), LaMa (Apache-2.0), Depth Anything V2 **Small** (Apache-2.0). Não usar Depth Anything V2 Base/Large.
- `assets/hero/`: placa limpa do galpão, carro recortado (2× e celular), normais do carro.
- `assets/wash/`: `scrub.mp4`/`.webm` (desktop) e `scrub-m.*` (quadrado), GOP denso, saídos de `scripts/encode-wash.sh`; `freeze.webp` (quadro ampliado 2×).
- `assets/protect/`: foto do carro de frente (2×) e máscara. `result-d/m.webp`: foto do resultado (2×). `assets/interior/`: planos de perto e de longe (2×, `scripts/frames/interior_layers.py`).
- `assets/route.svg`: mapa a partir de `scripts/data/map.json` (OpenStreetMap, ODbL); a atribuição aparece no mapa e no rodapé.
- `assets/posters/` e `og.jpg`: quadros das cenas 3D para sem WebGL e carregamento, gerados com `node scripts/posters.cjs` (site rodando).
- Logo: `jetcar-mask.png` é a fonte; `scripts/trace-logo.cjs` gera `jetcar-logo.svg` e `js/logo-data.js`.

## Melhorias prioritárias

1. Validar em aparelhos reais e ajustar o perfil de qualidade (resolução, amostras de foco, número de gotas) conforme a fluidez.
2. Integrar fotos reais, perfil, telefone/WhatsApp e dados comerciais quando o usuário enviar.
3. Ajustar ritmo (spans e cronogramas dos atos) e enquadramentos conforme o retorno do usuário.

Preserve acessibilidade, teclado, preferência de redução de movimento e os fallbacks (sem WebGL: pôsteres e conteúdo empilhado; sem JavaScript: conteúdo empilhado com pôsteres).

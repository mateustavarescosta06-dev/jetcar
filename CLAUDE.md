# Contexto e direção do projeto JETCAR

## Objetivo do usuário

Site completo e interativo para @jetcarbv. As primeiras referências (gravações enviadas pelo usuário) mostram um objeto que gira e se explode em peças com tipografia ao redor, e uma cena que muda de escala, aparece dentro de letras e leva à cena seguinte. O usuário gostou da iniciativa das transições, mas pediu (v3) que o resultado pareça **um site, não um vídeo**:

- transições mais naturais, mantendo a mesma essência (logo com o filme, farol, bolhas, disco, colmeia, camadas, porta, arco, BOA VIAGEM);
- fontes, textos e posicionamento de site; imagens usadas de forma estratégica (em moldura, não em tela cheia o tempo todo);
- mais elementos de site além de imagem + texto; nada de listas em tópicos; mais detalhes;
- tudo que era amarelo agora é **vermelho**, com gradientes bem leves e botões modernos.

Depois da v3 o usuário disse que ainda tinha "muita cara de site feito com IA". A v4 tira os clichês desse visual (fundo escuro com brilhos, vidro, pílulas, rótulos em mono, ícones em quadradinhos, travessões no texto) e assume uma direção editorial de automobilismo: tipografia condensada de placa de estrada, páginas de papel claro, vermelho chapado, números de corrida, fichas e legendas como numa revista, textos em voz humana e local. Não voltar a esse visual genérico.

## Requisitos preservados

- Começar com o vídeo existente do Porsche 911 Turbo S (hero do site, em tela cheia).
- Mostrar o filme em movimento dentro da marca JETCAR; a câmera mergulha no farol, que vira a moldura dos serviços.
- O vídeo continua passando: houve reclamação quando uma versão congelava a reprodução ao vincular os frames à rolagem. A rolagem controla só os efeitos; o vídeo toca sozinho (pausa apenas quando está escondido, para poupar bateria).
- Cinco serviços confirmados pelo perfil: Lavagem técnica, Polimento, Ceramic Coating, PPF, Higienização.
- Local: link fornecido https://maps.apple/p/uRv~vCQ0G1zNn4, que o Apple Maps resolve para Rua José Trajano, Boa Viagem, Recife – PE (−8.12055, −34.89937). Rua e coordenadas vêm desse link; não acrescentar número, CEP ou complemento sem confirmação.
- Não inventar telefone, horários, preços, depoimentos, garantias, datas de fundação ou resultados de clientes.
- Contato pelo Instagram https://www.instagram.com/jetcarbv/ (Direct: https://ig.me/m/jetcarbv). O perfil tem WhatsApp, mas o número não foi fornecido.
- As fotografias de serviço e o vídeo foram gerados como ilustrações, não são trabalhos reais da empresa. A moldura mostra "Imagem ilustrativa"; o rodapé e o diálogo de serviço também avisam.

## Arquitetura atual (v3)

HTML/CSS/JavaScript puro em módulos ES, sem bundler nem dependências de execução. `dist/` é fonte mantida à mão, incluindo assets, e deve ser versionada.

O conteúdo é um site normal que rola de forma nativa (`.flow`); atrás dele, um palco preso (`.stage`, `position: sticky`, decorativo e `aria-hidden`) faz as transições. Cada seção de conteúdo é um bloco (`[data-blk]`) com altura mínima em "unidades" (1 unidade = 85svh) e um `.pin` fixo enquanto o bloco passa, então o texto sobe 1:1 como em qualquer site e as cenas trocam enquanto um texto sai e o próximo entra.

- `dist/index.html`: menu (links, progresso, menu de celular), palco (filme, máscara do logo, rótulos técnicos do logo, moldura com as cenas e chips, arco de cartões) e o conteúdo: hero, serviços, um bloco por serviço, camadas com controle Ceramic/PPF, agendamento (passos, formulário), localização, dúvidas (seção clara que sobe por cima do palco) e rodapé.
- `dist/experience.js`: ponto de entrada. Mede onde cada bloco começa e recalcula a linha do tempo (também via ResizeObserver), suaviza a rolagem (~60 ms), ponteiro/toque, âncoras (rolagem suave por perto, cortina em saltos longos), blocos altos demais rolam sem prender (`.pin-flow`), palco para de desenhar quando a seção de dúvidas o cobre.
- `dist/js/timeline.js`: **a linha do tempo**. `BLOCKS` define a altura mínima de cada bloco; `buildTimeline()` deriva todos os intervalos (`T`) dos inícios medidos (`S`). Ajuste ritmo e pausas de leitura aqui. Também guarda os rótulos da moldura, serviços e pontos focais das fotos.
- `dist/js/media.js`: geometria da moldura (à direita do texto no computador; em cima, com o texto numa folha de papel embaixo, em telas em pé; sempre com espaço para a legenda), fotos com `cover()` e ponto focal, filme (fonte por orientação, autoplay com botão de fallback).
- `dist/js/matte.js`: canvas sobre o vídeo. Recua de dentro das letras até o logo inteiro (filme dentro das letras), mergulha no farol do emblema até o círculo inscrito na moldura e, a partir dela, uma luz de borda suave revela o papel da página (`paperAt()` diz quanto de papel há em cada ponto; o menu e o texto de Serviços usam isso para trocar de cor). No fim, o papel é recortado: fenda de cinema → BOA VIAGEM com o filme dentro.
- `dist/js/scenes.js`: recorte da moldura (farol → círculo → foto retangular → área da foto no cartão do arco) e cenas em DOM/CSS 3D dentro dela: lavagem; polimento (imagem → disco que gira com texto orbital); colmeia que gira até o Ceramic Coating; vista explodida das camadas em estúdio claro com rótulos projetados; PPF com película e porta que abre; interior que encolhe até o cartão da frente do arco de serviços (fotos impressas com borda de papel; arrastar/tocar escolhe o serviço). Também a legenda da moldura ("Fig. N", nome, "Imagem ilustrativa", dica de interação).
- `dist/js/fx.js`: canvas de efeitos do tamanho da moldura: espuma que reage e estoura ao toque, bolhas que viram janelas para o polimento, contornos da colmeia e vidro embaçado que se limpa com o dedo/cursor.
- `dist/js/reveal.js`: revelações por tempo quando o conteúdo aparece (títulos sobem palavra por palavra), como em um site.
- `dist/js/ui.js`: menu (tema escuro sobre vídeo/logo/dúvidas e claro sobre o papel), progresso, link ativo, movimento reduzido (lembrado no aparelho), diálogo do serviço, controle das camadas, seleção de serviço (arco ⇄ campo), ficha de pedido de orçamento com a data do dia, mensagem para copiar e abrir o Direct, proteção contra a rolagem do teclado no iPhone.
- `dist/js/logo-data.js` e `dist/js/type-data.js`: gerados (não editar à mão).

Regra das transições: o estado final de uma cena é o estado inicial da próxima (mesmo retângulo, mesma escala). Fotos usam `cover()` com ponto focal, compartilhado entre DOM e canvas.

## Visual (v4)

- Fontes: Barlow (texto) e Barlow Condensed 700/800 e 800 itálico (títulos, números, botões), OFL, auto-hospedadas em `assets/fonts`. Sem fonte mono.
- Superfícies: vídeo e logo no preto (`--black`), conteúdo em papel claro (`--paper`), dúvidas em preto com fio vermelho no topo, rodapé vermelho. Granulação leve fixa sobre tudo (`body::after`).
- Vermelho `#d7261e` chapado; gradiente bem leve só nos botões (`--grad-red`). Botões inclinados (paralelogramo via `::before` com `skewX`), links sublinhados. Cantos retos (3px).
- Elementos: rótulo de seção com número em itálico vermelho sobre régua fina, número de corrida grande em cada serviço, ficha em linhas (`dl.facts`), índice numerado de serviços, legenda "Fig. N" fora da moldura, pedido de orçamento como ficha de papel, cartões do arco como fotos impressas.
- Texto: frases diretas, "a gente", referências locais; sem travessões, sem slogans genéricos, sem inventar dados.

## Executar e verificar

`npm start` serve http://localhost:3000 (`?debug` expõe `window.__jetcar` para QA). `npm run check` valida a sintaxe de todos os scripts e se os arquivos referenciados existem.

QA da v3 feito com Playwright/Chromium em desktop 1280×720, 1440×900 e 1920×1080, iPhone 14 Pro, iPhone SE, iPad em pé e deitado e celular deitado: capturas por posição, gravações contínuas, medição de quadros com CPU 4× mais lenta e testes de interação (menu, âncoras, arco, formulário, diálogo, camadas, FAQ, teclado, link de pular, movimento reduzido, abrir com âncora, sem JavaScript). O Chromium de teste não decodifica H.264, então o QA usa cópias VP9 só em memória. Ainda falta conferir em Safari/iPhone real: autoplay (Modo Pouca Energia mostra o pôster e o botão), fluidez das cenas 3D e o teclado no formulário.

## Assets e orçamento

Vídeo master: `dist/assets/porsche-scroll.mp4`, 15 s em 1080p, custo já pago de 30 créditos no Higgsfield (limite autorizado naquela geração: 35). Não gerar novos vídeos ou gastar créditos sem uma nova autorização do usuário. As versões servidas (`film-1080.mp4`, `film-720.mp4`, `film-portrait.mp4` e pôsteres) saem do master com `scripts/encode-film.sh`, que apenas reencoda e dissolve 1 s do fim no começo para o loop não ter corte seco.

Logo: `jetcar-mask.png` é a fonte; `scripts/trace-logo.cjs` gera `jetcar-logo.svg` e `js/logo-data.js`. `scripts/trace-type.py` gera os contornos de BOA VIAGEM em Geist 900 (requer fonttools, brotli e uharfbuzz só para regenerar). `poster.webp` e `finish.webp` são originais não usados no momento.

## Melhorias prioritárias

1. Validar em iPhone real (Safari): fluidez, enquadramentos, autoplay e teclado do formulário.
2. Integrar fotos reais, perfil, telefone/WhatsApp e dados comerciais quando o usuário enviar (o usuário avisou que mandará informações do perfil e outras imagens).
3. Ajustar o ritmo em `timeline.js` e os textos conforme o retorno do usuário.

Preserve acessibilidade, teclado, preferência de redução de movimento e alternativas para autoplay bloqueado.

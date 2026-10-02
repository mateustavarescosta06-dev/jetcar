# Contexto e direção do projeto JETCAR

## Objetivo do usuário

Site completo e interativo para @jetcarbv. Histórico das direções:

- v3 (publicada em produção, https://jetcar-rho.vercel.app): site com conteúdo em fluxo e transições em moldura.
- v4 (prévia): identidade editorial própria (Barlow, vermelho chapado), textos em voz humana.
- v5 (atual): o usuário pediu para reformular profundamente. O "3D" anterior era transformação de CSS e foi rejeitado. Ele quer abrir o site e sentir que está controlando um filme automotivo: rolagem = linha do tempo, câmera virtual com profundidade real (dolly, órbita parcial, passagem lateral, primeiro/segundo plano, oclusão, foco), luz como interface (uma linha de luz revela o carro, o reflexo vira a próxima cena), materiais de pintura convincentes, serviços como capítulos de uma jornada única e um final cinematográfico. Teste de qualidade dele: "isso poderia estar num filme da Porsche, McLaren ou Lamborghini?".

Proibido (pedido explícito): cartões inclinados, "3D" de CSS, cubos aleatórios, objetos flutuando sem motivo, logo girando, giro de 360° no carro, partículas gratuitas, tipografia com perspectiva exagerada, elementos voando na direção da pessoa, paralaxe excessiva, lens flare barato, neon/cyberpunk/gamer/NFT.

## Requisitos preservados

- Começar com o filme do Porsche 911 Turbo S em tela cheia.
- O filme aparece dentro das letras JETCAR; a câmera atravessa uma letra e o filme vira a próxima cena.
- Na v5 o próprio filme é controlado pela rolagem (pedido da v5, substitui a regra antiga de "o vídeo continua passando"). Para não congelar, ele respira um pouco quando a rolagem para (`idleDrift` em `shot-film.js`). Sem WebGL, o vídeo volta a tocar em loop atrás do conteúdo.
- Cinco serviços confirmados pelo perfil: Lavagem técnica, Correção de pintura (polimento), Ceramic Coating, PPF, Higienização.
- Local: link https://maps.apple/p/uRv~vCQ0G1zNn4, que o Apple Maps resolve para Rua José Trajano, Boa Viagem, Recife – PE (−8.12055, −34.89937). Rua e coordenadas vêm desse link; não acrescentar número, CEP ou complemento sem confirmação.
- Não inventar telefone, horários, preços, depoimentos, garantias, datas de fundação ou resultados de clientes.
- Contato pelo Instagram https://www.instagram.com/jetcarbv/ (Direct: https://ig.me/m/jetcarbv). O perfil tem WhatsApp, mas o número não foi fornecido.
- O filme e as fotos foram gerados como ilustrações, não são trabalhos reais da empresa; o rodapé avisa ("Fotos e vídeo ilustrativos").

## Arquitetura atual (v5)

HTML/CSS/JavaScript em módulos ES, sem bundler nem etapa de build. `dist/` é fonte mantida à mão, incluindo assets e as bibliotecas em `dist/vendor` (Three.js r186 reduzido ao que o site usa, e Lenis), e deve ser versionada.

Um único canvas WebGL fica num palco preso (`.stage`, sticky, 100lvh, `aria-hidden` no que é decorativo). Atrás dele, `.track` tem um `div.ch` por capítulo com a altura em telas; a posição da rolagem em telas (`state.u`) é a linha do tempo. Depois do trilho vem a página normal (agendamento, dúvidas, rodapé), que sobe por cima do palco.

- `dist/js/chapters.js`: **a linha do tempo**. Capítulos, duração de cada um em telas (`len`), ponto de leitura usado pelo menu (`hold`) e qual cena desenha cada um (`shot`). Ajuste ritmo aqui.
- `dist/js/captions.js`: janelas das legendas em cada capítulo (entra, entrou, sai, saiu) e a claquete.
- `dist/experience.js`: ponto de entrada. Medidas, alturas do trilho, Lenis (roda do mouse), âncoras (rolagem suave por perto, corte no preto em saltos longos), resolução dinâmica, 30 fps quando parado, troca de cena, som opcional, `?debug` (`window.__jetcar`).
- `dist/js/gl/engine.js`: renderizador. Cena num alvo HDR (meio-float, MSAA), profundidade de campo (o alfa da cena guarda a nitidez do pixel), bloom de passos duplos, água na lente, curva de filme, vinheta e grão. `post` são os parâmetros por quadro (cada cena ajusta o que usa; `resetPost()` zera a cada quadro). `pickQuality()` define o perfil (celular: sem MSAA, menos bloom, menos amostras).
- `dist/js/gl/glsl.js`: barras de luz analíticas (o reflexo é a menor distância entre o raio refletido e cada barra: reflexos nítidos que deslizam nas curvas), ruído, cor.
- `dist/js/gl/film.js` e `shot-film.js`: o filme como sequência de quadros WebP (226 quadros, 15 fps) com o mapa de profundidade embutido em cada quadro. O shader faz paralaxe 2,5D, aproximação, faixas de luz que revelam o carro, luminárias acendendo, luz do portão (atrás da câmera) subindo pelo carro e tipografia entre o carro e o fundo. Capítulos: abertura, marca (logo), lavagem e final.
- `dist/js/gl/logo.js`: o logo como parede de laca preta com as letras vazadas (extrusão com chanfro). A câmera recua de dentro do T e depois atravessa a perna do A; o filme continua atrás.
- `dist/js/gl/studio.js` e `shot-studio.js`: estúdio 3D depois do mergulho na pintura. Capô paramétrico com vincos, pintura grafite com verniz, flocos metálicos e micro-riscos que só aparecem sob a luz de inspeção; a boina da politriz passa na frente da lente e deixa a pintura corrigida; luz que atravessa o verniz; gotas que se formam (a câmera entra numa delas); camadas da pintura em vista explodida com rótulos presos às bordas; gotas que escorrem (PPF); a película corre pelo capô; a câmera atravessa o para-brisa e entra no interior (foto com malha deslocada pela profundidade). Números grandes no fundo, fora de foco.
- `dist/js/gl/shot-map.js`: mapa a partir de `assets/map.json` (OpenStreetMap). A linha de luz do chão do fim do filme vira a Avenida Boa Viagem; a rota acende até a Rua José Trajano enquanto a câmera sobe; feixe de luz no destino.
- `dist/js/ui.js`: menu, progresso, link ativo, movimento reduzido (lembrado no aparelho), som, configurador de agendamento (carro → o que melhorar → mensagem pronta → Direct), proteção contra a rolagem do teclado no iPhone.
- `dist/js/audio.js`: som ambiente opcional gerado no navegador (desligado por padrão).
- `dist/js/logo-data.js`: gerado (não editar à mão).

Regra das transições: cada corte acontece no preto, no branco ou por casamento de forma (linha de luz do chão → avenida), então só uma cena desenha por vez. O fim de uma cena é o começo da próxima.

## Visual

Identidade da v4 sobre a jornada escura: Barlow (texto) e Barlow Condensed 700/800 e 800 itálico (títulos, números, botões), OFL, em `assets/fonts`. Vermelho `#d7261e` (`--red`), gradiente bem leve só nos botões; botões inclinados (paralelogramo via `::before`). Legendas como letreiros de filme no canto inferior esquerdo; números de capítulo em itálico vermelho; rótulos técnicos com fio e quadradinho vermelho. Texto direto, sem travessões, sem slogans genéricos, sem inventar dados.

## Executar e verificar

`npm start` serve http://localhost:3000 (`?debug` expõe `window.__jetcar`). `npm run check` valida a sintaxe de todos os scripts, os arquivos referenciados e os 226 quadros das duas sequências.

QA da v5 com Playwright/Chromium usando WebGL por software (ANGLE/SwiftShader): capturas por capítulo em 1440×900 e iPhone 14 Pro, testes de interação (som, menu, âncoras, agendamento, logo, movimento reduzido, teclado). O renderizador por software é lento e não mede fluidez. Ainda falta conferir em aparelhos reais (Safari/iPhone e um Android médio): fluidez do estúdio e da profundidade de campo, quadros do filme ao rolar rápido, teclado no formulário.

## Assets e orçamento

- Vídeo master: `dist/assets/porsche-scroll.mp4`, 15 s em 1080p, custo já pago de 30 créditos no Higgsfield (limite autorizado naquela geração: 35). Não gerar novos vídeos nem gastar créditos sem nova autorização do usuário.
- `dist/assets/film/d` e `film/m`: quadros com profundidade (Depth Anything V2 Small, ONNX), gerados com `scripts/frames/` (ver o README de lá).
- `film-720.mp4`, `film-portrait.mp4` e pôsteres: fallback sem WebGL, gerados com `scripts/encode-film.sh`.
- `interior.webp` + `interior-depth.webp`: foto ilustrativa do interior e a profundidade dela (`scripts/frames/depth_image.py`).
- `map.json`: dados do OpenStreetMap (ODbL), gerados com `scripts/data/build_map.py`; a atribuição aparece no mapa e no rodapé.
- Logo: `jetcar-mask.png` é a fonte; `scripts/trace-logo.cjs` gera `jetcar-logo.svg` e `js/logo-data.js`.

## Melhorias prioritárias

1. Validar em aparelhos reais e ajustar o perfil de qualidade (resolução, amostras de foco, número de gotas) conforme a fluidez.
2. Integrar fotos reais, perfil, telefone/WhatsApp e dados comerciais quando o usuário enviar.
3. Ajustar ritmo (`chapters.js`, `captions.js`) e enquadramentos (`shot-*.js`) conforme o retorno do usuário.

Preserve acessibilidade, teclado, preferência de redução de movimento e os fallbacks (sem WebGL: vídeo em loop e conteúdo empilhado; sem JavaScript: conteúdo empilhado com pôster).

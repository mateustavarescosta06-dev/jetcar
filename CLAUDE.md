# Contexto e direção do projeto JETCAR

## Objetivo do usuário

Landing page completa, cinematográfica e interativa para @jetcarbv. As referências (gravações enviadas pelo usuário) mostram: um objeto central que gira, se explode em peças e troca de fundo claro/escuro com tipografia ao redor; e uma cena que muda de escala, aparece dentro de letras e leva à cena seguinte, abrindo-se a partir de uma fenda. O usuário prioriza inovação nas formas, rotações e interação entre elementos, com continuidade visual durante toda a rolagem e sem divisão explícita de páginas. Não converter em uma landing convencional de cards e seções empilhadas.

## Requisitos preservados

- Começar com o vídeo existente do Porsche 911 Turbo S.
- Mostrar o filme em movimento dentro da marca JETCAR; a marca se amplia para revelar a sequência.
- O vídeo deve continuar passando: houve reclamação quando uma versão congelava a reprodução ao vincular os frames à rolagem. A rolagem controla só os efeitos; o vídeo toca sozinho (pausa apenas quando está totalmente coberto, para poupar bateria).
- Cinco serviços confirmados pelo perfil: Lavagem técnica, Polimento, Ceramic Coating, PPF, Higienização.
- Local: link fornecido https://maps.apple/p/uRv~vCQ0G1zNn4, que o Apple Maps resolve para Rua José Trajano, Boa Viagem, Recife – PE (−8.12055, −34.89937). Rua e coordenadas vêm desse link; não acrescentar número, CEP ou complemento sem confirmação.
- Não inventar telefone, horários, preços, depoimentos, garantias ou resultados de clientes.
- Contato pelo Instagram https://www.instagram.com/jetcarbv/ (Direct: https://ig.me/m/jetcarbv). O perfil tem WhatsApp, mas o número não foi fornecido.
- As fotografias de serviço e o vídeo foram gerados como ilustrações, não são trabalhos reais da empresa. O rodapé e o diálogo de serviço dizem "Imagens ilustrativas".

## Arquitetura atual

HTML/CSS/JavaScript puro em módulos ES, sem bundler nem dependências de execução. `dist/` é fonte mantida à mão, incluindo assets, e deve ser versionada.

- `dist/index.html`: palco visual (`.stage`, decorativo, `aria-hidden`) e camada de conteúdo (`.overlay`) com todos os textos, formulário e diálogos. `#journey` é só o espaçador da rolagem.
- `dist/experience.js`: ponto de entrada. Rolagem nativa define o alvo `u` (em unidades); os visuais seguem com suavização. Ponteiro/toque, saltos (linhas de velocidade em saltos longos), carregamento.
- `dist/js/timeline.js`: **a linha do tempo**. Tudo é medido em unidades (1 unidade ≈ 0,88 da altura da tela; total 23). Ajuste ritmo e legibilidade aqui. Também guarda capítulos, serviços e pontos focais das fotos.
- `dist/js/matte.js`: canvas sobre o vídeo. Recua de dentro da haste do T até o logo inteiro (filme dentro das letras, com leve "vidro" para contraste), mergulha pelo farol do emblema até a lavagem; no fim, fenda de cinema → BOA VIAGEM → logo final.
- `dist/js/scenes.js`: cenas em DOM/CSS 3D. Lavagem; polimento (imagem → disco que gira com texto orbital); colmeia de hexágonos que giram até o Ceramic Coating; vista explodida das camadas da pintura em fundo claro (Base, Cor, Verniz, Proteção Ceramic→PPF) com rótulos projetados em 2D; PPF com película passando e porta que abre; interior que encolhe até virar o cartão da frente de um arco 3D de serviços (arrastar/tocar escolhe o serviço). Cada camada é ligada um pouco antes, quase transparente, para não piscar na troca.
- `dist/js/fx.js`: canvas de efeitos: espuma que reage e estoura ao toque, bolhas que viram janelas para o polimento, contornos da colmeia e vidro embaçado do interior que se limpa com o dedo/cursor.
- `dist/js/copy.js`: entrada/saída dos textos (letras giram em 3D) e foco por teclado: focar algo de uma cena fora da tela leva a rolagem até ela.
- `dist/js/ui.js`: capítulos, movimento reduzido, diálogos, seleção de serviço (anel ⇄ campo), mensagem para copiar e abrir o Direct, proteção contra a rolagem do teclado no iPhone.
- `dist/js/logo-data.js` e `dist/js/type-data.js`: gerados (não editar à mão).

Regra das transições: o estado final de uma cena é o estado inicial da próxima (mesmo retângulo, mesma escala). Fotos usam `cover()` com ponto focal, compartilhado entre DOM e canvas.

## Executar e verificar

`npm start` serve http://localhost:3000 (`?debug` expõe `window.__jetcar` para QA). `npm run check` valida a sintaxe de todos os scripts e se os arquivos referenciados existem.

QA feito com Playwright/Chromium em desktop 1440 e 1920, iPhone 14 Pro, iPhone SE, iPad em pé e celular deitado: capturas por posição de rolagem, gravação contínua, testes de clique no anel, mensagem, diálogos, FAQ, Tab e movimento reduzido. O Chromium de teste não decodifica H.264, então o QA usa cópias VP9 só em memória. Ainda falta conferir em Safari/iPhone real: autoplay (Modo Pouca Energia mostra o pôster e o botão), fluidez das cenas 3D e o teclado no formulário.

## Assets e orçamento

Vídeo master: `dist/assets/porsche-scroll.mp4`, 15 s em 1080p, custo já pago de 30 créditos no Higgsfield (limite autorizado naquela geração: 35). Não gerar novos vídeos ou gastar créditos sem uma nova autorização do usuário. As versões servidas (`film-1080.mp4`, `film-720.mp4`, `film-portrait.mp4` e pôsteres) saem do master com `scripts/encode-film.sh`, que apenas reencoda e dissolve 1 s do fim no começo para o loop não ter corte seco.

Logo: `jetcar-mask.png` é a fonte; `scripts/trace-logo.cjs` gera `jetcar-logo.svg` e `js/logo-data.js`. Tipografia: Archivo variável (OFL, `assets/fonts`), auto-hospedada; `scripts/trace-type.py` gera os contornos de BOA VIAGEM (requer fonttools, brotli e uharfbuzz só para regenerar). `poster.webp` e `finish.webp` são originais não usados no momento.

## Melhorias prioritárias

1. Validar em iPhone real (Safari): fluidez, enquadramentos, autoplay e teclado do formulário.
2. Integrar fotos reais, perfil, telefone/WhatsApp e dados comerciais quando o usuário enviar (o usuário avisou que mandará informações do perfil e outras imagens).
3. Ajustar o ritmo em `timeline.js` conforme o retorno do usuário.

Preserve acessibilidade, teclado, preferência de redução de movimento e alternativas para autoplay bloqueado.

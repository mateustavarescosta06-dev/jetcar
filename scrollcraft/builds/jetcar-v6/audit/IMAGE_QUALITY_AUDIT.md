# Auditoria de qualidade de imagem (v5 em produção e v6)

Pedido: "a NITIDEZ está inaceitável… soft, comprimida, borrada". Antes de mexer em qualquer coisa,
cada etapa em que a imagem perde resolução foi medida. Ordem de trabalho: nitidez, depois
profundidade, depois movimento, depois o "uau".

Medições: três auditorias independentes (v5 em produção, mídia da v6, render da v6) com Python
(numpy/OpenCV/Pillow), ffmpeg/ffprobe, cwebp/dwebp e capturas Playwright. Unidades usadas:

- **ampliação de textura**: px do aparelho por texel armazenado (>1 = a GPU ou o navegador amplia);
- **ampliação de detalhe real**: px do aparelho por px de detalhe que a fonte de fato tem;
- telas de referência: 1920×1080@1, 2560×1440@1, 1440×900@2 (retina) e 390×844@3 (iPhone).

Arquivos de trabalho (fora do repositório): `scratchpad/v5q/` (v5), `scratchpad/audit/` (v6),
`scratchpad/v6/qt/` (testes de WebP e CRF), `scratchpad/miptest/` (filtros), `scratchpad/v6/ab/`.

## 1. Resumo: por que a imagem estava mole

Em ordem de peso, somando v5 e v6:

1. **A fonte tem pouco detalhe.** O vídeo master (`source/porsche-scroll.mp4`, 1916×1080) já é
   uma recompressão x264 CRF 24 (0,12 bit por pixel), com detalhe real de ~1217–1332 px na
   largura (64–70% da resolução nominal; espectro cai 10 dB abaixo da curva 1/f em 0,32–0,35
   ciclo/px). As fotos (hero 1672×941 e interior 1536×1024) são WebP com perdas (~q88), mas
   com banda cheia. Nada passa de 1916 px de largura.
2. **A v5 reduzia essa fonte ainda mais e ampliava na tela.** Quadros do filme em 1280×720 q72
   (desktop) e 960×540 q70 (celular), a 15 fps, com dois quadros misturados (crossfade) em toda
   imagem exibida, e um canvas em 75% (retina) ou 50% (iPhone) da resolução do aparelho. Na
   tela sobrava 71% (1920) / 71% (2560) / 63% (retina) / 50% (iPhone) do detalhe do master.
3. **O render limitava a resolução.** `pickQuality` limitava a escala a 1,5 (retina e celular) e a
   resolução dinâmica só descia: a recuperação exigia quadros abaixo de 14 ms, impossível em
   60 Hz, então um trecho lento (carregamento) baixava a resolução para o resto da visita
   (piso 0,55).
4. **Pós-processamento comendo detalhe.** Grão de 0,035–0,04 (o ruído de alta frequência era 68%
   do detalhe real do carro; SSIM do carro 0,917 só pelo grão). Bloom começando em 0,45 linear
   (joelho 0,5): o halo de um reflexo de 4 px carregava 84% da energia da própria linha. Curva de
   tom com ombro em 0,8 aplicada a foto já graduada (o branco nunca passava de 247/255).
   Profundidade de campo misturando a imagem de meia resolução já a partir de coc 0,04: no
   estúdio da v5, só 9–22% do capô ficava nítido; na v6, o foco da lavagem ficava 1,2 unidade
   antes da moldura (o assunto desfocado) e o polimento usava abertura 0,9.
5. **Variantes do celular eram as menores.** Todo arquivo `-m` era escolhido pela proporção da
   tela, nunca pelos pixels do aparelho, e todo `-m` era a versão pequena: o celular de 3× recebia
   `front-m` 1916×1080 (uma tira de 499 px visível, ampliada 2,34×), `car-m` 989 px, `plate-m`
   1672 px, `scrub-m` 720 px, `result-m` 1200 px. Nenhum tinha composição própria.
6. **Compressão e geração repetida.** WebP q84–q90 sem `sharp_yuv` (4:2:0 sem correção) nas fotos
   da v6; `car-m` era uma segunda geração de WebP sobre o poster q88 (o `plate-m` vinha da placa
   ampliada, em q86); a máscara do PPF era reduzida para 958×540 e salva com perdas.
7. **Matriz de cor trocada.** Os quadros extraídos com o ffmpeg usavam BT.601; o navegador mostra
   o vídeo HD sem marcação como BT.709. Diferença de até 14 níveis nas cores saturadas (pinças,
   brasão) bem no corte do vídeo para a foto.

## 2. A fonte

| Fonte | Tamanho | O que é | Detalhe real |
|---|---|---|---|
| `source/porsche-scroll.mp4` | 1916×1080, 24 fps, 361 quadros | x264 CRF 24, GOP 6 (I B B B P P), 5,96 Mb/s | 64–70% (~1217–1332 px) |
| poster (git `892c586`) | 1672×941 | WebP ~q88 | 100% |
| interior (git `9ed39fa`) | 1536×1024 | WebP ~q88 | 100% |

Quatro dos seis momentos fotográficos da v6 saíam do vídeo (scrub e congelamento da lavagem, PPF,
resultado). Nem WebP melhor, nem ESRGAN, nem escala de render recuperam detalhe que a fonte não
tem. O que dá para fazer sem fonte nova: não perder mais nada (seção 5) e reconstruir com cuidado
(seção 4). O limite real só sobe com fotos nativas em alta (seção 7).

## 3. Onde a resolução se perdia

### 3.1 v5 (produção, https://jetcar-rho.vercel.app)

| Etapa | Onde | Perda medida | Gravidade |
|---|---|---|---|
| Quadros do filme reduzidos para 1280×720 (desktop), sem variante por DPR, mais 5% de sobra para o ponteiro | `scripts/frames/pack.py:8,18`, `js/gl/shot-film.js:47,102` | 1,58 / 2,10 / 2,63 px por texel (1920 / 2560 / retina); só 72–74% da alta frequência sobrevive | crítica |
| Celular: 960×540, e o retrato mostra só 24,75% da largura (238×514 texels) | `pack.py:8`, `shot-film.js:46,96-108` | 4,92 px por texel no iPhone (10,6× no fim do final, 16,7× no mergulho da lavagem) | crítica |
| 15 fps (37% dos quadros descartados) e dois quadros misturados em toda imagem, inclusive parado (`idleDrift` ±0,18 s) | `README.md:8`, `film.js:114-126,193-195`, `shot-film.js:354-361` | dupla exposição: 69–77% do detalhe do quadro; fantasmas de 3–37 px | crítica |
| Profundidade de campo no estúdio (polimento, ceramic, PPF) | `shot-studio.js:251-254`, `engine.js:99-109` | só 9–22% do capô nítido; raio mediano 4–12 px em 1080p | crítica |
| WebP q72 / q70 | `pack.py:19` | SSIM no foco: gotas 0,974→0,908, reflexo 0,976→0,918, roda 0,984→0,936 | alta |
| Escala de render limitada (1,5 no retina e no celular) e resolução dinâmica só de descida | `engine.js:362-366`, `experience.js:71-85` | retina sempre 1,33× esticado, iPhone 2×; piso 0,55 (até 3,6×) | alta |
| Bloom (joelho 0,5, cinco níveis, espalhamento 0,9) | `engine.js:17-58` | halo = 84% da energia de um reflexo de 4 px; contraste do farol 0,903→0,848 | alta |
| Grão 0,04 | `engine.js:210-211` | RMS 2,77 níveis; 68% do detalhe do carro; muda a cada quadro | alta |
| Interior: foto 1536 px num plano deslocado, com DOF | `shot-studio.js:118-126`, `studio.js:507-540` | 3,0–5,4 px por texel; só 29–41% nítido | alta |
| Iluminação calculada a partir dos pixels comprimidos (máscaras, reflexos, letreiro) | `film.js:197-257` | bordas da luz com forma de bloco de compressão; contorno serrilhado do letreiro | alta |
| Mais: zoom sobre quadro fixo (até 3,4×), paralaxe por profundidade (borda esticada até 4,8×), lente/espuma/aberração cromática, curva de tom em 0,8, vinheta 0,6, desfoque de giro de roda sintético, texturas filtradas em espaço gama, fallback com vídeo em tela cheia | ver `scratchpad/v5q/` | — | média/baixa |

Conta de ponta a ponta do quadro do hero (#24): master → 15 fps → Lanczos 1280×720 → WebP q72 →
textura → plano com sobra → crossfade → bloom → ombro → vinheta → grão → canvas a 1,5 → navegador.
SSIM-Y 0,972 e 71% da alta frequência em 1920; 50% no iPhone.

### 3.2 v6 (prévia, branch `claude/jetcar-cinematic-flow`, commit `2183b1a`)

Mídia (ampliações na tela do assunto em foco):

| Momento | Arquivo | 1920 / 2560 / retina / iPhone | Problema |
|---|---|---|---|
| Hero (carro), p=0 → p=1 (avanço 1,62×) | `car.webp` 1978 px q90; `car-m` 989 px | detalhe real 1,15→1,86 / 1,53→2,48 / 1,87→3,03 / 1,06→1,71 | fonte 1672 px; celular com o 1× |
| Hero (placa limpa) | `plate.webp` 3344 q88 (LaMa a 512 px, ampliado 6,5× e borrado) | o preenchimento sob o carro aparece a 3,8–9,9× da própria resolução | mancha sob o carro |
| Lavagem (scrub) | `scrub.mp4` 1916 CRF 20 GOP 8 com B; `scrub-m` 720 CRF 24 | 0,62 / 0,83 / 0,93 / **1,50** | celular reduzido e reampliado; nitidez "respira" a cada GOP |
| Lavagem (congelado, card 01) | `freeze.webp` 2600 q88; `freeze-m` 1080 (1×) | real 1,02 / 1,36 / 1,53 / 1,63 | dois pipelines; salto de textura no corte |
| PPF (card 04) | `front.webp` 3200 q84; `front-m` 1916 (1×, paisagem) | textura 0,60 / 0,80 / 1,00 / **2,34** | o celular via uma tira de 499 px |
| Máscara do PPF | 958×540 com perdas, igual no celular | 2,0 / 2,7 / 3,3 / 4,7 | borda da película amolecida |
| Resultado | `result-d` 3200 q84; `result-m` 1200 | 0,60 / 0,80 / 1,00 / 1,76 | celular reduzido e reampliado |
| Interior (card 05, parada) | `far.webp` 3072 q84, ESRGAN 2× | textura 1,16 / 1,54 / **1,74** / 0,83; por px original 2,3 / 3,1 / 3,5 / 1,7 | o pior card; e o ESRGAN apagou o couro (seção 4) |
| Pôsteres (antes do WebGL e sem WebGL) | 1920×1200 q82 com grão; celular de um canvas a 1,5 | 1,00 / 1,33 / 1,50 / 1,36 | grão vira mancha na compressão |
| Normais do hero (reflexo da barra) | 989×434, 8 bits, profundidade estimada a 518 px | 1,15→3,03 | a linha refletida quebra em degraus |

Render da v6: o motor era o mesmo da v5 (`engine.js`), com os mesmos problemas de escala máxima
(retina 2160×1350 para 2880×1800; iPhone 590×990, depois 519×871 com a resolução dinâmica a
0,88), bloom, grão, curva de tom e mistura do desfoque. Por cena: foco da lavagem fora da
moldura (`wash.js:293`), abertura 0,9 no polimento (`polish.js:112-113`), DOF 0,8 nas camadas,
filtragem trilinear de fotos mostradas perto de 1:1 (até 100% da amostra vindo do mip de meia
resolução). Os números completos estão na auditoria de render (seção 8).

## 4. Testes

### 4.1 Qualidade do WebP (q88 / q92 / q95, cwebp 1.5, `-m 6 -sharp_yuv`)

Referência sem perdas no tamanho de exibição; métricas contra ela; recortes 2× lado a lado
(`scratchpad/v6/qt/*/crops.png`).

| Imagem | q88 | q92 | q95 | q92 sem sharp_yuv |
|---|---|---|---|---|
| Congelado 2560 | 198 KB, 44,75 dB, SSIM 0,9889 | 257 KB, 46,10 dB, 0,9905 | 342 KB, 46,95 dB, 0,9910 | 243 KB, 46,00 dB |
| PPF 2560 | 147 KB, 45,70 dB, 0,9817 | 190 KB, 46,87 dB, 0,9856 | 250 KB, 47,60 dB, 0,9860 | 182 KB, 46,68 dB |
| Interior 4800 | 872 KB, 44,58 dB, 0,9766 | 1117 KB, 45,89 dB, 0,9803 | 1585 KB, 47,11 dB, 0,9820 | 1090 KB, 45,73 dB |

Na tela real a diferença entre q92 e q95 não aparece nos recortes (frisos, raios da roda, reflexos
finos); entre q88 e q92 aparece em degradês escuros e no anel do farol. Escolha: **q92 com
sharp_yuv** nas fotos; **q95** no carro do hero e no congelado da lavagem (o assunto em foco e a
água, que tem mais alta frequência). Máscaras sem perdas.

### 4.2 CRF do scrub (43 quadros, 1916×1080, preset slow, GOP 8)

Contra a referência sem perdas (FFV1), com os quadros alinhados (`setpts=N/(24*TB)`; sem isso o
MP4 parecia ter 26 dB por causa da lista de edição):

| Codificação | Tamanho | PSNR | SSIM |
|---|---|---|---|
| H.264 CRF 18 | 2096 KB | 49,35 dB | 0,9955 |
| H.264 CRF 20 | 1728 KB | 48,23 dB | 0,9947 |
| H.264 CRF 22 | 1412 KB | 47,04 dB | 0,9936 |
| H.264 CRF 24 | 1140 KB | 45,72 dB | 0,9920 |
| VP9 CRF 20 | 2008 KB | 49,25 dB | 0,9943 |
| VP9 CRF 24 | 1676 KB | 48,45 dB | 0,9935 |
| VP9 CRF 28 | 1288 KB | 47,21 dB | 0,9921 |
| VP9 CRF 30 (o da v6) | 1144 KB | 46,70 dB | 0,9914 |

Lado a lado (`crf_raw/crf_crops.png`) o CRF 22 já mostra blocos nas gotas; 18 e 20 ficam
praticamente iguais à referência. Escolha: **H.264 CRF 18** e **VP9 CRF 20**, sem quadros B
(qualidade igual quadro a quadro e busca mais rápida), GOP 8 no desktop e 4 no celular.

### 4.3 Real-ESRGAN: manter, mas com a textura do original

A auditoria de mídia recomendou tirar o ESRGAN ("detalhe inventado"). O teste na tela real
decidiu diferente, com uma correção:

- **A/B no tamanho de exibição do retina** (`scratchpad/v6/ab/ab.png`: Lanczos do original
  contra ESRGAN, mesma região, mesma ampliação): no carro, anel do farol, raios e pinças, frisos,
  borda do retrovisor e linha do teto ficam visivelmente mais nítidos com o ESRGAN; o Lanczos
  mantém o material, mas fica mole. Para o que o pedido lista (reflexos finos, rodas, frisos),
  o ESRGAN ganha.
- **Mas ele apaga textura fina.** No interior, a perfuração do couro virou ondas e a costura
  pontilhada virou uma linha contínua; no hero, o concreto virou "água" e a tela da grade sumiu;
  na lavagem, a névoa do jato ficou lisa. O foco do card 05 é justamente couro e costura.
- **Correção na fonte:** `scripts/frames/detail_blend.py`. Onde o original tem textura fina sem
  direção (tensor de estrutura com coerência baixa) ou detalhe visível que o ESRGAN removeu (menos
  da metade da energia na mesma faixa de frequência), a imagem usa os tons do ESRGAN com o
  detalhe do próprio original; nas bordas, fica o ESRGAN. Nada é inventado: a textura que volta
  é a do master. Cobertura: 4,4% do hero, 17,8% do interior, 5,7% do congelado, 2,4–2,9% do PPF e
  do resultado. Recortes: `scratchpad/v6/blend/check2.png`.
- O filtro guiado para refinar o recorte do carro (alfa do BiRefNet levado a 4×) também foi
  testado e descartado: carro preto sobre galpão escuro dá contraste baixo ao guia, e o filtro
  vira um borrão que alarga a borda (`scratchpad/v6/hero4/cmp3.png`). O alfa ampliado
  bicubicamente fica.

### 4.4 Matriz de cor

`ffmpeg` sem marcação decodifica em BT.601; o navegador, em BT.709. Medido no quadro 168: média
0,02 nível, máximo 14 (cores saturadas). A matriz 3×3 que leva um PNG 601 para 709 reproduz a
decodificação 709 com erro máximo de 2,8 níveis (arredondamento). Os quadros do scrub agora saem
direto em BT.709 e os trechos são marcados como BT.709.

### 4.5 Mipmaps x LinearFilter

Teste com pixels capturados (obrigatório no pedido): seção 6.

## 5. O que foi feito

### 5.1 Mídia (pipeline novo)

```
master (vídeo ou foto)
  → quadros sem perdas, BT.709 (vídeo)                       ffmpeg
  → Real-ESRGAN 4× (fotos) / 4× reduzido a 2560 (quadros)    scripts/frames/upscale.py
  → textura do original de volta                             scripts/frames/detail_blend.py
  → camadas (hero: carro e placa; interior: perto e longe)   hero_layers.py / interior_layers.py
  → níveis: reduções Lanczos do intermediário, nunca de outro nível
  → cwebp -m 6 -sharp_yuv q92 (q95 no carro e no congelado), máscaras sem perdas
                                                             scripts/frames/build_stills.py
  → vídeo: H.264 CRF 18 / VP9 CRF 20, sem B, GOP 8/4, BT.709  scripts/encode-wash.sh
```

| Asset | Desktop alto | Desktop padrão | Celular (enquadramento próprio) |
|---|---|---|---|
| Hero carro | `car-3x` 2967×1302 q95 (canvas ≥ 2000 px) | `car` 1978×868 q95 | `car` 2× (antes 989 px) |
| Hero placa | `plate` 3344×1882 q92 | idem | `plate-m` 2542×1882: o miolo que a câmera em pé vê (u 0,14–0,90), em 2× (antes a foto inteira em 1×) |
| Lavagem, congelado | `freeze-2560` q95 | `freeze-1920` q95 | `freeze-m` 1440×1440 q95, o recorte quadrado do scrub (antes 1080 em 1×) |
| Lavagem, scrub | `scrub` 1920×1082 CRF 18 / VP9 20 | idem | `scrub-m` 1080×1080 (antes 720) |
| PPF | `front-3200` / `front-2560` | `front-1920` | `front-m` 1946×2160: altura inteira, centrado no farol e no capô (antes a foto paisagem 1×) |
| Máscara do PPF | 1916×1080 sem perdas | idem | recorte próprio 974×1080 |
| Resultado | `result-3200` / `result-2560` | `result-1920` | `result-m` 1800×2160 em retrato, sem redução (antes 1200×1440) |
| Interior | `far-4608` | `far-3584`; `near-3584` | `far-m` / `near-m` 2534×2560: o recorte que a câmera percorre (u 0,34–1), 1:1 no iPhone |

Escolha do nível pelos pixels do aparelho: as texturas do WebGL usam a largura do canvas no
perfil de qualidade (`pickLevel`/`glWidth` em `js/core.js`); as imagens HTML usam `srcset` com
larguras e `sizes` (interior `185vw`, que é a parada; resultado `max(100vw, 178vh)`), e o
recorte do celular vem por `<source media>`. Girar o aparelho recarrega a placa e a foto do PPF
na versão certa.

### 5.2 Render

- **Perfis e escada medida** (`engine.js`): escala alta 2, padrão 1,5, baixa 1,25, piso 1,0
  (nunca acima do devicePixelRatio). Desktop começa no alto; celular no padrão e pode subir.
  A cada segundo de desenho ativo, o custo é comparado com o intervalo da tela (60/90/120 Hz ou
  30 no modo economia): pelo tempo de GPU de verdade quando o navegador expõe
  `EXT_disjoint_timer_query_webgl2`, senão pelos quadros perdidos. Dois segundos lentos descem
  um degrau, três folgados sobem um. Ordem de descida: efeitos secundários (metade das gotas e
  contas), níveis do bloom, amostras do desfoque, atmosfera, multiamostragem e só então a
  resolução; a subida faz o caminho inverso (a resolução volta primeiro). Um degrau que falhou
  fica bloqueado por 20 s × 4^(falhas−1). `?quality=high|standard|low` fixa o perfil (testes).
  Isso substitui a resolução dinâmica que só descia.
- **Sem grão.** No lugar, um pontilhado fixo de ±1 nível (não muda por quadro) contra degraus.
- **Bloom só em fontes de luz**: limiar 4,0 linear, joelho 0,1, intensidade 0,35, espalhamento
  0,7. O reflexo da barra na pintura (0,4–2,5) não ganha halo; a barra em si, sim.
- **Curva de tom por tipo de conteúdo**: cenas de foto (hero, lavagem, foto do PPF) usam
  identidade até 1,0 (o branco chega a 255); cenas 3D mantêm o ombro a partir de 0,8.
- **Desfoque que não toca o assunto**: a mistura com a meia resolução só começa em coc 0,15
  (antes 0,04), e o disco de amostras gira por pixel (antes uma gota pequena virava um "favo" de
  cópias). Lavagem sem desfoque: o congelado é uma foto de flash, tudo nítido; as gotas entre a
  câmera e a moldura saíram (fora de foco viravam manchas cinza sobre a água; em foco seriam
  objetos vindo na direção da pessoa). Polimento sem desfoque nenhum (o número do fundo já vem
  desfocado na própria textura); camadas do Ceramic com desfoque só no piso e no fundo; foto do
  PPF sem desfoque.
- **Normal do capô do polimento por pixel** (derivadas exatas da superfície): com a normal
  interpolada dos vértices, o reflexo da barra fazia um "Z" quebrado ao cruzar o vinco; agora é
  uma curva em S, como num espelho de verdade.
- **Vinheta** menor (hero 0,25, polimento 0,35, camadas 0,3, foto do PPF 0,15, lavagem 0,2).
- **Fotos em sRGB**: o hardware converte para linear antes de filtrar (antes a filtragem era em
  espaço gama e escurecia bordas finas de alto contraste).
- **Código morto removido** do composite: lente d'água, espuma, aberração cromática, zoom de
  lente (v5).
- **Interior em pixels inteiros**: na parada, a foto fica em posição de pixel inteiro do aparelho
  (antes a translação fracionária fazia o navegador reamostrar a imagem parada).

## 6. Filtros de textura (teste com pixels)

Quadros renderizados pelo próprio Three.js r186 do site (Chromium, WebGL2 por software),
lidos byte a byte de um alvo de render; referência Lanczos com a mesma convenção de centro de
pixel; 630 quadros com cinco deslocamentos de subtexel (para medir cintilação com a câmera
andando). Configurações: A `LinearFilter` sem mipmaps; B trilinear (o que o site usava); C
trilinear com viés −0,5 no shader (`texture2D(t, uv, -0.5)`); D trilinear com anisotropia 16;
E `LinearMipmapNearestFilter`. Arquivos em `scratchpad/miptest/` (`results.json`,
`crops_flat*.png`, `crops_oblique.png`).

Foto de banda cheia (`front-1920`), PSNR / nitidez / cintilação (1 = como a imagem ideal; abaixo
de 1 é borrão, acima é serrilhado):

| Escala | A (sem mip) | B (trilinear) | C (viés −0,5) | E |
|---|---|---|---|---|
| 0,86 | 39,9 / 0,928 / 0,93 | 36,8 / 0,882 / 0,84 | 39,9 / 0,928 / 0,93 | igual a A |
| 0,75 | 41,6 / 0,941 / 0,98 | 36,0 / 0,867 / 0,81 | 41,6 / 0,941 / 0,98 | igual a A |
| 0,6 | 40,6 / 0,962 / 1,02 | 34,8 / 0,861 / 0,79 | 40,3 / 0,927 / 0,92 | 32,3 / 0,832 / 0,78 |
| 0,5 | 37,3 / 0,972 / **1,19** | 34,2 / 0,874 / 0,92 | **38,6** / 0,917 / 0,94 | 34,2 |
| 0,35 | 31,6 / 1,019 / **1,38** | 33,6 / 0,858 / 0,79 | **36,9** / 0,932 / 1,01 | 29,4 |

Conclusão (aplicada): **trilinear com viés −0,5** em todas as fotos (carro e placa do hero,
congelado da lavagem, foto do PPF). A partir de 0,71× ele usa só o nível cheio, idêntico bit a
bit a "sem mipmap" (nítido); abaixo disso, não serrilha como o "sem mipmap" (cintilação 1,19 a
1,38). O trilinear que o site usava misturava 21% / 40% / 73% do mip de meia resolução em 0,86 /
0,75 / 0,6, e perdia 3–5,5 dB. `LinearMipmapNearest` descartado (pior em 0,6 e 0,35). Planos
oblíquos pediriam anisotropia 16 (54 dB contra 33 dB do trilinear a 72°), mas o hero não é
oblíquo (anisotropia medida ≤ 1,53 no desktop e ≤ 2,06 no piso do celular): mantém anisotropia
4 com o viés. O vídeo do scrub continua sem mipmap (igual a C acima de 0,71×). Ressalva: o
SwiftShader segue a especificação em bilinear e trilinear; a anisotropia de GPUs reais é mais
barata e menos ideal, e desempenho não foi medido.

## 7. Limites (sem esconder)

- **O teto de ~720p já estava no vídeo antes da recompressão CRF 24** (uma ida e volta Lanczos a
  2/3 da escala perde quase nada: 45–46,5 dB), provavelmente um render interno perto de 720p
  ampliado para 1080p. Uma exportação mais limpa do gerador tiraria os artefatos do CRF 24, mas
  não traria resolução.
- **Nada aqui cria detalhe que a fonte não tem.** O ESRGAN reconstrói bordas de forma
  convincente e a textura agora vem do original, mas o master continua sendo um vídeo CRF 24 de
  1916 px com ~1300 px de detalhe real, e as fotos têm 1536–1672 px. Num retina, o hero no fim do
  avanço e a parada do interior ainda mostram cerca de 3× o detalhe real da fonte.
- **O que resolve de verdade é fonte nova**, e isso depende de você: fotos reais (prioridade 2
  do projeto) ou novas imagens geradas em 4K nativo (custa créditos; não gerei nada sem
  autorização). Tamanhos mínimos: paisagem em tela cheia 3200×1800 nativo; retrato 1170×2532
  (1290×2796 no Pro Max); a parada do interior com pelo menos 5333 px de largura nativa, ou um
  enquadramento próprio para ela.
- Este contêiner não tem aparelhos reais: o Chromium dos testes usa WebGL por software
  (SwiftShader), não decodifica H.264 (usa o WebM) e não mede fluidez. A escada de qualidade foi
  verificada na lógica e nas capturas; a calibragem fina precisa de Safari/iPhone e de um Android
  médio.

## 8. Auditoria de render da v6 (detalhe)

Medições da terceira auditoria (modelo numérico da cadeia de pós-processamento + capturas da
base `2183b1a`), e o que foi feito com cada achado:

| Achado | Medido | Gravidade | Feito |
|---|---|---|---|
| Foco do polimento no capô distante; reflexo e riscos com CoC 0,35–1,0 | reflexo com 34–35 px de largura a meia altura (a linha analítica tem 20) | crítica | sem desfoque no polimento |
| Foco da lavagem 1,2 antes da moldura | o congelado inteiro 47–56% trocado pela meia resolução; detalhe fino de 86% para 27% em 1920 | crítica | foco no plano da moldura; só as gotas da frente desfocam |
| Escala de render por "palpite" do aparelho | retina 0,75 linear (2160×1350), iPhone 0,50 (590×990) | crítica | perfis 2 / 1,5 / 1,25 / piso 1,0 com escada medida |
| Resolução dinâmica só de descida | 3 s a 24 fps e 60 s perfeitos terminam em 0,88; 8 s a 24 fps chegam a 0,55 e ficam | alta | escada por tempo de GPU ou quadros perdidos, com subida |
| Bloom alimentado pelos assuntos | 62–67% da energia do reflexo do polimento e 87% da borda do PPF iam para o brilho; borda de 6 px virava 24–30 px | alta | limiar 4, joelho 0,1; borda do PPF e linhas a 3× (abaixo do limiar) |
| Trilinear em fotos maiores que a tela | só 70–86% / 39–76% do detalhe fino ideal no congelado | alta | níveis por tela + viés −0,5 (seção 6) |
| Interior: ampliação, translação fracionária, largura animada | MTF no Nyquist 0,12–0,48 na parada | alta | níveis 4608/3584/celular; posição em pixel inteiro |
| Grão | 1,58 nível RMS medido no capô; congelado nas paradas | média | removido (pontilhado fixo de ±1) |
| Vinheta depois da curva | borda do PPF ×0,53–0,68; reflexo do polimento ×0,34 | média | PPF 0,15, polimento 0,2, demais ≤ 0,3 |
| Ombro em fotos | branco em 246,6 | média | modo foto (identidade até 1,0) |
| Desfoque: CoC sem sinal, poucas amostras | cópias "fantasma" a cada 12–20 px | média | mistura só a partir de coc 0,15; disco girado por pixel; 44 amostras |
| Verniz e coating herdando o desfoque do piso | mistura de 16% (máx. 24%) no coating | média | materiais físicos escrevem nitidez 1 |
| Pôsteres no perfil baixo, ampliados, q82 | celular com ~580 px efetivos de 860 | média | 2880×1800 / 1440 / 1170×2532 no perfil alto, q90 |
| Máscara do PPF 958×540 | 2,0–4,3× ampliada | média | 1916×1080 sem perdas + recorte próprio |
| Sem multiamostragem no celular | serrilhado 2×2 px | média | MSAA 4 no perfil padrão (sai só na escada) |
| Textura dos riscos filtrada como cor | (derivado do código) | média | não alterado; ver seção 9 |
| Filtragem em espaço gama | carro −11% de luminância média no mip | baixa | fotos em sRGB |
| Reflexo varrendo o hero é largo por construção | faixa ~20× a barra | baixa | não alterado (só na abertura) |
| Código morto de lente/espuma/cromática | — | baixa | removido |

## 9. Revisão de completude (o que o desfoque, o bloom e o grão escondiam)

Um quarto agente conferiu as três auditorias contra o código e as medições, corrigiu três
afirmações (acima) e apontou etapas que só aparecem depois que a imagem fica nítida:

| Achado | Feito |
|---|---|
| Mapa dos micro-riscos: o antisserrilhado do canvas girava a direção guardada em RG (riscos partidos em tracinhos) | ângulo dobrado vezes a presença em torno de 0,5 (a borda só encurta o vetor); 2048 px no perfil alto |
| Brilhos analíticos amostrados num ponto (degraus e cintilação nas gotas, sem ajuda do MSAA) | a borda do brilho soma a largura do pixel no raio refletido (`barsFootprint`, `fwidth`) |
| Escala e níveis presos ao DPR do carregamento (janela levada para outra tela, zoom) | o DPR é relido a cada layout e por `matchMedia((resolution))`; a escala acompanha |
| A "refração" da película deslocava a foto 2,5 px bem na borda do PPF | no máximo meio pixel |
| Título do hero sobre a traseira do carro | carro mais à direita (deslocamento de 7% para 10%) |
| MSAA resolvido em HDR linear antes da curva (bordas das barras de luz serrilhadas) | não alterado: o bloom curto cobre a borda das barras; o resto não passa de 1,5 |
| Extração de quadros sem interpolação cheia de croma (degraus de 2×2 nas cores saturadas) | efeito de segunda ordem (o ESRGAN refaz o croma); comando com `accurate_rnd+full_chroma_int` registrado para extrações futuras |
| Texto e escurecimento do resultado sobre a roda | não alterado (composição da foto) |

## 10. O que ficou de fora (e por quê)

- **Quadro de refinamento em escala nativa 3× no iPhone**: o pedido fixou o perfil alto em 2.
- **Fonte nova** (seção 7).

## 11. Verificação visual (e o que ela ainda achou)

Capturas com o código final em `scratchpad/v6/final/` (fora do repositório):

- **Matriz**: 28 momentos (entrada, card, meio e saída de cada serviço; hero, resultado, pedido e
  endereço) em 1920×1080@1, 2560×1440@1, 1440×900@2 e 390×844@3, perfil alto fixo; folhas de
  contato e recortes 1:1 (px do aparelho) dos assuntos em foco.
- **O que o aparelho recebe de fato**: o celular no perfil padrão (escala 1,5, o ponto de partida
  do iPhone) e o retina nos perfis padrão e baixo, no mesmo momento, para medir o que a escala de
  render faz com o assunto (tabela abaixo).
- **ANTES × DEPOIS**: a v5 em produção e a v6.1 no mesmo tamanho de tela (retina e iPhone), sete
  pares (abertura, lavagem, polimento, camadas, PPF, interior, resultado), cada um com o quadro
  inteiro e um recorte 1:1 do assunto.
- **Modos de reserva**: sem WebGL (desktop, iPhone e 360×640), sem JavaScript, e os testes de
  interação (cards, "Ver antes", separador e película pelo teclado, pontos do interior, pedido,
  menu, trilho, rolagem horizontal).

Com a imagem nítida, apareceram problemas que o desfoque, o bloom e o grão escondiam. Todos foram
corrigidos na fonte (no shader ou no gerador da textura, não com filtro por cima):

| Achado | Causa | Feito |
|---|---|---|
| Chuvisco de pontos brancos na pintura do polimento (forte no retina, pontos de 2 px no celular) | flocos de 0,67 mm com a inclinação sorteada por célula: perto da câmera cada floco tinha 2 px e brilhava ~90 vezes mais que o vão; menores que um pixel, cada pixel amostrava a normal de uma célula só e acendia ou não | flocos de 0,33 mm; abaixo de um pixel, a média das inclinações (o reflexo das barras espalhado pela largura do sorteio), que é o brilho metálico visto de longe |
| No celular, micro-riscos com outro desenho, mais grossos | o contador do laço do gerador tinha o mesmo nome da escala (`k`): o mapa de 1024 desenhava arcos duas vezes mais longos que o de 2048; e o tamanho vinha do nome do perfil (o desktop no perfil baixo usava 1024 num canvas de 1800 px) | mesmo desenho em qualquer tamanho; tamanho pela largura do canvas (2048 a partir de 1400 px) |
| Riscos com quinas, acesos aos pedaços | cada arco era uma sequência de segmentos retos de cor fixa (até 78 px no mapa de 2048): a direção guardada mudava aos saltos de um segmento para o outro, e de perto o risco aceso tinha quinas e trechos separados | cada arco num traço só, com degradê cônico em volta do centro (a direção gira junto com o arco; erro medido 0,09° em média, 0,33° no máximo); o mapa sai 3,4× mais rápido (22 ms contra 74 ms) |
| Ceramic mais mole fora do perfil alto (o celular começa no padrão) | a transmissão (verniz, coating e gotas redesenham o que está atrás) ficava em meia resolução fora do perfil alto: a cor e os flocos, vistos através do verniz, saíam com metade dos pixels (no retina em perfil padrão, os flocos da cor visivelmente mais grossos) | resolução cheia; cai para a metade só no fim da escada de efeitos, junto com a multiamostragem |
| Título do resultado sobre o farol no celular em pé | a foto em tela cheia deixava o farol na altura do título; no Safari com as barras à mostra (~660 px) ainda mais | a foto ocupa o alto (76%, ou 64% em tela baixa) e some no fundo; o título fica embaixo do carro |
| Texto do hero colado na borda sem WebGL ou sem JavaScript no celular | a regra do modo de reserva voltava `left`, mas não `right`, que empurrava o bloco 20 px para a esquerda | `right: auto` |
| "Sem proteção" cortado na borda esquerda do PPF no celular (conferido no tamanho do navegador do app, 393×635) | o rótulo acompanha a borda da película e saía da tela quando a borda chegava perto da lateral | cada rótulo só aparece quando cabe inteiro do seu lado da linha |

# Fotos, camadas e trechos (v6, v6.1 e v6.2)

Todos os assets visuais saem de três fontes ilustrativas (geradas por IA, não são trabalhos reais
da empresa):

- o vídeo master `source/porsche-scroll.mp4` (1916×1080, 24 fps, 15 s). É uma recompressão x264
  CRF 24 com ~1300 px de detalhe real na largura: o teto do que sai dele;
- duas fotos que ficaram só no histórico do git:
  `git show 892c586:dist/assets/poster.webp > poster.webp` (1672×941, a foto que originou o
  quadro 0 do vídeo, com banda cheia) e `git show 9ed39fa:dist/assets/interior.webp > interior.webp`
  (1536×1024, a foto do interior da v5).

Nenhuma fonte passa de 1916 px. Os níveis acima disso são reconstrução (Real-ESRGAN) com a
textura devolvida do original, nunca a ampliação de um nível menor. Detalhes, testes e números em
`scrollcraft/builds/jetcar-v6/audit/IMAGE_QUALITY_AUDIT.md`.

Modelos em ONNX, rodando com `onnxruntime`, `numpy`, `Pillow` e `opencv-python`:

| Modelo | Licença | Uso |
|---|---|---|
| Real-ESRGAN General x4v3 | BSD-3 | `upscale.py`: ampliação 4× (blocos de 128 px, sobreposição de 16), reduzida com Lanczos para a escala pedida |
| BiRefNet lite | MIT | `cutout.py`: recorte do carro (alfa) |
| LaMa | Apache-2.0 | `hero_layers.py`: placa limpa do galpão sem o carro |
| Depth Anything V2 **Small** | Apache-2.0 | `hero_layers.py` (normais do carro), `depth_image.py` e os planos da lavagem (`wash_planes.py`) |

Não use o Depth Anything V2 Base/Large nem outro modelo com licença não comercial em assets
publicados.

Ferramentas: `ffmpeg`, `cwebp` 1.4+ (`-sharp_yuv`), e o Python acima.

## Receita

1. **Quadros do master sem perdas e na matriz BT.709** (a do navegador; a BT.601 padrão do
   ffmpeg desloca até 14 níveis nas cores saturadas):
   `ffmpeg -i source/porsche-scroll.mp4 -vf "select='eq(n\,54)',scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=lanczos+accurate_rnd+full_chroma_int+full_chroma_inp,format=rgb24" -frames:v 1 ppf.png`
   (sem `full_chroma_int` o croma vem em blocos de 2×2 nas cores saturadas)
   PPF: quadro 54 (2,25 s). Resultado: quadro 84 (3,5 s). Os dois filmes do desktop:
   `scripts/encode-open.sh` (quadros 0 a 168; o congelamento da lavagem é o 168 e o fim do filme
   final é o 0). O jato do celular: `scripts/encode-wash.sh` (quadros 126 a 168). Quadros já extraídos em BT.601 podem ser
   corrigidos com `to_bt709.py`.
2. **Ampliação**: `python3 upscale.py esrgan.onnx <entrada> <saida.png> 4` nas fotos (poster,
   interior) e `… 2` nos quadros do vídeo.
3. **Textura de volta**: `python3 detail_blend.py <original> <ampliada> <saida.png>`. O ESRGAN deixa
   bordas e reflexos nítidos mas apaga textura fina (couro, costura, concreto, tela da grade);
   este passo usa os tons do ESRGAN com o detalhe do próprio original onde ele tinha textura.
4. **Camadas**:
   - Hero: `python3 cutout.py birefnet_lite.onnx poster.webp alpha.png`, depois
     `python3 hero_layers.py poster.png poster_4x_textura.png alpha.png lama_fp32.onnx depth_small.onnx <saida>`
     (com `-` no lugar do modelo de profundidade, pula as normais, que não mudam):
     `car.png` e `plate.png` sem perdas na escala da ampliada, `normal.webp`, `hero.json`.
   - Interior: `python3 interior_layers.py interior_4x_textura.png <saida>` → `near.png` e `far.png`.
   - Lavagem (v6.2): profundidade do congelado com o modelo Small (`depth_image.py`, com
     `model.onnx` = Depth Anything V2 Small na pasta) e `python3 wash_planes.py freeze-depth.png`
     → `wash/near-mask.png` e `wash/near-mask-m.png` (as máscaras suaves do carro).
5. **Níveis publicados**: `python3 build_stills.py <pasta>` (a pasta com `hero/car.png`,
   `hero/plate.png`, `freeze.png`, `ppf.png`, `result.png`, `ppf_alpha.png`,
   `interior/far.png`, `interior/near.png`) grava em `dist/assets`:

   | Asset | Desktop alto | Desktop padrão | Celular (enquadramento próprio) |
   |---|---|---|---|
   | hero | `car-3x` 2967 px q95 | `car` 1978 px q95; `plate` 3344 px q92 | `plate-m`: o miolo que a câmera em pé vê, em 2× |
   | lavagem | `freeze-2560` q95 | `freeze-1920` q95 | `freeze-m` 1440×1440 (o recorte do scrub) |
   | lavagem, "Ver de perto" | `detail` 1532×972 q95: as gotas no tamanho do intermediário (u 0,55…0,95, v 0,30…0,75) | | |
   | resultado | `result-3200`, `result-2560` | `result-1920` | `result-m` 1800×2160 |
   | interior | `far-4608` | `far-3584`, `near-3584` | `far-m`, `near-m` 2534×2560 (u 0,34…1) |

   q92 com `-sharp_yuv` nas fotos; q95 no carro e no congelado (os assuntos em foco); escolhido
   no teste q88/q92/q95 da auditoria.
6. **Os dois filmes (v6.2)**: `bash scripts/encode-open.sh <pasta> [quadros 2560 já ampliados]`
   grava `open/open.*` (f0 → f168: aproximação e jato), `final/final.*` (f84 → f0, invertido) e
   `final/end-1920|2560.webp` (o quadro 0 como foto). Antes de codificar, um quadro calculado entre
   cada dois (`scripts/frames/interp.sh`: ffmpeg minterpolate por compensação de movimento,
   bidirecional, sem modelo; os originais ficam intactos) dá 48 quadros por segundo de filme:
   337 na abertura, 169 no final. H.264 (nível 4.2) e VP9, sem quadros B, GOP 8, BT.709,
   1920×1082; a aproximação e o recuo com taxa um pouco menor que o jato; os quadros dos cortes
   com a foto em QP 13 no H.264 (com uma cópia do último depois do fim: o x264 não aplica zona ao
   último quadro do fluxo).
   O jato do celular: `bash scripts/encode-wash.sh <pasta> [quadros 2560 já ampliados]`
   (`wash/scrub-m.*`, 1080×1080, três vezes os quadros: 72 por segundo, 127 quadros; H.264 CRF 18
   e VP9 CRF 22, GOP 8).
7. **PPF (v6.2)**: `python3 build_ppf.py ppf.png ppf_alpha.png` → `ppf/off-d|film-d` (farol e capô,
   1533×1555, o painel do desktop) e `ppf/off-m|film-m` (a frente em pé, 1946×2160). A versão
   "com película" é a mesma foto com o que a película muda de verdade, em luz linear e só sobre a
   carroceria: um pouco mais de contraste, um reflexo largo bem leve e uma casca de laranja de ~2%.
   Sem cor.
8. **Polimento (v6.2)**: renders da cena do polimento da v6.1 parada em alta resolução
   (`scripts/render/render-polish.sh`, que explica como servir a v6.1 com
   `scripts/render/polish-still.patch`), depois `python3 build_polish.py <pasta>` →
   `polish/clean|swirl|refl-3200|2560|1920|m.webp`: a pintura corrigida, os micro-riscos acesos
   (o máximo de três posições da luz de inspeção) e o reflexo perfeito da barra, alinhados.

Os pôsteres das cenas 3D (o hero e o Ceramic; sem WebGL e enquanto carregam) e o `og.jpg` saem de
`node scripts/posters.cjs` com o site rodando (2880×1800, 1440 e 1170×2532, perfil alto, q90).

# Fotos, camadas e trechos da v6

Todos os assets visuais saem de duas fontes ilustrativas (geradas por IA, não são trabalhos reais
da empresa):

- o vídeo master `source/porsche-scroll.mp4` (1916×1080, 24 fps, 15 s);
- duas fotos que ficaram só no histórico do git:
  `git show 892c586:dist/assets/poster.webp > poster.webp` (a foto que originou o quadro 0 do
  vídeo, 4× mais nítida que ele) e `git show 9ed39fa:dist/assets/interior.webp > interior.webp` (a foto do interior da v5).

Modelos em ONNX, rodando com `onnxruntime`, `numpy`, `Pillow` e `opencv-python`:

| Modelo | Licença | Uso |
|---|---|---|
| Real-ESRGAN General x4v3 | BSD-3 | `upscale.py`: ampliação 2× (blocos de 128 px, sobreposição de 16) |
| BiRefNet lite | MIT | `cutout.py`: recorte do carro (alfa) |
| LaMa | Apache-2.0 | `hero_layers.py`: placa limpa do galpão sem o carro |
| Depth Anything V2 **Small** | Apache-2.0 | `hero_layers.py` (normais do carro) e `depth_image.py` |

Não use o Depth Anything V2 Base/Large nem outro modelo com licença não comercial em assets
publicados.

## Receita

1. Quadros do master em PNG, sem perdas: `ffmpeg -ss <s> -i source/porsche-scroll.mp4 -frames:v 1 f.png`.
   PPF: 2,25 s. Resultado: 3,5 s. A lavagem sai do `scripts/encode-wash.sh` (trecho de 5,25 a 7,0 s
   e o quadro do congelamento).
2. `python3 upscale.py esrgan.onnx <entrada> <saida2x.png>` em cada foto (poster, quadros, interior).
3. Hero: `python3 cutout.py birefnet_lite.onnx poster.webp alpha.png`, depois
   `python3 hero_layers.py poster.webp poster2x.png alpha.png lama_fp32.onnx depth_small.onnx <saida>`
   e copie `car`, `plate`, `normal` (e `-m`) para `dist/assets/hero/`.
4. PPF: `cutout.py` no quadro de 2,25 s → alfa reduzido para 958×540 → `front-mask.webp`; o quadro 2× vira `front.webp`
   (3200 px) e `front-m.webp`.
5. Interior: `python3 interior_layers.py interior2x.png <saida>` → `near.png` (carroceria e porta
   com alfa) e `far.png` (cabine com a área da moldura escurecida). WebP qualidade 84.
6. Resultado: quadro de 3,5 s ampliado → `result-d.webp` (3200 px) e o recorte vertical
   `result-m.webp`.

Os pôsteres das cenas 3D (sem WebGL e enquanto carregam) e o `og.jpg` saem de
`node scripts/posters.cjs` com o site rodando.

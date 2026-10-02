# Sequência do filme com profundidade

O filme da abertura é controlado pela rolagem, então ele é servido como quadros (WebP), não
como vídeo. Cada quadro leva o mapa de profundidade logo abaixo da imagem, no mesmo arquivo.

Para regenerar a partir do master (`dist/assets/porsche-scroll.mp4`), numa pasta de trabalho:

1. Quadros a 15 fps: `ffmpeg -i porsche-scroll.mp4 -vf fps=15 src/f%03d.png` (226 quadros).
2. Modelo de profundidade: Depth Anything V2 Small em ONNX (`../depth/model.onnx`), com
   `onnxruntime` e `numpy`.
3. `python3 depth_seq.py` → `depth_raw/*.npy` (um mapa por quadro).
4. `python3 depth_post.py` → `depth_all.npy` (normalizado por quadro e suavizado no tempo).
5. `python3 pack.py <saida>` → `<saida>/d` (1280×720 + profundidade 640×360) e `<saida>/m`
   (960×540 + 480×270). Copie para `dist/assets/film/`.

`depth_image.py` gera o mapa de profundidade de uma foto avulsa (usado em
`dist/assets/interior-depth.webp`).

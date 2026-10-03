"""Lavagem (v6.2): as máscaras dos dois planos da foto congelada (o galpão atrás, o carro na frente).

A página põe a mesma foto duas vezes e mostra a de cima só onde a máscara é branca (o carro); ao
rolar, o carro chega um pouco mais perto que o fundo. A máscara vem do mapa de profundidade
(Depth Anything V2 Small, `depth_image.py`) com a borda bem suave, para a diferença de escala
nunca mostrar emenda. Pequena de propósito: a página estica a máscara (mask-size: cover).

Uso: python3 scripts/frames/wash_planes.py <freeze-depth.png 1916×1080> [<saida=dist/assets>]
Saída: wash/near-mask.png (480×271, a proporção da foto) e wash/near-mask-m.png (272×272, o
recorte quadrado do celular, u 0,2505…0,8142).
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', '..', 'dist', 'assets')
d = np.asarray(Image.open(src).convert('L'), np.float32) / 255.0
t = np.clip((d - 0.30) / (0.48 - 0.30), 0, 1)
m = Image.fromarray((t * t * (3 - 2 * t) * 255).round().astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
os.makedirs(os.path.join(out, 'wash'), exist_ok=True)
m.resize((480, 271), Image.LANCZOS).save(os.path.join(out, 'wash', 'near-mask.png'), optimize=True)
W, H = m.size
m.crop((round(0.2505 * W), 0, round(0.8142 * W), H)).resize((272, 272), Image.LANCZOS).save(os.path.join(out, 'wash', 'near-mask-m.png'), optimize=True)
print('wash/near-mask.png, wash/near-mask-m.png')

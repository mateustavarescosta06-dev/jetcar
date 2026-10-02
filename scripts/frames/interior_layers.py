"""Camadas do interior (seção 05): o plano de perto (carroceria, coluna B, soleira e a porta
aberta, com recorte suavizado) e o plano de longe (a cabine, com a área atrás do plano de perto
preenchida em tom escuro, para que a fresta que abre no avanço pareça a sombra da moldura da
porta e não uma carroceria repetida).

Uso: python3 interior_layers.py <interior.png|webp> <saida_dir>
O contorno foi desenhado à mão sobre a foto de 1536×1024 e é escalado para o tamanho da entrada.
Precisa de numpy, Pillow e OpenCV.
"""
import sys, os
import numpy as np
import cv2
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
im = np.array(Image.open(src).convert('RGB'))
H, W = im.shape[:2]
k = W / 1536.0
# borda interna da coluna B, borda de cima da soleira, borda da porta aberta (embaixo à direita)
poly = [(0, 0), (646, 0), (650, 120), (655, 300), (663, 480), (675, 640), (698, 730), (728, 790),
        (900, 832), (1100, 892), (1255, 942), (1292, 962), (1400, 872), (1536, 762), (1536, 1024), (0, 1024)]
pts = (np.array(poly, np.float32) * k).astype(np.int32)
mask = np.zeros((H, W), np.uint8)
cv2.fillPoly(mask, [pts], 255, lineType=cv2.LINE_AA)
alpha = cv2.GaussianBlur(mask, (0, 0), 1.6 * k)
near = np.dstack([im, alpha])
Image.fromarray(near, 'RGBA').save(os.path.join(out, 'near.png'))
# longe: a área do plano de perto (um pouco maior) vira preenchimento escuro e liso
big = cv2.dilate(mask, np.ones((int(9 * k) | 1, int(9 * k) | 1), np.uint8))
small = cv2.resize(im, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
bsmall = cv2.resize(big, (W // 4, H // 4), interpolation=cv2.INTER_NEAREST)
fill = cv2.inpaint(small, bsmall, 12, cv2.INPAINT_TELEA)
fill = cv2.resize(fill, (W, H), interpolation=cv2.INTER_CUBIC)
fill = cv2.GaussianBlur(fill, (0, 0), 6 * k)
fill = (fill.astype(np.float32) * 0.42).astype(np.uint8)   # sombra dentro da moldura
w = cv2.GaussianBlur(big, (0, 0), 4 * k).astype(np.float32)[..., None] / 255.0
far = (im.astype(np.float32) * (1 - w) + fill.astype(np.float32) * w).astype(np.uint8)
Image.fromarray(far).save(os.path.join(out, 'far.png'))
print('ok', W, H)

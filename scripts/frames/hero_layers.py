"""Camadas do hero a partir da foto do galpão (poster.webp, o mesmo quadro inicial do filme).

Saídas (em <saida>), sem perdas: os níveis publicados (WebP) saem de scripts/media/build_stills.py
  plate.png        a placa limpa: o carro e o reflexo dele no piso removidos (LaMa, Apache-2.0),
                   na resolução da foto ampliada
  car.png          o carro com alfa real (BiRefNet), recortado no retângulo dele, na mesma resolução
  normal.webp      normais do carro (Depth Anything V2 Small, Apache-2.0), no mesmo retângulo, 1×
                   (só se o modelo for passado; com "-" o passo é pulado)
  hero.json        retângulo do carro em UV da foto (para o shader posicionar a textura)

Uso: python3 hero_layers.py poster.png poster_alta.png alpha.png lama_fp32.onnx <depth_small.onnx|-> <saida>
(alpha.png sai de cutout.py; poster_alta.png de upscale.py 4× seguido de detail_blend.py)
"""
import sys, os, json
import numpy as np
import cv2
import onnxruntime as ort
from PIL import Image

src, src2x, alpha_p, lama_p, depth_p, out = sys.argv[1:7]
os.makedirs(out, exist_ok=True)
im = np.asarray(Image.open(src).convert('RGB'))
H, W = im.shape[:2]
im2 = np.asarray(Image.open(src2x).convert('RGB'))
H2, W2 = im2.shape[:2]
a = np.asarray(Image.open(alpha_p).convert('L')).astype(np.float32) / 255.0
a = np.clip((a - 0.08) / 0.84, 0, 1)                       # bordas mais firmes

# ——— retângulo do carro ———
ys, xs = np.where(a > 0.02)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
m = 12
x0, y0 = max(0, x0 - m), max(0, y0 - m)
x1, y1 = min(W - 1, x1 + m), min(H - 1, y1 + m)
box = dict(u0=x0 / W, u1=(x1 + 1) / W, v0=1 - (y1 + 1) / H, v1=1 - y0 / H)   # v de baixo para cima (GL)

# ——— carro (RGBA) ———
a2 = cv2.resize(a, (W2, H2), interpolation=cv2.INTER_CUBIC).clip(0, 1)
s = W2 / W
X0, X1, Y0, Y1 = int(x0 * s), int((x1 + 1) * s), int(y0 * s), int((y1 + 1) * s)
# o RGB fica sendo a própria foto também fora do recorte (sem franja escura ao filtrar a textura)
car2 = np.dstack([im2[Y0:Y1, X0:X1], (a2[Y0:Y1, X0:X1] * 255 + 0.5).astype(np.uint8)])
Image.fromarray(car2, 'RGBA').save(os.path.join(out, 'car.png'))

# ——— máscara da placa: o carro + o reflexo dele no piso (espelhado na linha de contato) ———
hard = (a > 0.08).astype(np.uint8)
contact = int(np.percentile(ys, 99.7))
refl = np.zeros_like(hard)
depth_px = int((contact - ys.min()) * 0.75)
for y in range(contact, min(H, contact + depth_px)):
    yy = 2 * contact - y
    if 0 <= yy < H:
        refl[y] = hard[yy]
hole = np.maximum(hard, refl)
hole = cv2.dilate(hole, np.ones((25, 25), np.uint8))

# ——— LaMa: a foto inteira em 512 de largura, completada até 512×512 ———
lama = ort.InferenceSession(lama_p, providers=['CPUExecutionProvider'])
sw, sh = 512, int(round(512 * H / W))
small = cv2.resize(im, (sw, sh), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
mh = cv2.resize(hole, (sw, sh), interpolation=cv2.INTER_NEAREST).astype(np.float32)
pad = 512 - sh
top = pad // 2
img512 = cv2.copyMakeBorder(small, top, pad - top, 0, 0, cv2.BORDER_REFLECT)
msk512 = cv2.copyMakeBorder(mh, top, pad - top, 0, 0, cv2.BORDER_CONSTANT, value=0)
res = lama.run(None, {'image': img512.transpose(2, 0, 1)[None].astype(np.float32), 'mask': msk512[None, None].astype(np.float32)})[0][0]
res = res.transpose(1, 2, 0)
if res.max() > 2:
    res = res / 255.0
res = np.clip(res[top:top + sh], 0, 1)
fill2 = cv2.resize(res, (W2, H2), interpolation=cv2.INTER_CUBIC)
fill2 = cv2.GaussianBlur(fill2, (0, 0), 2.0 * s)
w2 = cv2.resize(cv2.GaussianBlur(hole.astype(np.float32), (0, 0), 6), (W2, H2), interpolation=cv2.INTER_LINEAR)[..., None]
plate2 = im2.astype(np.float32) / 255.0 * (1 - w2) + fill2 * w2
Image.fromarray((plate2 * 255 + 0.5).clip(0, 255).astype(np.uint8)).save(os.path.join(out, 'plate.png'))
json.dump(dict(box=box, contact=1 - contact / H, size=[W, H], hi=[W2, H2]), open(os.path.join(out, 'hero.json'), 'w'), indent=1)
Image.fromarray((hole * 255).astype(np.uint8)).save(os.path.join(out, '_hole.png'))
if depth_p == '-':
    print('ok (sem normais)', box, 'contact', 1 - contact / H)
    sys.exit(0)

# ——— normais do carro (Depth Anything V2 Small) ———
dep = ort.InferenceSession(depth_p, providers=['CPUExecutionProvider'])
DH = 518
DW = int(round(W * DH / H / 14)) * 14
x = cv2.resize(im, (DW, DH), interpolation=cv2.INTER_CUBIC).astype(np.float32) / 255.0
x = (x - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
d = dep.run(None, {dep.get_inputs()[0].name: x.transpose(2, 0, 1)[None].astype(np.float32)})[0]
d = d.reshape(d.shape[-2], d.shape[-1]).astype(np.float32)
d = (d - d.min()) / (d.max() - d.min() + 1e-6)
am = cv2.resize(a, (DW, DH), interpolation=cv2.INTER_AREA)
# suavização só dentro do carro (o fundo não vaza para a borda)
k = 3.0
num = cv2.GaussianBlur(d * am, (0, 0), k)
den = cv2.GaussianBlur(am, (0, 0), k) + 1e-4
ds = num / den
gx = cv2.Sobel(ds, cv2.CV_32F, 1, 0, ksize=3) / 8.0
gy = cv2.Sobel(ds, cv2.CV_32F, 0, 1, ksize=3) / 8.0
strength = 22.0
n = np.dstack([-gx * strength, gy * strength, np.ones_like(ds)])   # x direita, y para cima, z para a câmera
# amplia em float e só então quantiza: a barra de luz reflete nítida no carro, e degraus de
# 8 bits ampliados (ou blocos de compressão com perdas) viram uma escada no reflexo
n = cv2.resize(n, (W, H), interpolation=cv2.INTER_CUBIC)
n /= np.linalg.norm(n, axis=2, keepdims=True)
nimg = np.clip(np.round((n * 0.5 + 0.5) * 255), 0, 255).astype(np.uint8)
flat = np.array([128, 128, 255], np.uint8)
nimg = np.where(a[..., None] > 0.02, nimg, flat)
crop = nimg[y0:y1 + 1, x0:x1 + 1]
Image.fromarray(crop).save(os.path.join(out, 'normal.webp'), lossless=True, quality=100, method=6)
print('ok', box, 'contact', 1 - contact / H)

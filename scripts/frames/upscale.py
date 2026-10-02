"""Amplia uma foto 2× com Real-ESRGAN General x4v3 (BSD-3, ONNX da Qualcomm AI Hub).
O modelo recebe blocos fixos de 128×128 e devolve 512×512 (4×); os blocos se sobrepõem e são
misturados com peso suave nas bordas; o resultado 4× é reduzido para 2× com Lanczos (mais
limpo que pedir 2× direto). Uso: python3 upscale.py <modelo.onnx> <entrada> <saida.png> [escala=2]
"""
import sys
import numpy as np
import onnxruntime as ort
from PIL import Image

model, src, dst = sys.argv[1:4]
scale = float(sys.argv[4]) if len(sys.argv) > 4 else 2.0
sess = ort.InferenceSession(model, providers=['CPUExecutionProvider'])
inp = sess.get_inputs()[0].name
img = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255.0
H, W = img.shape[:2]
T, O = 128, 16                   # bloco e sobreposição (entrada)
step = T - 2 * O
pad = np.pad(img, ((O, O + T), (O, O + T), (0, 0)), mode='reflect')
out = np.zeros(((H + 2 * O + T) * 4, (W + 2 * O + T) * 4, 3), np.float32)
wsum = np.zeros(out.shape[:2] + (1,), np.float32)
r = np.linspace(-1, 1, T * 4)
win = np.outer(1 - np.abs(r) ** 6, 1 - np.abs(r) ** 6)[..., None] + 1e-4
ys = list(range(0, H + O, step))
xs = list(range(0, W + O, step))
for i, y in enumerate(ys):
    for x in xs:
        tile = pad[y:y + T, x:x + T].transpose(2, 0, 1)[None]
        up = sess.run(None, {inp: tile})[0][0].transpose(1, 2, 0)
        out[y * 4:(y + T) * 4, x * 4:(x + T) * 4] += up * win
        wsum[y * 4:(y + T) * 4, x * 4:(x + T) * 4] += win
    print(f'{i + 1}/{len(ys)}', end='\r', file=sys.stderr)
out = (out / np.maximum(wsum, 1e-6))[O * 4:(O + H) * 4, O * 4:(O + W) * 4]
res = Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8))
if scale != 4:
    res = res.resize((round(W * scale), round(H * scale)), Image.LANCZOS)
res.save(dst)
print('ok', res.size)

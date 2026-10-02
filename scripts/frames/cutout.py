"""Recorte com alfa (BiRefNet lite, MIT, ONNX em onnx-community/BiRefNet_lite-ONNX).
Entrada 1024×1024 normalizada (ImageNet); a saída (logits) vira o alfa na resolução original.
Uso: python3 cutout.py <modelo.onnx> <imagem> <saida_alfa.png> [saida_rgba.png]
"""
import sys
import numpy as np
import onnxruntime as ort
from PIL import Image

model, src, out_a = sys.argv[1:4]
out_rgba = sys.argv[4] if len(sys.argv) > 4 else None
sess = ort.InferenceSession(model, providers=['CPUExecutionProvider'])
im = Image.open(src).convert('RGB')
W, H = im.size
x = np.asarray(im.resize((1024, 1024), Image.BICUBIC)).astype(np.float32) / 255.0
x = (x - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
y = sess.run(None, {sess.get_inputs()[0].name: x.transpose(2, 0, 1)[None]})[-1][0, 0]
a = 1 / (1 + np.exp(-y))
alpha = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
alpha.save(out_a)
if out_rgba:
    rgba = im.copy()
    rgba.putalpha(alpha)
    rgba.save(out_rgba)
print('ok', W, H)

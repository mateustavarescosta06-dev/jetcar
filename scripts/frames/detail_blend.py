"""Junta a ampliação do Real-ESRGAN com a textura verdadeira do original.

O Real-ESRGAN General x4v3 deixa bordas, frisos e reflexos nítidos, mas trata textura fina como
ruído: o grão e a perfuração do couro viram ondas, a costura pontilhada vira uma linha contínua,
o concreto do piso vira "água" e a tela da grade some. Este passo mantém o ESRGAN onde a imagem
tem bordas com direção (contornos, cromados, reflexos) e, onde o original tem textura fina sem
direção, usa os tons do ESRGAN com o detalhe do próprio original (ampliado com Lanczos). Nada é
inventado: a textura que aparece é a que já estava no master.

Máscara de textura (na escala do original): energia de alta frequência alta, normalizada pelo
brilho local, e coerência baixa do tensor de estrutura (sem direção dominante).

Uso: python3 detail_blend.py <original> <ampliada_esrgan> <saida.png> [base=1.6] [coerencia=0.85]
A saída tem o tamanho da ampliada. Precisa de numpy, Pillow e OpenCV.
"""
import sys
import numpy as np
import cv2
from PIL import Image

orig_p, esr_p, out_p = sys.argv[1:4]
SB = float(sys.argv[4]) if len(sys.argv) > 4 else 1.6
CO = float(sys.argv[5]) if len(sys.argv) > 5 else 0.85

orig = np.asarray(Image.open(orig_p).convert('RGB')).astype(np.float32) / 255.0
esr = np.asarray(Image.open(esr_p).convert('RGB')).astype(np.float32) / 255.0
H, W = esr.shape[:2]
k = W / orig.shape[1]


def texture_mask(img):
    L = img.mean(2)
    hf = L - cv2.GaussianBlur(L, (0, 0), 0.9)
    E = cv2.GaussianBlur(hf * hf, (0, 0), 2.5)
    gx = cv2.Sobel(L, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(L, cv2.CV_32F, 0, 1, ksize=3)
    jxx = cv2.GaussianBlur(gx * gx, (0, 0), 1.5)
    jyy = cv2.GaussianBlur(gy * gy, (0, 0), 1.5)
    jxy = cv2.GaussianBlur(gx * gy, (0, 0), 1.5)
    coh = np.sqrt((jxx - jyy) ** 2 + 4 * jxy ** 2) / (jxx + jyy + 1e-6)
    mu = cv2.GaussianBlur(L, (0, 0), 2.5)
    en = np.sqrt(E / (mu * mu + 0.002))
    t = np.clip((en - 0.02) / 0.06, 0, 1) * np.clip((CO - coh) / 0.4, 0, 1)
    return cv2.GaussianBlur(t, (0, 0), 1.0)


t = cv2.resize(texture_mask(orig), (W, H), interpolation=cv2.INTER_LINEAR)
up = cv2.resize(orig, (W, H), interpolation=cv2.INTER_LANCZOS4)
del orig
s = SB * k / 2
base = cv2.GaussianBlur(esr, (0, 0), s)
detail = up - cv2.GaussianBlur(up, (0, 0), s)
# segundo critério: detalhe visível no original (riscos de água, concreto, tela) que o ESRGAN
# apagou (sobrou menos da metade da energia na mesma faixa de frequência), com direção ou não
ld = detail.mean(2)
le = (esr - base).mean(2)
eu = cv2.GaussianBlur(ld * ld, (0, 0), 2 * k)
ee = cv2.GaussianBlur(le * le, (0, 0), 2 * k)
mu = cv2.GaussianBlur(up.mean(2), (0, 0), 2 * k)
del up, ld, le
vis = np.clip((np.sqrt(eu) / (mu + 0.05) - 0.012) / 0.03, 0, 1)
gone = np.clip((0.6 - ee / (eu + 1e-7)) / 0.4, 0, 1)
t = cv2.GaussianBlur(np.maximum(t, vis * gone), (0, 0), k / 2)[..., None]
del eu, ee, mu, vis, gone
tex = np.clip(base + detail * 1.15, 0, 1)
del base, detail
out = esr * (1 - t) + tex * t
Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out_p)
print('ok', W, H, f'textura em {float(t.mean()) * 100:.1f}% da imagem')

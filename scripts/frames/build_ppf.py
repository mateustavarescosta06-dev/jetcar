"""PPF (v6.2): a frente do carro sem e com a película aplicada, no mesmo enquadramento, para a página
cortar uma sobre a outra pela borda da película. Dois recortes do intermediário 3832×2160:
  d  farol e capô (u 0,31…0,71, v 0,20…0,92; 1533×1555), o painel da esquerda no desktop: no
     retina de 1440 px ele fica perto de 1:1, sem ampliar a fonte além disso;
  m  a frente inteira em pé (u 0,246…0,754, altura toda; 1946×2160), a tela toda no celular.

A película é transparente: nada de cor. Sobre a carroceria (a máscara do recorte) ela muda pouco e
de um jeito físico, como o shader da v6.1 fazia ao vivo:
  - um pouco mais de contraste e de brilho nos reflexos (o filme é mais liso que o verniz);
  - um reflexo largo e suave na diagonal, que a superfície nova pega;
  - uma textura finíssima de "casca de laranja" só nos reflexos (amplitude de ~2%).
Tudo em luz linear; saída sRGB, cwebp q92 -sharp_yuv (como as outras fotos).

Uso: python3 scripts/frames/build_ppf.py <ppf.png 3832×2160> <ppf_alpha.png 1916×1080> [<saida=dist/assets>]
Saída: ppf/off-d.webp, ppf/film-d.webp, ppf/off-m.webp, ppf/film-m.webp.
Precisa de Pillow, numpy e do cwebp (variável CWEBP ou no PATH).
"""
import os, sys, subprocess, tempfile
import numpy as np
from PIL import Image, ImageFilter

src, alpha = sys.argv[1], sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(__file__), '..', '..', 'dist', 'assets')
CWEBP = os.environ.get('CWEBP', 'cwebp')
CROPS = {'d': (0.31, 0.20, 0.71, 0.92), 'm': (0.246, 0.0, 0.754, 1.0)}


def crop(im, box):
    W, H = im.size
    return im.crop((round(box[0] * W), round(box[1] * H), round(box[2] * W), round(box[3] * H)))


def to_lin(a):
    a = a / 255.0
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def to_srgb(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055) * 255.0


def webp(im, rel):
    path = os.path.join(out, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as t:
        im.save(t.name)
    subprocess.run([CWEBP, '-quiet', '-m', '6', '-mt', '-q', '92', '-sharp_yuv', t.name, '-o', path], check=True)
    os.unlink(t.name)
    print(f'{rel:20s} {im.size[0]}×{im.size[1]} {os.path.getsize(path) / 1024:.0f} KB')


full = Image.open(src).convert('RGB')
full_mask = Image.open(alpha).convert('L')
for name, box in CROPS.items():
    img = crop(full, box)
    w, h = img.size
    mask = crop(full_mask, box).resize((w, h), Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.5))
    m = (np.asarray(mask, np.float32) / 255.0)[..., None]
    c = to_lin(np.asarray(img, np.float32))
    luma = (0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2])[..., None]
    # mais liso que o verniz: contraste e reflexos um pouco mais fortes (quase nada no vidro escuro)
    prot = c * 1.05 + np.maximum(c - 0.02, 0) * 0.12
    # casca de laranja: ruído suave (~5 px do intermediário), só onde há reflexo
    rng = np.random.default_rng(7)
    small = rng.standard_normal((h // 5 + 2, w // 5 + 2)).astype(np.float32)
    noise = np.array(Image.fromarray(small).resize((w + 10, h + 10), Image.BICUBIC), np.float32)[:h, :w]
    noise /= max(1e-6, noise.std())
    prot *= 1 + 0.02 * noise[..., None] * np.clip((luma - 0.04) / 0.3, 0, 1)
    # o reflexo largo na diagonal, branco frio bem leve, só da metade de baixo do recorte (no alto
    # fica o para-brisa: lá ele viraria névoa) e só sobre a pintura clara o bastante
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = (xx / w) * 0.8 + (yy / h) * 0.6 - 0.78
    low = np.clip((yy / h - 0.42) / 0.2, 0, 1)
    sheen = np.exp(-(d / 0.16) ** 2) * 0.02 * low
    prot += sheen[..., None] * np.clip(luma / 0.05, 0, 1) * np.array([0.92, 0.94, 0.97], np.float32)
    res = c * (1 - m) + prot * m
    webp(img, f'ppf/off-{name}.webp')
    webp(Image.fromarray(to_srgb(res).round().astype(np.uint8)), f'ppf/film-{name}.webp')

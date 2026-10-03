"""Fotos do Polimento (v6.2): a macro da pintura em três estados alinhados, publicados em níveis.

As imagens saem da própria cena 3D do polimento da v6.1 renderizada parada em alta resolução
(scripts/render/README.md): a mesma câmera, a mesma luz ambiente, só muda o que está aceso.
  clean  pintura corrigida, sem a barra (d_clean / m_clean)
  swirl  os micro-riscos acesos: o máximo, pixel a pixel, de oito posições da luz de inspeção
         (d_s_<x> / m_s_<x>); a página mostra essa imagem em opacidade parcial atrás da linha e
         inteira só numa faixa rente a ela
  refl   pintura corrigida com o reflexo da barra de luz (d_refl / m_refl)
Desktop 16:9 em 3200, 2560 e 1920; celular em pé 1170×2532. cwebp q92 -sharp_yuv (como as fotos).

Uso: python3 scripts/frames/build_polish.py <pasta_dos_renders> [<saida=dist/assets>] [so=clean,swirl,refl]
Precisa de Pillow, numpy e do cwebp (variável CWEBP ou no PATH).
"""
import os, sys, glob, subprocess, tempfile
import numpy as np
from PIL import Image

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', '..', 'dist', 'assets')
only = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else None
CWEBP = os.environ.get('CWEBP', 'cwebp')
TIERS = [3200, 2560, 1920]


def webp(im, rel, q=92):
    path = os.path.join(out, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as t:
        im.save(t.name)
    subprocess.run([CWEBP, '-quiet', '-m', '6', '-mt', '-q', str(q), '-sharp_yuv', t.name, '-o', path], check=True)
    os.unlink(t.name)
    print(f'{rel:30s} {im.size[0]:5d}×{im.size[1]:<5d} {os.path.getsize(path) / 1024:8.0f} KB')


def publish(im, name, mobile):
    if mobile:
        webp(im, f'polish/{name}-m.webp')
        return
    for w in TIERS:
        h = round(w * im.height / im.width)
        webp(im if im.width == w else im.resize((w, h), Image.LANCZOS), f'polish/{name}-{w}.webp')


def swirl_max(prefix):
    files = sorted(glob.glob(os.path.join(src, f'{prefix}_s_*.png')))
    if not files:
        raise SystemExit(f'sem {prefix}_s_*.png em {src}')
    acc = None
    for f in files:
        a = np.asarray(Image.open(f).convert('RGB'))
        acc = a.copy() if acc is None else np.maximum(acc, a)
    return Image.fromarray(acc)


for prefix, mobile in (('d', False), ('m', True)):
    if only is None or 'clean' in only:
        publish(Image.open(os.path.join(src, f'{prefix}_clean.png')).convert('RGB'), 'clean', mobile)
    if only is None or 'swirl' in only:
        publish(swirl_max(prefix), 'swirl', mobile)
    if (only is None or 'refl' in only) and os.path.exists(os.path.join(src, f'{prefix}_refl.png')):
        publish(Image.open(os.path.join(src, f'{prefix}_refl.png')).convert('RGB'), 'refl', mobile)

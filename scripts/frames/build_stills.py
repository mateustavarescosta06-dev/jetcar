"""Níveis publicados das fotos (v6.1): desktop alto, desktop padrão e celular com enquadramento
próprio, a partir dos intermediários sem perdas (PNG).

Os intermediários saem dos masters em source/ (ver README.md): ampliação 4× (fotos) ou 2× (quadros
do vídeo) com upscale.py, textura devolvida com detail_blend.py e, no hero e no interior, as
camadas de hero_layers.py / interior_layers.py. Nenhum nível é ampliado a partir de outro nível:
todos são reduções (Lanczos) do intermediário, ou recortes dele.

Codificação: cwebp 1.4+ com -m 6 -sharp_yuv (a crominância não borra frisos e reflexos).
Qualidade escolhida no teste q88/92/95 (audit/IMAGE_QUALITY_AUDIT.md): q92 nas fotos; q95 no carro
do hero e no congelamento da lavagem (o assunto em foco de cada cena); máscaras sem perdas.

Uso: python3 scripts/frames/build_stills.py <pasta_dos_intermediarios> [<saida=dist/assets>] [so=hero,wash,...]
A pasta precisa ter: hero/car.png, hero/plate.png (4×), freeze.png, ppf.png, result.png (2×, já com
detail_blend), ppf_alpha.png (1×) e interior/far.png, interior/near.png (4×).
Precisa de Pillow e do cwebp (variável CWEBP ou no PATH).
"""
import os, sys, subprocess, tempfile
from PIL import Image

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', '..', 'dist', 'assets')
only = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else None
CWEBP = os.environ.get('CWEBP', 'cwebp')
report = []


def lanczos(im, size):
    """Redução Lanczos; no RGBA o RGB e o alfa são reduzidos separados (o RGB é a própria foto
    também fora do recorte, então não escurece a borda como a redução pré-multiplicada)."""
    size = (int(round(size[0])), int(round(size[1])))
    if im.size == size:
        return im
    if im.mode == 'RGBA':
        rgb = im.convert('RGB').resize(size, Image.LANCZOS)
        a = im.getchannel('A').resize(size, Image.LANCZOS)
        rgb.putalpha(a)
        return rgb
    return im.resize(size, Image.LANCZOS)


def webp(im, rel, q=92, lossless=False):
    path = os.path.join(out, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as t:
        im.save(t.name)
    args = [CWEBP, '-quiet', '-m', '6', '-mt']
    if lossless:
        args += ['-lossless', '-exact', '-z', '9']
    else:
        args += ['-q', str(q), '-sharp_yuv']
        if im.mode == 'RGBA':
            args += ['-alpha_q', '100', '-exact']
    subprocess.run(args + [t.name, '-o', path], check=True)
    os.unlink(t.name)
    kb = os.path.getsize(path) / 1024
    report.append(f'{rel:32s} {im.size[0]:5d}×{im.size[1]:<5d} {"sem perdas" if lossless else f"q{q}":>10s} {kb:8.0f} KB')


def crop_frac(im, x0, y0, x1, y1):
    W, H = im.size
    return im.crop((round(x0 * W), round(y0 * H), round(x1 * W), round(y1 * H)))


def want(name):
    return only is None or name in only


# ——— HERO (texturas do WebGL) ———
if want('hero'):
    car = Image.open(os.path.join(src, 'hero', 'car.png')).convert('RGBA')        # 4×
    plate = Image.open(os.path.join(src, 'hero', 'plate.png')).convert('RGB')     # 4×
    webp(lanczos(car, (car.width * 0.75, car.height * 0.75)), 'hero/car-3x.webp', 95)
    webp(lanczos(car, (car.width * 0.5, car.height * 0.5)), 'hero/car.webp', 95)
    p2 = lanczos(plate, (plate.width / 2, plate.height / 2))
    webp(p2, 'hero/plate.webp', 92)
    # celular (retrato): a câmera vê só o miolo da foto (u 0,17…0,87 entre o começo e o fim do
    # avanço); o recorte guarda esse miolo em 2× (antes o celular usava a foto inteira em 1×)
    webp(crop_frac(p2, 0.14, 0, 0.90, 1), 'hero/plate-m.webp', 92)

# ——— LAVAGEM: o quadro congelado (o último quadro do trecho) ———
if want('wash'):
    fr = Image.open(os.path.join(src, 'freeze.png')).convert('RGB')               # 3832×2160
    webp(lanczos(fr, (2560, 1443)), 'wash/freeze-2560.webp', 95)
    webp(lanczos(fr, (1920, 1082)), 'wash/freeze-1920.webp', 95)
    # celular: o mesmo recorte quadrado do scrub do celular (x 480…1560 no master de 1916)
    webp(lanczos(fr.crop((960, 0, 3120, 2160)), (1440, 1440)), 'wash/freeze-m.webp', 95)
    # "Ver de perto" (v6.2): as gotas no capô no tamanho do intermediário (u 0,55…0,95, v 0,30…0,75)
    webp(crop_frac(fr, 0.55, 0.30, 0.95, 0.75), 'wash/detail.webp', 95)

# ——— PPF: a frente do carro e a máscara da carroceria ———
if want('ppf'):
    fr = Image.open(os.path.join(src, 'ppf.png')).convert('RGB')                  # 3832×2160
    for w in (3200, 2560, 1920):
        webp(lanczos(fr, (w, w * fr.height / fr.width)), f'protect/front-{w}.webp', 92)
    m = Image.open(os.path.join(src, 'ppf_alpha.png')).convert('L').convert('RGB')  # 1916×1080
    webp(m, 'protect/front-mask.webp', lossless=True)
    # celular: altura inteira (a tela em pé mostra a foto pela altura), centrado no farol e no
    # capô, largura para telas de 0,46 a 0,9 de proporção
    webp(crop_frac(fr, 0.246, 0, 0.754, 1), 'protect/front-m.webp', 92)
    webp(crop_frac(m, 0.246, 0, 0.754, 1), 'protect/front-mask-m.webp', lossless=True)

# ——— RESULTADO (HTML, <picture> com srcset) ———
if want('result'):
    fr = Image.open(os.path.join(src, 'result.png')).convert('RGB')
    for w in (3200, 2560, 1920):
        webp(lanczos(fr, (w, w * fr.height / fr.width)), f'result-{w}.webp', 92)
    webp(fr.crop((1016, 0, 2816, 2160)), 'result-m.webp', 92)

# ——— INTERIOR (HTML): cabine (longe) e moldura da porta (perto) ———
if want('interior'):
    far = Image.open(os.path.join(src, 'interior', 'far.png')).convert('RGB')     # 6144×4096
    near = Image.open(os.path.join(src, 'interior', 'near.png')).convert('RGBA')
    # a parada final mostra 54% da largura da foto na tela inteira (1,85× a largura da tela):
    # 4608 cobre 2560×1440 em 1:1 e um retina de 1440 a 1,16×; 3584 cobre 1920×1080 em 1:1
    webp(lanczos(far, (4608, 3072)), 'interior/far-4608.webp', 92)
    webp(lanczos(far, (3584, 2389)), 'interior/far-3584.webp', 92)
    # a moldura da porta passa rápido e some antes da parada: um nível só
    webp(lanczos(near, (3584, 2389)), 'interior/near-3584.webp', 92)
    # celular: a tela em pé mostra a foto pela altura; recorte u 0,34…1 (o que a câmera percorre
    # do começo à parada) com 2560 px de altura (1:1 num iPhone de 844 pt a 3×)
    box = (round(0.34 * far.width), 0, far.width, far.height)
    size = ((box[2] - box[0]) * 2560 / far.height, 2560)
    webp(lanczos(far.crop(box), size), 'interior/far-m.webp', 92)
    webp(lanczos(near.crop(box), size), 'interior/near-m.webp', 92)

print('\n'.join(report))

"""Mapa da orla do silêncio (a ficha da praia ao lado de "Proteção que você não vê").

Gera, a partir de scripts/data/map.json (OpenStreetMap, ODbL):
  dist/assets/coast-map.svg  a imagem: mar, ruas bem apagadas e a linha da costa;
  dist/index.html            entre <!-- coast:start --> e <!-- coast:end -->, o desenho por cima
                             (inline, para usar a Barlow e o CSS da página): o vento que vem do mar,
                             a loja, os nomes, o norte e a escala.
As duas camadas usam o mesmo recorte (viewBox) e cobrem a caixa do mesmo jeito (object-fit: cover
na imagem, preserveAspectRatio slice no desenho), então o quadrado do desktop e a faixa do celular
mostram o mesmo lugar. Coordenadas em metros a partir do ponto do link do Apple Maps (a loja),
x para leste e y para o sul.

O vento: em Recife ele costuma vir do mar (alísios de leste e sudeste); as linhas saem do mar a
lés-sudeste e terminam perto da loja. Nada aqui é dado da empresa.

Uso: python3 scripts/data/build_coast_svg.py
"""
import json, math, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
m = json.load(open(os.path.join(ROOT, 'scripts/data/map.json')))

# recorte: a loja um pouco à esquerda do centro, o mar no alto à direita. No celular (16:10) a caixa
# mostra só a faixa do meio (y −750…+750): tudo o que tem nome fica dentro dela.
X0, Y0, W, H = -950, -1300, 2400, 2400
VB = f'{X0} {Y0} {W} {H}'


def inside(xs, ys, pad=80):
    return max(xs) >= X0 - pad and min(xs) <= X0 + W + pad and max(ys) >= Y0 - pad and min(ys) <= Y0 + H + pad


def path(flat, close=False):
    pts = [(flat[i], flat[i + 1]) for i in range(0, len(flat), 2)]
    return 'M' + ' L'.join(f'{x:.0f} {y:.0f}' for x, y in pts) + (' Z' if close else '')


# ——— a imagem: mar, ruas e costa ———
img = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB}" width="{W}" height="{H}">']
img.append(f'<path d="{path(m["sea"], True)}" fill="#0e1014"/>')
for kind, color, w in (('minor', '#1c1d20', 7), ('major', '#2a2b2f', 12)):
    ds = [path(l) for l in m['streets'][kind] if inside(l[0::2], l[1::2])]
    img.append(f'<path fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" d="{" ".join(ds)}"/>')
img.append(f'<path d="{path(m["coast"])}" fill="none" stroke="#3a3833" stroke-width="34" stroke-linejoin="round"/>')
img.append(f'<path d="{path(m["coast"])}" fill="none" stroke="#a7a49d" stroke-width="7" stroke-linejoin="round"/>')
img.append('</svg>')
open(os.path.join(ROOT, 'dist/assets/coast-map.svg'), 'w').write('\n'.join(img))


# ——— o desenho por cima ———
cx, cy = m['coast'][0::2], m['coast'][1::2]


def coast_x(y):
    for i in range(len(cy) - 1):
        if (cy[i] - y) * (cy[i + 1] - y) <= 0 and cy[i] != cy[i + 1]:
            return cx[i] + (y - cy[i]) / (cy[i + 1] - cy[i]) * (cx[i + 1] - cx[i])
    raise ValueError(y)


# inclinação da costa (de sul para norte, como se lê o nome)
a, b = (cx[-1], cy[-1]), (cx[0], cy[0])
coast_deg = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))

# vento de lés-sudeste: sopra para oés-noroeste
d = (-math.cos(math.radians(22.5)), -math.sin(math.radians(22.5)))
n = (math.sin(math.radians(22.5)), -math.cos(math.radians(22.5)))   # normal ao vento, para o norte
LEN, GAP = 1100, 260
S = (1100, 330)
out = []
f = lambda v: f'{v:.0f}'
for k in (-1, 0, 1):
    s = (S[0] + k * GAP * n[0], S[1] + k * GAP * n[1])
    e = (s[0] + LEN * d[0], s[1] + LEN * d[1])
    out.append(f'<path class="q-wind" d="M{f(s[0])} {f(s[1])} L{f(e[0])} {f(e[1])}"/>')
    back = (-d[0], -d[1])
    arms = []
    for ang in (32, -32):
        c, si = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        r = (back[0] * c - back[1] * si, back[0] * si + back[1] * c)
        arms.append((e[0] + 60 * r[0], e[1] + 60 * r[1]))
    out.append(f'<path class="q-head" d="M{f(arms[0][0])} {f(arms[0][1])} L{f(e[0])} {f(e[1])} L{f(arms[1][0])} {f(arms[1][1])}"/>')
# o nome do vento junto da linha de cima, no mar
top = (S[0] + GAP * n[0], S[1] + GAP * n[1])
lab = (top[0] + 250 * d[0] + 70 * n[0], top[1] + 250 * d[1] + 70 * n[1])
wind_deg = math.degrees(math.atan2(-d[1], -d[0]))
out.append(f'<text class="q-wind-name" x="{f(lab[0])}" y="{f(lab[1])}" font-size="62" text-anchor="middle" transform="rotate({wind_deg:.1f} {f(lab[0])} {f(lab[1])})">vento do mar</text>')

# a praia: o nome corre ao longo da areia, do lado do mar
by = -450
bx = coast_x(by) + 70
out.append(f'<text class="q-beach" x="{f(bx)}" y="{f(by)}" font-size="68" text-anchor="middle" transform="rotate({coast_deg:.1f} {f(bx)} {f(by)})">Praia de Boa Viagem</text>')
# o mar
oy = -520
ox = coast_x(oy) + 470
out.append(f'<text class="q-sea" x="{f(ox)}" y="{f(oy)}" font-size="68" text-anchor="middle" transform="rotate({coast_deg:.1f} {f(ox)} {f(oy)})">Oceano Atlântico</text>')
# a loja
out.append('<circle class="q-ring" cx="0" cy="0" r="120"/>')
out.append('<rect class="q-dot" x="-26" y="-26" width="52" height="52"/>')
out.append('<text class="q-store" x="-165" y="30" font-size="84" text-anchor="end">JETCAR</text>')
out.append('<text class="q-street" x="-165" y="118" font-size="56" text-anchor="end">R. José Trajano</text>')
# norte e escala (no canto esquerdo, dentro da faixa do celular)
out.append('<path class="q-rule" d="M-860 -560 L-860 -720 M-905 -660 L-860 -720 L-815 -660"/>')
out.append('<text class="q-n" x="-860" y="-760" font-size="64" text-anchor="middle">N</text>')
out.append('<path class="q-rule" d="M-880 560 L-380 560 M-880 525 L-880 595 M-380 525 L-380 595"/>')
out.append('<text class="q-scale" x="-630" y="510" font-size="56" text-anchor="middle">500 m</text>')

svg = (f'<svg class="quiet-map-art" viewBox="{VB}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
       + ''.join(out) + '</svg>')
p = os.path.join(ROOT, 'dist/index.html')
html = open(p).read()
new, k = re.subn(r'(<!-- coast:start[^>]*-->)(.*?)(<!-- coast:end -->)', lambda mm: mm.group(1) + '\n          ' + svg + '\n          ' + mm.group(3), html, flags=re.S)
if not k:
    raise SystemExit('marcadores coast:start/coast:end não encontrados no index.html')
open(p, 'w').write(new)
print('ok', os.path.getsize(os.path.join(ROOT, 'dist/assets/coast-map.svg')) // 1024, 'KB de imagem;', len(svg) // 1024, 'KB inline; costa a', f'{coast_deg:.1f}°')

"""Gera dist/assets/route.svg a partir de scripts/data/map.json (OpenStreetMap, ODbL).

O SVG é o mapa da seção Endereço: mar, quadras, ruas, a Avenida Boa Viagem e a rota (a linha de
luz) até a Rua José Trajano. A página carrega o SVG inline e desenha a rota conforme a rolagem;
sem JavaScript ele aparece inteiro como imagem. Coordenadas do map.json: metros a partir do
ponto do link do Apple Maps (x para leste, y para o sul).

Uso: python3 scripts/data/build_route_svg.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
m = json.load(open(os.path.join(ROOT, 'scripts/data/map.json')))

# janela: a rota inteira com folga, mais mar à direita
X0, Y0, W, H = -760, -560, 1600, 1000

def inside(xs, ys, pad=60):
    return max(xs) >= X0 - pad and min(xs) <= X0 + W + pad and max(ys) >= Y0 - pad and min(ys) <= Y0 + H + pad

def path(flat, close=False):
    pts = [(flat[i], flat[i + 1]) for i in range(0, len(flat), 2)]
    d = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)
    return d + (' Z' if close else '')

out = []
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{X0} {Y0} {W} {H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Mapa: rota pela Avenida Boa Viagem até a Rua José Trajano">')
out.append('<rect x="%d" y="%d" width="%d" height="%d" fill="#0a0b0c"/>' % (X0 - 400, Y0 - 400, W + 800, H + 800))
sea = m['sea']
out.append(f'<path d="{path(sea, True)}" fill="#0d0f12"/>')
# quadras
blds = []
for b in m['buildings']:
    xs, ys = b[0::2], b[1::2]
    if inside(xs, ys, 0):
        blds.append(path(b, True))
out.append('<path fill="#141518" d="' + ' '.join(blds) + '"/>')
# ruas
for kind, color, w in (('service', '#1c1d20', 1.2), ('minor', '#26282c', 2.2), ('major', '#3a3c41', 4.0)):
    ds = []
    for line in m['streets'][kind]:
        xs, ys = line[0::2], line[1::2]
        if inside(xs, ys):
            ds.append(path(line))
    out.append(f'<path fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" d="{" ".join(ds)}"/>')
# costa (a faixa de areia vira uma linha clara e fina)
out.append(f'<path d="{path(m["coast"])}" fill="none" stroke="#5c5a55" stroke-width="2.4"/>')
# rota: base apagada + a linha de luz (a página anima esta)
route = m['route'] + [m['routeEnd'][0], m['routeEnd'][1]]
rd = path(route)
out.append(f'<path class="route-base" d="{rd}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>')
out.append(f'<path class="route-halo" d="{rd}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>')
out.append(f'<path class="route-line" d="{rd}" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>')
sx, sy = m['start']
ex, ey = m['routeEnd']
out.append(f'<g class="route-start"><rect x="{sx-5}" y="{sy-5}" width="10" height="10" fill="none" stroke="#fff" stroke-width="2"/></g>')
out.append(f'<g class="route-dest" transform="translate({ex} {ey})"><circle r="26" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/><rect x="-7" y="-7" width="14" height="14" fill="#d7261e"/></g>')
# nomes (texto real no SVG)
style = 'font-family="Barlow, Helvetica, Arial, sans-serif" font-weight="600" letter-spacing="2.4" fill="#8d8a84"'
out.append(f'<text class="route-name" x="{sx + 26}" y="{sy - 140}" font-size="17" {style} transform="rotate(-62 {sx + 26} {sy - 140})">AV. BOA VIAGEM</text>')
out.append(f'<text class="route-name" x="{ex - 30}" y="{ey + 64}" font-size="17" {style} text-anchor="end">R. JOSÉ TRAJANO</text>')
out.append(f'<text class="route-name" x="{X0 + W - 150}" y="{Y0 + 120}" font-size="15" {style}>OCEANO ATLÂNTICO</text>')
out.append('</svg>')
open(os.path.join(ROOT, 'dist/assets/route.svg'), 'w').write('\n'.join(out))
print('ok', sum(len(s) for s in out) // 1024, 'KB')

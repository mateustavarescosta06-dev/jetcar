# Dados do mapa (OpenStreetMap, ODbL): ruas, prédios, linha da costa e uma rota da orla
# (Avenida Boa Viagem) até a Rua José Trajano. Coordenadas locais em metros (x leste, y sul),
# origem no ponto do link do Apple Maps (-8.12055, -34.89937).
import json, math, heapq
lat0, lon0 = -8.12055, -34.89937
kx = 111320 * math.cos(math.radians(lat0)); ky = 110574
def xy(lat, lon): return ((lon - lon0) * kx, -(lat - lat0) * ky)
osm = json.load(open('osm.json'))['elements']
bld = json.load(open('bld.json'))['elements']
R_STREET, R_BLD = 2200, 1500
def inside(x, y, r): return abs(x) < r and abs(y) < r
def q(v): return round(v * 2) / 2  # 0,5 m

def simplify(pts, tol):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy) or 1e-9
    best, idx = -1, 0
    for i in range(1, len(pts)-1):
        p = pts[i]
        d = abs(dy*(p[0]-a[0]) - dx*(p[1]-a[1])) / L
        if d > best: best, idx = d, i
    if best > tol: return simplify(pts[:idx+1], tol)[:-1] + simplify(pts[idx:], tol)
    return [a, b]

CLASS = {'trunk': 'major', 'trunk_link': 'major', 'primary': 'major', 'primary_link': 'major', 'secondary': 'major', 'secondary_link': 'major',
         'tertiary': 'minor', 'tertiary_link': 'minor', 'residential': 'minor', 'unclassified': 'minor', 'living_street': 'minor',
         'service': 'service', 'pedestrian': 'service'}
streets = {'major': [], 'minor': [], 'service': []}
graph = {}
names = {}
def add_edge(a, b, w):
    graph.setdefault(a, []).append((b, w))
for w in osm:
    t = w.get('tags', {}); hw = t.get('highway')
    if hw not in CLASS: continue
    g = w.get('geometry') or []
    pts = [xy(p['lat'], p['lon']) for p in g]
    keep = [p for p in pts if inside(p[0], p[1], R_STREET)]
    if len(keep) >= 2:
        s = simplify(pts, 0.8)
        streets[CLASS[hw]].append([q(c) for p in s for c in p])
    if hw in ('pedestrian',): continue
    ow = t.get('oneway')
    ids = [(round(p['lat'], 7), round(p['lon'], 7)) for p in g]
    for i in range(len(ids) - 1):
        a, b = ids[i], ids[i+1]
        pa, pb = pts[i], pts[i+1]
        d = math.hypot(pb[0]-pa[0], pb[1]-pa[1])
        if ow == '-1': add_edge(b, a, d)
        elif ow == 'yes': add_edge(a, b, d)
        else: add_edge(a, b, d); add_edge(b, a, d)
        names[a] = names.get(a) or t.get('name'); names[b] = names.get(b) or t.get('name')

def nearest(name, x0, y0):
    best = None
    for n, nm in names.items():
        if nm != name: continue
        x, y = xy(*n)
        d = math.hypot(x-x0, y-y0)
        if best is None or d < best[0]: best = (d, n)
    return best[1]
start = nearest('Avenida Boa Viagem', 466, -23)
end = nearest('Rua José Trajano', 0, 0)
dist = {start: 0}; prev = {}; pq = [(0, start)]
while pq:
    d, n = heapq.heappop(pq)
    if n == end: break
    if d > dist.get(n, 1e18): continue
    for m, w in graph.get(n, []):
        nd = d + w
        if nd < dist.get(m, 1e18): dist[m] = nd; prev[m] = n; heapq.heappush(pq, (nd, m))
path = [end]
while path[-1] != start: path.append(prev[path[-1]])
path.reverse()
route = [xy(*n) for n in path]
route_names = []
for n in path:
    nm = names.get(n)
    if nm and (not route_names or route_names[-1] != nm): route_names.append(nm)
print('route length m', round(dist[end]), 'points', len(route), 'via', route_names)

# linha da costa: o trecho do oceano é o que passa na latitude do destino (os outros trechos
# são do estuário do Pina, ao norte). O polígono do mar fecha a leste.
segs = [[xy(p['lat'], p['lon']) for p in w['geometry']] for w in osm if w.get('tags', {}).get('natural') == 'coastline']
ocean = [s for s in segs if min(p[1] for p in s) < 0 < max(p[1] for p in s)]
chain = max(ocean, key=len)
if chain[0][1] > chain[-1][1]: chain = chain[::-1]  # norte → sul
coast = [p for p in chain if abs(p[1]) < R_STREET + 400]
coast = simplify(coast, 1.5)
sea = coast + [(R_STREET + 1400, coast[-1][1]), (R_STREET + 1400, coast[0][1])]

buildings = []
for e in bld:
    g = e.get('geometry') or []
    if len(g) < 4: continue
    pts = [xy(p['lat'], p['lon']) for p in g][:-1]
    cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
    if not inside(cx, cy, R_BLD): continue
    # Polígono fechado: divide no vértice mais distante do primeiro e simplifica as duas metades.
    far = max(range(len(pts)), key=lambda i: math.dist(pts[0], pts[i]))
    s = simplify(pts[:far+1], 0.7)[:-1] + simplify(pts[far:] + [pts[0]], 0.7)[:-1]
    if len(s) < 3: continue
    buildings.append([q(c) for p in s for c in p])

# a rota termina na rua, no ponto mais próximo do link (o destino fica a poucos metros dali):
# entre os trechos de rua que saem do último nó da rota, a projeção do ponto (0, 0)
def proj0(a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]; L2 = dx*dx + dy*dy or 1e-9
    t = max(0, min(1, (-a[0]*dx - a[1]*dy) / L2)); return (a[0] + t*dx, a[1] + t*dy)
last = route[-1]
cands = []
for w in osm:
    if w.get('tags', {}).get('name') != 'Rua José Trajano': continue
    pts = [xy(p['lat'], p['lon']) for p in w.get('geometry') or []]
    for i in range(len(pts) - 1):
        if min(math.dist(pts[i], last), math.dist(pts[i+1], last)) < 1:
            q_ = proj0(pts[i], pts[i+1]); cands.append((math.hypot(*q_), q_))
route_end = [q(c) for c in min(cands)[1]] if cands else None
print('route end', route_end)

out = {
    'attribution': '© OpenStreetMap contributors (ODbL)',
    'origin': [lat0, lon0],
    'streets': streets,
    'coast': [q(c) for p in coast for c in p],
    'sea': [q(c) for p in sea for c in p],
    'buildings': buildings,
    'route': [q(c) for p in route for c in p],
    'start': [q(c) for c in route[0]],
    'dest': [0, 0],
    'routeEnd': route_end,
}
s = json.dumps(out, separators=(',', ':'))
open('map.json', 'w').write(s)
print('streets', {k: len(v) for k, v in streets.items()}, 'buildings', len(buildings), 'coast', len(coast), 'size KB', len(s) // 1024)

# Dados do mapa

`build_map.py` gera `scripts/data/map.json` a partir de dados do OpenStreetMap (ODbL):
ruas, quadras, a linha da costa e a rota da orla (Avenida Boa Viagem) até a Rua José Trajano,
com mão de direção respeitada. Coordenadas em metros a partir do ponto do link do Apple Maps.

`build_route_svg.py` lê o `map.json` e gera `dist/assets/route.svg` (o mapa do endereço: ruas,
quadras, costa, a rota da orla e o destino), desenhado pela linha de luz no site.

Entradas (consultas Overpass salvas na pasta de trabalho): `osm.json` (ruas e costa num raio de
~2,2 km) e `bld.json` (prédios num raio de ~1,5 km). A atribuição "© OpenStreetMap" aparece no
mapa e no rodapé.

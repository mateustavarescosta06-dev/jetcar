# Dados do mapa

`build_map.py` gera `dist/assets/map.json` a partir de dados do OpenStreetMap (ODbL):
ruas, quadras, a linha da costa e a rota da orla (Avenida Boa Viagem) até a Rua José Trajano,
com mão de direção respeitada. Coordenadas em metros a partir do ponto do link do Apple Maps.

Entradas (consultas Overpass salvas na pasta de trabalho): `osm.json` (ruas e costa num raio de
~2,2 km) e `bld.json` (prédios num raio de ~1,5 km). A atribuição "© OpenStreetMap" aparece no
mapa e no rodapé.

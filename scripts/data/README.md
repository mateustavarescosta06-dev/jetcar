# Dados do mapa

`build_map.py` gera `scripts/data/map.json` a partir de dados do OpenStreetMap (ODbL):
ruas, quadras, a linha da costa e a rota da orla (Avenida Boa Viagem) até a Rua José Trajano,
com mão de direção respeitada. Coordenadas em metros a partir do ponto do link do Apple Maps.

`build_route_svg.py` lê o `map.json` e gera `dist/assets/route.svg` (o mapa do endereço: ruas,
quadras, costa, a rota da orla e o destino), desenhado pela linha de luz no site.

`build_coast_svg.py` lê o mesmo `map.json` e gera o mapa da orla do silêncio (a ficha da praia):
`dist/assets/coast-map.svg` (mar, ruas apagadas, costa) e o desenho por cima no `index.html`, entre
`<!-- coast:start -->` e `<!-- coast:end -->` (o vento do mar, a loja, os nomes, o norte e a
escala de 500 m; inline para usar a Barlow). Os dois usam o mesmo recorte e cobrem a caixa do mesmo
jeito, então o quadro do desktop e a faixa do celular mostram o mesmo lugar.

Entradas (consultas Overpass salvas na pasta de trabalho): `osm.json` (ruas e costa num raio de
~2,2 km) e `bld.json` (prédios num raio de ~1,5 km). A atribuição "© OpenStreetMap" aparece no
mapa e no rodapé.

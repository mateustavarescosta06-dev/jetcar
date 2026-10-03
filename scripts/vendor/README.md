# Bibliotecas servidas em `dist/vendor`

- `three.min.js`: Three.js r186 só com o que o site usa (inclui MeshPhysicalMaterial,
  MeshStandardMaterial, RectAreaLight e PMREMGenerator, usados no capô do Ceramic). Gerado com
  esbuild a partir de `three-entry.js`: `npm i three@0.186 esbuild` e
  `npx esbuild three-entry.js --bundle --format=esm --minify --legal-comments=none --outfile=three.min.js`.
- `three-ltc.js`: as tabelas LTC das luzes de área (`RectAreaLightUniformsLib`, cerca de 100 KB
  comprimido), separadas para só a cena do Ceramic carregar. Com `three-ltc-entry.js` na mesma
  pasta do `node_modules`:
  `npx esbuild three-ltc-entry.js --bundle --format=esm --minify --legal-comments=none --external:three --outfile=three-ltc.js`
  e depois `sed -i 's#from"three"#from"./three.min.js"#g' three-ltc.js` (o módulo usa a mesma
  instância do three.min.js).
- `lenis.min.js`: Lenis (rolagem suave), versão ESM minificada do pacote `lenis`.

As licenças (MIT) estão ao lado dos arquivos em `dist/vendor`.

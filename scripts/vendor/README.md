# Bibliotecas servidas em `dist/vendor`

- `three.min.js`: Three.js r186 só com o que o site usa. Gerado com esbuild a partir de
  `three-entry.js`: `npm i three@0.186 esbuild` e
  `npx esbuild three-entry.js --bundle --format=esm --minify --legal-comments=none --outfile=three.min.js`.
- `lenis.min.js`: Lenis (rolagem suave), versão ESM minificada do pacote `lenis`.

As licenças (MIT) estão ao lado dos arquivos em `dist/vendor`.

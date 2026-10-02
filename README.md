# JETCAR — Landing page

Experiência contínua de estética automotiva em Boa Viagem, Recife. Uma única jornada de rolagem, sem divisão de páginas: o filme do Porsche aparece dentro do logo JETCAR, a câmera atravessa o farol do emblema e cada serviço se transforma no seguinte — bolhas, disco giratório, colmeia de hexágonos, camadas da pintura explodidas em 3D, porta que se abre, vidro embaçado para limpar com o dedo, um arco 3D para escolher o serviço e, no fim, BOA VIAGEM com o filme dentro das letras.

## Rodar localmente

Com Node.js 18 ou superior:

```bash
npm start
```

Abra http://localhost:3000. Não há dependências para instalar. Alternativa: `python3 -m http.server 3000 --directory dist`.

## Estrutura

- `dist/index.html`: conteúdo (textos, formulário, diálogos) e o palco visual.
- `dist/style.css`: apresentação, layouts por orientação e fallback sem JavaScript.
- `dist/experience.js`: ponto de entrada (rolagem, ponteiro, quadro a quadro).
- `dist/js/timeline.js`: linha do tempo em unidades — o lugar para ajustar ritmo e pausas de leitura.
- `dist/js/matte.js`, `scenes.js`, `fx.js`, `copy.js`, `ui.js`: logo/filme recortado, cenas 3D, efeitos interativos, textos e interface.
- `dist/assets/`: filmes, pôsteres, fotos, logo vetorial e fonte. São arquivos de origem versionados; não tratar `dist` como pasta descartável.
- `scripts/`: servidor local (com suporte a Range), verificação e geradores (logo vetorial, contornos de texto, versões do filme).

Detalhes de arquitetura, requisitos e decisões estão em `CLAUDE.md`.

## Contato e localização

A mensagem de contato é montada no próprio site: o visitante escolhe o cuidado, copia o texto e abre o Direct do Instagram (`ig.me/m/jetcarbv`). Não há envio automático nem backend.

Localização: https://maps.apple/p/uRv~vCQ0G1zNn4 (Rua José Trajano, Boa Viagem, Recife – PE). Instagram: https://www.instagram.com/jetcarbv/

## Validação

```bash
npm run check
```

Verifica a sintaxe de todos os scripts e se cada arquivo referenciado existe. Antes de publicar, conferir em iPhone/Safari e desktop: autoplay (com Modo Pouca Energia o pôster aparece com o botão de play), fluidez das cenas, toque no anel de serviços, formulário com teclado aberto e movimento reduzido.

## Publicação

Sirva `dist/` em qualquer hospedagem estática (Vercel, Netlify, GitHub Pages). Todos os assets ficam no próprio projeto. As fotos e o vídeo são ilustrativos.

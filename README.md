# JETCAR — Site

Site da JETCAR Estética Automotiva, em Boa Viagem, Recife. A rolagem conduz um filme: o Porsche aparece no escuro e uma linha de luz revela o carro; a câmera recua por dentro do logo JETCAR e atravessa a letra A até a lavagem; mergulha na pintura e entra num estúdio em 3D (correção de pintura com luz de inspeção e politriz, Ceramic Coating, as camadas da pintura separadas, PPF, o para-brisa e o interior); volta ao filme para o final e termina no mapa, com a rota da orla até a Rua José Trajano. Depois vêm o agendamento, as dúvidas e o rodapé.

## Rodar localmente

Com Node.js 18 ou superior:

```bash
npm start
```

Abra http://localhost:3000. Não há dependências para instalar (as bibliotecas já estão em `dist/vendor`). Alternativa: `python3 -m http.server 3000 --directory dist`.

## Estrutura

- `dist/index.html`: menu, palco (canvas, legendas, rótulos), trilho dos capítulos, agendamento, dúvidas e rodapé.
- `dist/style.css`: visual (Barlow, vermelho, botões inclinados), legendas, página e fallbacks.
- `dist/experience.js`: ponto de entrada (rolagem, âncoras, quadro a quadro).
- `dist/js/chapters.js` e `captions.js`: duração de cada capítulo e janelas das legendas.
- `dist/js/gl/`: renderizador (HDR, bloom, profundidade de campo), filme com profundidade, logo 3D, estúdio 3D e mapa.
- `dist/js/ui.js`, `audio.js`: interface, configurador de agendamento e som opcional.
- `dist/assets/`: quadros do filme, vídeo de fallback, interior, dados do mapa, logo e fontes. São arquivos de origem versionados; não tratar `dist` como pasta descartável.
- `scripts/`: servidor local, verificação e geradores (logo, quadros e profundidade, mapa, bibliotecas).

Detalhes de arquitetura, requisitos e decisões estão em `CLAUDE.md`.

## Contato e localização

A mensagem é montada no próprio site: o visitante diz o carro e o que quer melhorar, e a mensagem pronta é copiada e aberta no Direct do Instagram (`ig.me/m/jetcarbv`). Não há envio automático nem backend.

Localização: https://maps.apple/p/uRv~vCQ0G1zNn4 (Rua José Trajano, Boa Viagem, Recife – PE). Instagram: https://www.instagram.com/jetcarbv/. Mapa: dados © OpenStreetMap (ODbL).

## Validação

```bash
npm run check
```

Verifica a sintaxe dos scripts, os arquivos referenciados e os quadros do filme. Antes de publicar, conferir em celular real e desktop: fluidez ao rolar, menu, agendamento com o teclado aberto, som (botão no menu) e movimento reduzido (botão no rodapé).

## Publicação

Sirva `dist/` em qualquer hospedagem estática (Vercel, Netlify, GitHub Pages). Todos os assets ficam no próprio projeto. As fotos e o vídeo são ilustrativos.

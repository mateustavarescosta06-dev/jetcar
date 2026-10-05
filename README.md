# JETCAR · Site

Site da JETCAR Estética Automotiva, em Boa Viagem, Recife. A página é o corredor de uma oficina percorrido baia por baia, e uma linha de luz branca (o Light Trace) conduz tudo: ela encontra o carro no hero, atravessa a água congelada da lavagem, é a luz de inspeção do polimento, separa as camadas da pintura e ativa o Ceramic Coating, acompanha a borda da película do PPF, limpa o vidro na passagem para o interior, vira a navegação no topo e, no fim, a rota até a Rua José Trajano.

Cada serviço tem a própria cena, o próprio card e a própria interação: vídeo curto controlado pela rolagem que congela em 3D (lavagem), pintura em 3D com luz que revela os riscos (polimento), vista explodida das camadas que a pessoa separa (Ceramic), película que atravessa a carroceria com empilhamento de cards (PPF) e foto em camadas com pontos para explorar (interior). Depois vêm o resultado, o pedido (configurador), o endereço, as dúvidas e o rodapé.

## Rodar localmente

Com Node.js 18 ou superior:

```bash
npm start
```

Abra http://localhost:3000. Não há dependências para instalar (as bibliotecas já estão em `dist/vendor`). `?debug` expõe `window.__jetcar` para os testes.

## Estrutura

- `dist/index.html`: barra com o trilho de luz, os atos (hero e as cinco baias), resultado, pedido, endereço, dúvidas e rodapé. Todo o texto, cards e botões são HTML.
- `dist/style.css`: visual (Barlow, vermelho, botões inclinados), cards, versões para celular, movimento reduzido e sem JavaScript/WebGL.
- `dist/app.js`: ponto de entrada (atos, rolagem, âncoras, o canvas WebGL único que passa de um ato para outro).
- `dist/js/acts/`: um arquivo por ato (`hero`, `wash`, `polish`, `protect`, `interior`, `route`).
- `dist/js/gl/`: renderizador (HDR, bloom, profundidade de campo), barras de luz analíticas e os materiais do estúdio.
- `dist/js/ui.js`, `audio.js`: barra, menu, pedido, movimento reduzido e som opcional.
- `dist/assets/`: camadas do hero, trecho da lavagem (MP4 e WebM com GOP denso), fotos ampliadas, camadas do interior, mapa em SVG, pôsteres, logo e fontes. São arquivos de origem versionados.
- `scripts/`: servidor local, verificação e geradores (recorte, placa limpa, ampliação, camadas, encode do scrub, mapa, pôsteres, logo, bibliotecas).

Detalhes de arquitetura, requisitos e decisões estão em `CLAUDE.md`; o processo de design (brief, plano, score) em `scrollcraft/builds/jetcar-v6/`.

## Contato e localização

A mensagem é montada no próprio site: o visitante diz o carro e o que quer melhorar (também pelos botões "Incluir no pedido" dos cards), e a mensagem pronta é copiada e aberta no Direct do Instagram (`ig.me/m/jetcarbv`). Não há envio automático nem backend.

Localização: https://maps.apple/p/uRv~vCQ0G1zNn4 (Rua José Trajano, Boa Viagem, Recife, PE). Instagram: https://www.instagram.com/jetcarbv/. Mapa: dados © OpenStreetMap (ODbL).

## Validação

```bash
npm run stamp   # depois de mudar qualquer arquivo em dist/
npm run check
```

`npm run stamp` grava a versão do site (`dist/js/version.js`, o hash de tudo o que é publicado): é ela que faz aparecer, para quem está com o site aberto, o aviso de versão nova com o botão "Atualizar" (o site nunca recarrega sozinho). `npm run check` verifica a sintaxe dos scripts, os arquivos referenciados e se a versão está em dia. Antes de publicar, conferir em celular real e desktop: fluidez ao rolar, o trecho da lavagem (busca de quadros), o arrastar das camadas e da película, o pedido com o teclado aberto e o movimento reduzido (botão no rodapé).

## Publicação

Sirva `dist/` em qualquer hospedagem estática. As fotos e o vídeo são ilustrativos.

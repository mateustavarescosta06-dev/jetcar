# JETCAR — Site

Site da JETCAR Estética Automotiva, em Boa Viagem, Recife. O conteúdo rola como em qualquer site — menu, serviços, agendamento, localização, dúvidas e rodapé — enquanto um palco atrás dele faz as transições: o filme do Porsche aparece dentro do logo JETCAR, a câmera mergulha no farol do emblema, que vira a moldura dos serviços, e cada serviço se transforma no seguinte (bolhas, disco giratório, colmeia de hexágonos, camadas da pintura explodidas em 3D, porta que se abre, vidro embaçado para limpar com o dedo, um arco 3D para escolher o serviço) até BOA VIAGEM com o filme dentro das letras.

## Rodar localmente

Com Node.js 18 ou superior:

```bash
npm start
```

Abra http://localhost:3000. Não há dependências para instalar. Alternativa: `python3 -m http.server 3000 --directory dist`.

## Estrutura

- `dist/index.html`: conteúdo do site (menu, seções, formulário, diálogo, rodapé) e o palco visual.
- `dist/style.css`: visual (Geist, vermelho com gradientes sutis), layouts por orientação e fallback sem JavaScript.
- `dist/experience.js`: ponto de entrada (medição dos blocos, rolagem suavizada, ponteiro, âncoras, quadro a quadro).
- `dist/js/timeline.js`: blocos e linha do tempo — o lugar para ajustar ritmo e pausas de leitura.
- `dist/js/media.js`, `matte.js`, `scenes.js`, `fx.js`, `reveal.js`, `ui.js`: moldura/fotos/filme, logo recortado, cenas 3D, efeitos interativos, revelações do conteúdo e interface.
- `dist/assets/`: filmes, pôsteres, fotos, logo vetorial e fontes. São arquivos de origem versionados; não tratar `dist` como pasta descartável.
- `scripts/`: servidor local (com suporte a Range), verificação e geradores (logo vetorial, contornos de texto, versões do filme).

Detalhes de arquitetura, requisitos e decisões estão em `CLAUDE.md`.

## Contato e localização

A mensagem de contato é montada no próprio site: o visitante escolhe o cuidado, copia o texto e abre o Direct do Instagram (`ig.me/m/jetcarbv`). Não há envio automático nem backend.

Localização: https://maps.apple/p/uRv~vCQ0G1zNn4 (Rua José Trajano, Boa Viagem, Recife – PE). Instagram: https://www.instagram.com/jetcarbv/

## Validação

```bash
npm run check
```

Verifica a sintaxe de todos os scripts e se cada arquivo referenciado existe. Antes de publicar, conferir em iPhone/Safari e desktop: autoplay (com Modo Pouca Energia o pôster aparece com o botão de play), fluidez das cenas, toque no arco de serviços, formulário com teclado aberto, menu e movimento reduzido (botão no rodapé).

## Publicação

Sirva `dist/` em qualquer hospedagem estática (Vercel, Netlify, GitHub Pages). Todos os assets ficam no próprio projeto. As fotos e o vídeo são ilustrativos.

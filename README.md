# JETCAR — Landing page

Site estático de estética automotiva em Boa Viagem, Recife. A experiência percorre vídeo, logo com filme dentro das letras, cinco serviços, contato e localização sem divisões visuais explícitas.

## Rodar localmente

Com Node.js 18 ou superior:

```bash
npm start
```

Abra http://localhost:3000. Não é necessário instalar dependências. Alternativa: `python3 -m http.server 3000 --directory dist`.

## Estrutura

- `dist/index.html`: conteúdo, formulários locais, detalhes dos serviços e dúvidas.
- `dist/style.css`: apresentação responsiva e camadas visuais.
- `dist/experience.js`: progressão por rolagem, máscaras, revelações, diálogos e mensagem de contato.
- `dist/assets/`: vídeo MP4, máscara transparente da marca e imagens WebP. São arquivos de origem versionados; não apagar nem tratar `dist` como pasta descartável.
- `scripts/serve.cjs`: servidor local com suporte a Range para reprodução do vídeo.

## Continuação no Claude Code

Leia `CLAUDE.md` antes de editar. Use o projeto como base e preserve o fluxo contínuo. O vídeo toca automaticamente sem som, enquanto a rolagem controla as transições. A mensagem de contato é preparada localmente: o usuário copia e envia pelo Instagram; não existe envio automático nem backend.

Localização fornecida: https://maps.apple/p/uRv~vCQ0G1zNn4
Instagram: https://www.instagram.com/jetcarbv/

## Validação

```bash
npm run check
```

A sintaxe e a lógica das etapas, detalhes dos serviços, seleção e geração da mensagem foram verificadas. A tentativa de QA visual não pôde rodar por falta do Chromium na sessão. Conferir reprodução automática, fluidez, recortes das fotos e formulário em iPhone/Safari e desktop antes de considerar o acabamento concluído.

## Publicação

Sirva `dist/` em qualquer hospedagem estática. Todos os assets ficam no próprio projeto. A configuração específica de ChatGPT Sites não é necessária para continuar no GitHub.

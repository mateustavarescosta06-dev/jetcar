# Contexto e direção do projeto JETCAR

## Objetivo do usuário

Landing page completa, cinematográfica e interativa para @jetcarbv. A referência mostra uma cena que muda de escala, aparece dentro de letras e leva à cena seguinte. O usuário prioriza inovação nas formas, rotações e interação entre elementos, com continuidade visual durante toda a rolagem. Não converter em uma landing convencional de cards e seções empilhadas.

## Requisitos preservados

- Começar com o vídeo existente do Porsche 911 Turbo S.
- Mostrar o filme em movimento dentro da marca JETCAR; a marca se amplia para revelar a sequência.
- O vídeo deve continuar passando: houve reclamação quando a versão anterior congelava a reprodução ao vincular os frames à rolagem. Hoje a rolagem controla efeitos, o vídeo toca independentemente.
- Cinco serviços confirmados pelo perfil: Lavagem técnica, Polimento, Ceramic Coating, PPF, Higienização.
- Local: Boa Viagem, Recife. Link exato: https://maps.apple/p/uRv~vCQ0G1zNn4
- Não inventar telefone, horários, endereço de rua, preços, depoimentos, garantias ou resultados de clientes.
- Contato pelo Instagram https://www.instagram.com/jetcarbv/; o perfil tem WhatsApp, mas o número não foi fornecido.
- As fotografias de serviço e o vídeo foram gerados como ilustrações, não são trabalhos reais da empresa.

## Arquitetura atual

HTML/CSS/JavaScript puro, sem bundler. `dist/` é fonte mantida à mão, incluindo assets, e deve ser versionada. O controlador em `dist/experience.js` usa uma viewport fixa e uma jornada longa de rolagem. Os intervalos normalizados são: abertura/logo 0–0,22; serviços 0,22–0,72; consulta 0,72–0,84; localização 0,84–1.

Vídeo nativo em autoplay/muted/loop/playsinline. Canvas sobreposto desenha uma camada preta com transparência na silhueta do logo; o vídeo fica visível através dela. As imagens seguintes usam clip-path, escala e rotação. Diálogos nativos exibem detalhes e FAQ. Formulário prepara mensagem para copiar, sem envio.

## Executar e verificar

`npm start` serve http://localhost:3000. `npm run check` valida sintaxe. Sem dependências externas. Conferir no Safari/iPhone e desktop: autoplay com fallback, vídeo dentro da máscara, rolagem reversível, toques nos detalhes, escolha de serviço, mensagem, foco e ausência de cortes/overflow. QA visual ainda pendente.

## Assets e orçamento

Vídeo: 15 segundos em 1080p, custo já pago de 30 créditos no Higgsfield. O limite autorizado naquela geração era 35 créditos. Não gerar novos vídeos ou gastar créditos sem uma nova autorização do usuário. As cinco imagens existentes e a máscara já estão incluídas.

## Melhorias prioritárias

1. Validar e ajustar a fluidez e os enquadramentos no iPhone.
2. Refinar as conexões entre os serviços para ficar mais perto da referência.
3. Revisar o loop do vídeo, o contraste e os intervalos em que os textos ficam legíveis.
4. Integrar fotos reais, telefone e dados comerciais quando fornecidos.

Preserve acessibilidade, teclado, preferência de redução de efeitos e alternativas para autoplay bloqueado.

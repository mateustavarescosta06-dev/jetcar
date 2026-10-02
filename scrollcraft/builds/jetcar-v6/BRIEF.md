# BRIEF · JETCAR v6

Fonte: mensagem do usuário pedindo a v6 (revisão profunda), mais as regras do projeto em
`CLAUDE.md`. As respostas abaixo citam o usuário entre aspas quando ele disse algo explícito.
O que está marcado **[decisão autoral]** foi decidido por mim dentro do que ele delegou
("Escolha os dispositivos que melhor contam cada transformação").

## 1. Vibe e referências

- "Experiência de web premium, automotiva, espacial e altamente interativa. Mas ela deve
  continuar sendo claramente um WEBSITE."
- "WEB DESIGN + AUTOMOTIVE ART DIRECTION + SPATIAL COMPOSITION + INTERACTION + CINEMA. Não um
  desses isoladamente."
- Teste de qualidade herdado da v5: "isso poderia estar num filme da Porsche, McLaren ou
  Lamborghini?"
- Referências: pedidas de Awwwards, Godly, Motion Sites, 21st.dev e sites automotivos premium,
  com "O QUE está sendo usado da referência". Levantamento em `audit/REFS.md`.

## 2. A jornada, nas palavras dele

Hero em camadas, depois cada serviço com "um momento próprio" e um CARD, na ordem
"01 Lavagem Técnica, 02 Polimento, 03 Ceramic Coating, 04 PPF, 05 Higienização Interna".
Cada serviço segue "CENA → CARD → INTERAÇÃO → TRANSIÇÃO → PRÓXIMA CENA". Depois:
"RESULTADO photographic full bleed + CTA" (do exemplo dele) e "reduzir intensidade. Criar um
configurador limpo. QUAL É O SEU CARRO? → O QUE VOCÊ QUER MELHORAR? → AGENDAR". A luz
"posteriormente pode virar a rota da localização".

## 3. Curva de energia

"calma → curiosidade → impacto → pausa → descoberta → PICO → resolução." "A página NÃO pode
estar no máximo de intensidade o tempo inteiro." "Os cards serão os momentos em que o site
RESPIRA. Vídeo/3D: movimento. Card: pausa. Interação: descoberta. Transição: antecipação."
Depois dos serviços: "Aqui não quero espetáculo. Quero precisão."

## 4. Sentimento por etapa e o momento único

Sentimento por etapa: ver a curva abaixo. Pico: "o exploded view / transformação de
Ceramic + PPF pode ser candidato ao pico. Mas analise antes." Análise em `PLAN.md` §4: o pico
é o ato Proteção (03 + 04) como um único ato.

## 5. O que este site faz que nenhum outro faz (semente da assinatura)

"JETCAR LIGHT TRACE. Uma barra/reflexo de luz branca atravessa a experiência. [...] revela o
carro; cruza a pintura; revela defeitos; forma bordas de cards; separa layers; ativa Ceramic;
acompanha PPF; vira elemento de navegação; e posteriormente pode virar a rota da localização.
[...] ele deve mudar de função ao longo do site. Não simplesmente repetir a mesma animação."

## 6. Distância do premium-minimal

Escuro, automotivo, com a identidade da v4/v5 (Barlow, vermelho `#d7261e` chapado, botões em
paralelogramo). Proibidos por ele: glassmorphism, raio grande, blur, sombra genérica, ícone no
canto, neon, ciano, "coating cyberpunk", "PPF neon", "interior bege".

## 7. Um mundo contínuo ou cenas distintas?

Cenas distintas. "NÃO transforme a página inteira em um flythrough. NÃO use uma única câmera
virtual viajando continuamente durante toda a página."

## 8. Assets disponíveis

- Vídeo master `porsche-scroll.mp4` (1916×1080, 24 fps, 15 s, H.264 6 Mb/s): galpão escuro,
  aproximação, jato d'água, lavagem com luva, gotas, plano aberto molhado.
- Fotos ilustrativas 1536×1024 (lavagem, polimento, ceramic, PPF, interior), `finish`
  (1916×1080) e `poster` (1672×941), todas geradas antes, mesma produção (911 grafite, galpão
  escuro com tiras de luz verticais).
- Logo (máscara e SVG), fontes Barlow, mapa OSM.
- Sem chave de geração (kie.ai/Higgsfield) e sem autorização para gastar créditos: build com
  os assets existentes, recortados, limpos e ampliados localmente. Sem novo vídeo.

## Curva de sentimento (antes dos atos)

1. Hero: **calma, expectativa**. O galpão escuro, o carro parado; uma linha de luz encontra o
   carro e fica.
2. 01 Lavagem: **curiosidade → impacto → pausa**. A água bate sob a sua rolagem, o tempo para e
   o jato fica suspenso em volta do carro, para fora da moldura.
3. 02 Polimento: **descoberta, silêncio**. Escuridão, só a luz de inspeção; o que o olho não
   via aparece no verniz, e você guia a luz.
4. 03 + 04 Proteção: **domínio, assombro (PICO)**. Você separa a pintura nas cinco camadas, a
   luz corre entre elas e a camada de cima ganha vida; o card do PPF assume a frente e uma
   película transparente atravessa a carroceria.
5. 05 Interior: **intimidade**. Pelo vidro para dentro da cabine; tudo para; você toca os
   detalhes.
6. Resultado: **orgulho**. O carro pronto em foto inteira, a luz passa uma última vez.
7. Configurador: **decisão, precisão**. Seu carro, o que melhorar, mensagem pronta.
8. Endereço: **chegada**. A linha vira a rota até a Rua José Trajano e termina na porta, com o
   seu pedido.

## O pico

Frase de quem viu: "eu puxei a pintura do carro em camadas, uma linha de luz passou entre elas
e a de cima começou a segurar a água; depois uma película transparente fechou por cima do
carro." Vive no ato Proteção (03 + 04), o maior da página.

## Tell-someone sentence

"É o site em que a luz da JETCAR percorre o carro e cada etapa do tratamento é revelada
conforme você explora." (do usuário)

## Silêncios autorais

- Polimento começa no preto com só a linha de luz: é o silêncio antes do pico, não rolagem
  morta.
- Depois do congelamento da lavagem, o ato segura parado enquanto o card 01 entra: pausa
  intencional.
- O interior para depois da passagem pelo vidro: a cena fica parada de propósito.

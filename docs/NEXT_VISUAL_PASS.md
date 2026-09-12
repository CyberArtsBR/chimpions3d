# Chimp Jump: próxima etapa visual e entrega de assets

## Implementado nesta etapa
- Mobile (tela até 600 px ou ponteiro touch principal): Balanced automático; desktop: High automático. Preferências antigas não substituem o perfil.
- Intervalos verticais de 3,15–3,75 unidades, sem empilhamento direto. Salto normal continua com altura teórica de 4,41.
- Ritmo começa em 1,06× e chega a 1,30× após 180 segundos ativos. Pausa não conta; temas continuam mudando a cada 30 segundos reais de jogo.
- Após introdução, aproximadamente 35% das novas plataformas são móveis, chegando a 55%. A frequência do movimento cresce suavemente até +45%; deslocamento de ±0,48.
- Interface informa ritmo e tipos de plataforma. Coleção pesquisável, 12 cartões por página, proveniente de CyberArtsBR/chimpions-cards.
- Detalhe adicional de casca, musgo, nós e folhas no desktop. Isso é uma melhoria procedural, ainda não uma entrega de arte realista final.

## Personagens: como enviar
Coloque os GLBs em `public/model/characters/`, por exemplo:
`public/model/characters/The Zealous.glb`.
Use os nomes originais dos cartões. O build tolera diferenças de caixa, espaços, acentos e pontuação; arquivos ambíguos falham com diagnóstico.
O build gera `public/avatars.json`. Personagens sem arquivo aparecem como “GLB coming soon”; não tentamos baixar 221 modelos nem substituí-los silenciosamente pelo padrão.
O catálogo preserva os 221 registros reais do jogo de cartas, incluindo URLs das imagens existentes. A disponibilidade dessas imagens depende do CDN original.
Somente o avatar escolhido é carregado. O anterior permanece disponível se o novo rig falhar. Pose inicial e proteção contra T-pose continuam ativas.
Comece com 3–5 GLBs representativos para validar nomes, escala e ombros antes de enviar todos.
Texturas embutidas; preferir até 30–60 mil triângulos e texturas 1K/2K por personagem. Esses valores são metas de produção, não garantia de FPS.

## Árvore realista seamless
Sim: a câmera fixa favorece um tronco em imagem com volume e luz pintados, atrás do personagem, mais floresta distante em camadas e plataformas 3D reais.
A imagem deve repetir verticalmente: bordas superior e inferior precisam coincidir na casca, contorno, iluminação e transparência.
Não desenhar copa nem raízes na faixa repetível. Podem virar imagens separadas depois.
Entrega sugerida: WebP ou PNG RGBA, 1024×4096 (ou 2048×4096 após medir custo), vista frontal, tronco central, luz suave de cima à esquerda e espaço transparente nas laterais.
Evitar nós enormes idênticos: preparar 2–3 variantes compatíveis para uma próxima etapa de composição.
Há um ponto de integração pronto: coloque a imagem em `public/environment/tree-seamless.webp` e ajuste:
```json
{"treeImage":"environment/tree-seamless.webp"}
```
em `public/environment.json`.
No desktop, a imagem substitui o tronco procedural após carregar. O mobile preserva o cenário Balanced. Se a imagem falhar, o tronco procedural continua.
A textura acompanha a altura por coordenadas UV, sem emenda entre vários planos. O asset ainda precisa de inspeção visual para comprovar que sua repetição é imperceptível.

## Plataformas GLB
Primeiro entregar 3 variantes: galho sólido com musgo, galho rachado, e galho com cogumelo de impulso.
Meta inicial por variante: 1–5 mil triângulos, 1 material ou atlas compartilhado, texturas 1K/2K com cor, normal e rugosidade; texturas embutidas.
Eixos: X horizontal, Y para cima, frente visível em +Z. Origem no centro da superfície de pouso, em Y=0; madeira abaixo de zero.
Largura de referência: 2,5 unidades. Evitar folhagem tapando a superfície de pouso.
A plataforma móvel pode reutilizar o sólido com indicadores ciano; não exige outro GLB.
Pasta proposta: `public/environment/platforms/`. O carregador de plataformas GLB será integrado quando tivermos um exemplar real para conferir origem, material e superfície. Não está implementado nesta etapa.

## Ordem de produção
1. Teste online do ritmo e da seleção com os assets atuais.
2. Uma árvore seamless e um galho GLB como amostra visual. Avaliar legibilidade do personagem e pouso antes de produzir variantes.
3. Integrar modelos, sombras e iluminação; conferir desktop e mobile em aparelhos reais.
4. Ampliar variantes, detalhes de fundo e efeitos suaves usando orçamento medido de memória, draw calls e tempo de quadro.
Manter Vite, JavaScript e Three.js. Trocar linguagem não resolve a qualidade da arte. O maior ganho seguinte depende de materiais e assets bem produzidos.

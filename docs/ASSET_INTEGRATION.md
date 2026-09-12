# Integração dos assets e nova tela inicial — 12/09/2026

## Tela inicial
A referência enviada foi convertida em uma placa de fundo WebP; apenas o logo CHIMP JUMP permanece desenhado na imagem. Jogar, escolher chimp, upload local, qualidade, laboratório e instruções são elementos HTML reais. A seleção abre em diálogo com busca, paginação, foco de teclado e indicação de arquivos indisponíveis.
No desktop, High é padrão e Low é opcional. No mobile, Balanced continua automático. A arte da tela inicial é estática e compartilhada entre os perfis.

## Inventário real
Foram encontrados 209 GLBs em public/model/characters, correspondentes a 206 dos 221 cartões. Há 207 opções jogáveis contando o padrão e dois extras.

- The Boson.glb é uma cópia idêntica de The Bosun.glb: apenas uma entrada é exibida.
- The First Born e The VassalCAT são extras, sem associação inventada a cartões.
- The Ordained não contém esqueleto; The Inverted contém apenas um osso. Ambos aparecem como rigs a corrigir. Não são substituídos silenciosamente pelo chimp padrão.
- As diferenças de grafia revisadas ficam explicitamente em scripts/avatars.mjs.

### Cartões ainda sem GLB correspondente
- The Aviator
- The Beacon
- The Bionic
- The Branded
- The Chevalier
- The Deckhand
- The Evaluator
- The Grunt
- The High Priest
- The Irradiated
- The Patient
- The Pensive
- The Preeminent
- The Static
- The Witch Doctor

## Rigs
O carregador aceita os prefixos CC_Base, nomes NeckTwist01 e a cadeia Hip/Pelvis dos novos modelos. A ambiguidade de Hip/Pelvis é resolvida pela hierarquia, sem escolher um osso arbitrário. O modelo permanece fora da cena até a pose inicial ser verificada. Os arquivos GLB, os inverse binds e a pose de referência permanecem intactos.
O catálogo é reconstruído durante npm run build. Só o GLB escolhido é requisitado. Os 207 modelos passaram pelo carregador real; isso não equivale a uma revisão artística individual de todas as deformações e acessórios.

## Plataforma
branch-moss.glb contém 13.056 triângulos e três texturas. A mesma geometria e os mesmos materiais são compartilhados entre todas as instâncias. O eixo maior foi alinhado em X (rotação Y de -0,44936 rad), com altura e profundidade configuradas em public/environment.json.
A superfície do arquivo é madeira sem musgo; uma camada procedural baixa marca o pouso. Marcadores de movimento, fratura e cogumelo de impulso permanecem visíveis. O collider simples original é mantido: o relevo visual não cria degraus ou colisões imprevisíveis.
Mobile/Low usa as plataformas procedurais anteriores. Falha no GLB também mantém esse fallback.

## Fundo
Duas texturas corrigidas estão em public/environment/tree-wide-v2-9x16.webp e tree-wide-v2-16x9.webp. O tronco foi retificado para 75% da largura; a união vertical foi reconstruída por um corte de baixo erro na textura, com ajuste amplo apenas de iluminação. Isso evita depender apenas da igualdade da primeira e da última linha.
O High usa a variante correspondente à proporção da tela, com repetição UV em função da altura do mundo e mudança suave de tonalidade nos temas. Mobile/Low preserva o cenário procedural. As imagens foram inspecionadas repetidas e em gameplay; padrões da floresta e da casca ainda se repetem por serem tiles finitos.

## Verificação
Build de produção, estruturas dos GLBs, 24.408 transferências de plataformas, laboratório original, gameplay, upload local, alternância de qualidade e seleção. checks/collection-browser.mjs carrega e renderiza todo o catálogo jogável e verifica o diálogo e os rigs indisponíveis. Relatórios e capturas ficam nos artefatos do GitHub Actions.
Render publica main quando os checks passam. Desempenho sustentado e deformações finas ainda precisam de teste em dispositivos reais.

## Proveniência da arte de menu
Referência: imagem enviada pelo usuário em 12/09/2026. Ferramenta: image_gen embutida, modo edição. Prompt: preservar a composição, o cenário, as placas e o logo CHIMP JUMP; remover os demais textos e ícones, deixando placas vazias para controles HTML. Saída de produção: public/ui/start-screen.webp.

# Chimpions Dash — auditoria de desenvolvimento e design
Base analisada: Chimp-Jump, revisão 55a2747, módulos chimpionsLab.js, labRunnerCharacter.js, chimpionsLab.css, menuExtras.js e main.js. Áudio consultado no repositório CyberArtsBR/chimpions-dash.
Esta é uma avaliação do código e do design, não uma certificação de desempenho em dispositivos.

## Implementado neste lote
- Nome Chimpions Dash no menu e na experiência; entrada ?dash=1, com ?lab=1 preservada.
- Importação dinâmica: código, CSS, sprites, avatar e áudio do Dash só são solicitados ao abrir esse modo.
- Mouse esquerdo: saltar; segurar aumenta altura. Mouse direito: duck. Teclado preservado.
- Gamepad: direcional/analógico para cima e baixo; A/B também funcionam; Start inicia/pausa.
- Agregação de entradas: soltar um controle não cancela outro ainda pressionado. Desconexão libera gamepad.
- Salto sem suspensão artificial da gravidade. Toque curto conserva arco mínimo de 70 unidades; altura aumenta com pressão mantida por até 0,22 s.
- Velocidade inicial: 265 → 397,5 unidades/s. Multiplicador composto de 1,20 por estágio de 30 s, sem alterar timestep/gravididade.
- Piso visual em 19% da altura da tela, compartilhado por personagem, sprites e sombra. Removida elevação extra de 50 unidades dos obstáculos aéreos.
- Duck refeito com transição, compressão de pernas, tronco inclinado, cabeça compensada e correção do apoio dos pés.
- Sons originais de salto/slide e demais eventos reutilizados do GameAudio; música original pausada/retomada/reiniciada com o estado da partida.
- Pausa ao perder foco/ocultar aba e proteção contra frames muito longos. Falha ao trocar avatar mantém o anterior utilizável.
- Recorde local separado para a nova velocidade; recordes antigos não foram apagados.

## Prioridades
P0: impede jogar ou causa morte injusta. P1: impacto direto na qualidade. P2: expansão/polimento. P3: opcional.
Complexidade: baixa (alteração localizada), média (múltiplos sistemas), alta (sistema novo ou validação ampla).

| Prioridade | Área | Implementação recomendada | Complexidade | Motivo/critério de conclusão |
|---|---|---|---|---|
| P0 | Progressão | Recalcular o tempo mínimo de reação de padrões já na tela quando o estágio acelera | Média | O aumento de 20% encurta o aviso de obstáculos gerados na velocidade anterior; preservar uma janela justa |
| P0 | Colisão | Colisão varrida entre posições anterior e atual | Média | Velocidade composta sem teto pode atravessar um obstáculo entre passos; detectar toda a trajetória |
| P0 | Assets | Hospedar sprites e música junto do jogo, com manifesto e fallback | Média | Hoje há dependência do site antigo e de GitHub Raw; uma indisponibilidade não pode apagar o percurso |
| P0 | Responsividade | Unificar escala do GLB, sprites e collider em unidades do percurso | Média | Modelo usa altura fixa no mundo 3D e obstáculos usam escala de tela; proporções variam com orientação |
| P1 | Salto | Validar catálogo de padrões com arco mínimo/máximo e janelas de aterrissagem | Média | Cada combinação deve permitir uma resposta sem salto perfeito obrigatório |
| P1 | Duck | Ajustar a pose e sua silhueta por proporções de perna/tronco, mantendo collider compartilhado | Alta | A correção de pés evita flutuar, mas rigs muito diferentes ainda exigem avaliação visual |
| P1 | Colisão visual | Cortar margens transparentes dos sprites e alinhar caixas por tipo | Média | object-fit e baseline corrigidos não garantem que todo PNG tenha conteúdo encostando na borda |
| P1 | Velocidade | Definir modo sem limite versus curva competitiva com teto | Baixa | Pedido atual cresce indefinidamente: ~989 unidades/s aos 150 s e ~2461 aos 300 s; calibrar legibilidade |
| P1 | Tutorial | Três obstáculos guiados: toque curto, salto segurado, duck | Média | Ensinar a mecânica por ação, com distância segura antes da primeira ameaça |
| P1 | Gamepad | Remapeamento, zona morta ajustável e indicação do dispositivo ativo | Média | Controles genéricos podem expor botões/eixos diferentes do mapeamento padrão |
| P1 | Áudio | Volumes independentes, mute persistente e ganho mestre dos sons originais | Média | O áudio original foi restaurado; falta controle fino de volume dentro do Dash |
| P1 | Feedback | Poeira de aterrissagem/slide, indicação breve do obstáculo que causou a morte | Média | Aumenta sensação de contato e compreensão da falha sem excesso de partículas |
| P1 | Performance | Evitar CSS de largura/altura por frame e limitar efeitos em mobile | Média | Dimensões só precisam mudar no resize/spawn; reduzir layout, sombras e filtros |
| P1 | Performance | Reduzir renderização no menu/pausa e atualizar HUD apenas quando muda | Baixa | HUD já tem cache de texto; cenário e animação ainda trabalham continuamente |
| P1 | Persistência | Histórico de corridas e melhor por Chimpion, com migração versionada | Média | Preservar progresso quando mudar a fórmula ou velocidade |
| P1 | QA de lançamento | Verificação curta de entrada/menu/primeiro salto em navegador real | Baixa | Compilar não detecta exceções de inicialização ou eventos que não funcionam |
| P2 | Direção visual | Separar ameaça baixa, ameaça alta e passagem de duck por silhueta | Média | Não depender apenas da cor; deixa a leitura mais rápida |
| P2 | Biomas | Fundos/modulares próprios por ambiente, transições sem alterar piso | Alta | O cenário usa principalmente o mesmo fundo com mudança de paleta |
| P2 | Animação | Apoio dos pés durante corrida, transição aterrissagem→corrida e inclinação de velocidade | Alta | Reduz deslizamento visual sem alterar o personagem físico |
| P2 | Câmera | Antecipação horizontal e ajuste de enquadramento pela velocidade | Média | Mais tempo de leitura sem diminuir a visibilidade dos obstáculos pequenos |
| P2 | Acessibilidade | Reduzir movimento, contraste alto, controles grandes e pausa acessível | Média | Melhorar mobile e jogadores sensíveis a flashes/movimento |
| P2 | Seleção | Busca, favoritos, prévia grande e carregamento cancelável | Média | O select atual fica pouco prático com mais de 200 personagens |
| P2 | Pontuação | Explicar flow, combo e bônus; mostrar causa da perda de sequência | Baixa | Há mecânica de flow no código, mas pouco ensino visual |
| P2 | Recompensas | Trilhas de bananas que ensinem a trajetória; bônus de risco opcionais | Média | Evitar chamar o jogador para um arco incompatível com o obstáculo |
| P2 | Resultados | Comparar distância, bananas, combo e melhor estágio; retry imediato | Média | Dar uma meta concreta para a próxima tentativa |
| P2 | Ranking | Ranking próprio do Dash, com replay validado e versão das regras | Alta | Não misturar com o ranking do jumper; estado atual do Dash é local |
| P2 | Diagnóstico | Métricas locais de morte por obstáculo/tempo de reação, opcionais | Média | Ajustar dificuldade com evidência; sem coletar dados pessoais desnecessários |
| P2 | Manutenção | Extrair física/padrões do módulo de DOM/Three.js | Média | Torna a geração e replay reutilizáveis sem reconstruir a engine |
| P3 | Polimento | Pequenos sinais de progresso, comemoração de recordes e haptics opcionais | Baixa | Reforça identidade sem bloquear controle |

## Modos e minigames reaproveitando a base
| Modo | Prioridade | Complexidade | Reuso e diferença principal |
|---|---|---|---|
| Treino de salto/duck | P1 | Baixa | Mesmo percurso com reinício local e escolha de tipo de obstáculo |
| Sprint de 60 segundos | P2 | Média | Mesma corrida, chegada fixa e placar de bananas/precisão |
| Desafio diário com seed | P2 | Média | Gerador existente com seed por data e versão de regras |
| Contra o próprio fantasma | P2 | Alta | Gravar comandos e reproduzir um runner translúcido |
| Banana Rush | P2 | Média | Percurso com rotas de coleta, combos e tempo limitado |
| Perfect Rhythm | P2 | Média | Premiar janelas de salto e slide perfeitos, sem depender só de sobreviver |
| Survival sem limite | P2 | Baixa | Progressão atual mantida explicitamente como desafio extremo |
| Corrida com checkpoints | P2 | Média | Trechos autorais curtos, checkpoints e medalhas por desempenho |
| Revezamento de Chimpions | P3 | Alta | Troca de avatar em pontos seguros; carregar somente o próximo necessário |
| Competição assíncrona | P3 | Alta | Mesma seed para todos, ranking separado e validação servidor; sem multiplayer em tempo real |

## Ordem sugerida
1. Justiça e robustez: colisão varrida, escala única, janela de reação e assets locais.
2. Sensação de jogo: tutorial, animação por rig, feedback e áudio configurável.
3. Performance/mobile e interface de seleção/resultados.
4. Sprint e desafio diário.
5. Ghosts e ranking próprio após separar/reutilizar a simulação.

Não iniciar esses itens automaticamente: são a lista de decisão para os próximos lotes.

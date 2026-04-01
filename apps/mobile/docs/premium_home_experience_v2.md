# Premium Home Experience V2

Escopo: home mobile focada em retorno, recorrencia e booking rapido para `apps/mobile`.

Base real do app:
- `GrowthJourneyBuilder` ja calcula `onTrack`, `dueSoon`, `dueNow` e `lapsed`.
- `RetentionV1Builder` ja tem trilhos de confianca para servico, profissional e horario.
- `PremiumHomeScreen`, `RetentionV1HomeBlock`, `SalonFeedPostCard`, `PressFeedback`, `design_tokens.dart` e `tenant_theme.dart` ja oferecem a base de apresentacao.

Objetivo do produto:
- fazer a cliente sentir "esse salao me entende"
- transformar retorno em gesto simples, nao em tarefa
- puxar booking antes de conteudo disperso
- manter sensacao premium sem parecer venda agressiva

## 1. Modos de usuario

### Default Mode
Usar quando a inteligencia nao esta confiavel o bastante para prometer um profissional ou horario especifico.

Regra exata:
- `service_confidence != trusted`, ou
- `service_confidence == trusted`, mas `staff_confidence != trusted` e `time_confidence != trusted`, ou
- nao existe slot compativel futuro, ou
- existe ruido nos dados: servico do ultimo atendimento nao esta mais ativo, nome da profissional ausente, empate de habito entre 2 profissionais, ou agenda futura ja marcada.

Comportamento:
- hero fala de continuidade, nao de "adivinhacao"
- preseleciona ultimo servico quando ele existir
- nunca promete profissional ou horario especifico
- CTA leva para booking simplificado, nao para confirmacao direta

### Smart Mode
Usar quando temos sinal suficiente para antecipar a decisao sem parecer invasivo ou errado.

Regra exata:
- `service_confidence == trusted`
- e (`staff_confidence == trusted` ou `time_confidence == trusted`)
- e existe slot compativel futuro
- e o slot recomendado esta vivo: dentro de `48h` para aparecer como horario exato no hero

Comportamento:
- hero mostra servico + horario exato
- exibe profissional apenas se `staff_confidence == trusted`
- CTA pode reservar em 1 toque
- booking abre ja com servico, dia, slot e possivel profissional preenchidos

### Regras de confianca

Mapeadas diretamente ao que o app ja usa em `RetentionV1SafetyRails`.

| Sinal | Regra trusted |
| --- | --- |
| Servico | 2+ visitas concluidas do mesmo servico nos ultimos `180 dias` |
| Profissional | 2+ visitas do mesmo servico com a mesma profissional nos ultimos `120 dias`, com lideranca clara sobre a segunda colocada |
| Periodo do dia | 2+ visitas do mesmo servico no mesmo periodo nos ultimos `90 dias` |
| Horario exato | existe janela futura compativel e ela cai nas proximas `48h` |

### Regras de estado do usuario

Mapeadas ao `GrowthJourneyBuilder` atual.

| Tipo de servico | `dueSoon` | `dueNow` | `lapsed` |
| --- | --- | --- | --- |
| Barba | a partir do dia `11` | a partir do dia `15` | a partir do dia `25` |
| Corte | a partir do dia `23` | a partir do dia `30` | a partir do dia `45` |
| Unhas | a partir do dia `16` | a partir do dia `21` | a partir do dia `35` |
| Cor / mechas | a partir do dia `35` | a partir do dia `45` | a partir do dia `60` |
| Tratamento | a partir do dia `16` | a partir do dia `21` | a partir do dia `35` |
| Lashes / sobrancelhas | a partir do dia `16` | a partir do dia `21` | a partir do dia `35` |
| Geral | a partir do dia `23` | a partir do dia `30` | a partir do dia `45` |

### Prioridade do hero

1. Agendamento futuro confirmado ou pendente: mostrar hero de gestao do horario e esconder rebook forte.
2. `rewardAvailable`: mostrar hero de beneficio quando a recompensa estiver realmente disponivel agora.
3. `lapsed`
4. `dueNow`
5. `dueSoon`
6. `onTrack`

## 2. Estrutura da home, de cima para baixo

### 01. Greeting Rail
Quando aparece:
- sempre

Visual:
- topo limpo com `20` de padding horizontal e `16` de padding superior
- texto pequeno, quente, sem card
- nome da cliente em tom intimista, nunca promocional

Microcopy:
- `Bom dia, Ana`
- linha de apoio: `Seu proximo cuidado pode ficar leve hoje.`

CTA:
- sem CTA principal

Interacao:
- avatar abre perfil
- notificacoes entram como icone discreto, nunca concorrendo com o hero

### 02. Hero de retorno
Quando aparece:
- sempre, exceto quando a cliente ja tem agendamento futuro relevante; nesse caso vira hero de gestao

Visual:
- card dominante na primeira dobra
- altura aproximada de `320-360`
- raio `32`
- fundo em gradiente quente com brilho suave, sem cara de banner promocional
- headline grande, editorial, com 3 linhas maximas
- 1 CTA principal e 1 acao secundaria sutil

Microcopy:
- dinamica por estado, ver secao 3

CTA:
- Smart Mode com slot: `Quero esse horario`
- Smart Mode sem slot vivo: `Abrir agenda`
- Default Mode com ultimo servico confiavel: `Repetir ultimo servico`
- Default Mode sem historico confiavel: `Escolher meu cuidado`

Interacao:
- toque no CTA principal vai para confirmacao direta ou booking prefill
- toque no secundario abre lista de horarios
- scroll faz o CTA colar na base da tela como sticky bar

### 03. Smart Proof Row
Quando aparece:
- quando existirem pelo menos 2 provas reais entre: ultimo servico, ultima profissional confiavel, ultima visita, recompensa, slot recomendado

Visual:
- trilho horizontal de pills com fundo marfim
- altura `36-40`
- sem sombra forte
- serve para construir confianca, nao para virar menu

Microcopy:
- `Ultimo: corte em camadas`
- `Com Juliana`
- `Ha 29 dias`
- `Beneficio disponivel`
- `Qui, 18:30`

CTA:
- sem CTA verbal

Interacao:
- toque numa pill abre detalhe contextual
- a pill do horario faz scroll ate o card de horario ou abre agenda

### 04. Card de melhor horario
Quando aparece:
- Smart Mode
- ou quando existir `vacancyAlert` compativel com o servico recomendado

Visual:
- card compacto destacado logo abaixo do hero
- fundo claro com badge de horario grande
- layout 2 colunas: horario em destaque + motivo da escolha

Microcopy:
- titulo: `Esse horario combina com o seu ritmo`
- corpo: `Quinta, 18:30, com Juliana. Rapido de decidir e facil de cumprir.`

CTA:
- `Garantir esse horario`

Interacao:
- toque unico reserva
- swipe horizontal revela `+2 horarios parecidos`

### 05. Wallet de momentum
Quando aparece:
- `availableRewardsCount > 0`
- ou `visitsToNextTier <= 2`
- ou `cashbackBalance > 0`

Visual:
- card escuro, elegante, com arco de progresso dourado
- deve parecer "cartao de clube", nao "programa de pontos"

Microcopy:
- recompensa pronta: `Seu mimo ja pode entrar na proxima visita.`
- uma visita restante: `Falta so mais uma visita para subir de nivel.`
- cashback: `Seu saldo ja pode suavizar sua proxima reserva.`

CTA:
- `Usar na reserva`
- fallback: `Ver vantagens`

Interacao:
- toque abre wallet mantendo o booking draft vivo
- se houver recompensa aplicavel, CTA secundario do wallet injeta beneficio no booking

### 06. Feed editorial com booking embutido
Quando aparece:
- quando houver pelo menos 1 post com imagem

Visual:
- primeiro post sempre full-width e dominante
- abaixo, stack de 2 cards menores ou carrossel curto de resultados
- nada de feed infinito na home

Microcopy:
- header do modulo: `Inspire-se para a proxima vez`
- subheader: `Resultados reais do seu salao, ja conectados a reserva.`

CTA:
- dentro do post:
  - `Agendar esse estilo`
  - `Quero esse servico`
  - `Agendar com Juliana`

Interacao:
- tap abre post detalhado
- double tap curte
- swipe no antes/depois revela transformacao
- CTA abre booking com servico do post preselecionado

### 07. Trilho de profissionais
Quando aparece:
- quando `staff_confidence != trusted`
- ou quando o feed nao tiver posts suficientes ligados a profissionais

Visual:
- cards horizontais com foto, especialidade e proximo horario
- linguagem de "quem cuida de voce", nao catalogo frio

Microcopy:
- `Juliana, especialista em corte com movimento`
- `Encaixe hoje as 17:40`

CTA:
- `Ver agenda`

Interacao:
- toque abre agenda filtrada pela profissional

### 08. Fallback de servicos
Quando aparece:
- Default Mode
- ou quando nao houver slot confiavel para hero transacional

Visual:
- grid 2xN com servicos visuais, poucos por vez
- cards limpos, com imagem editorial e duracao/preco discretos

Microcopy:
- titulo: `Seu proximo cuidado, sem complicar`

CTA:
- `Escolher servico`

Interacao:
- toque abre booking com o servico escolhido

### 09. Sticky CTA
Quando aparece:
- assim que o hero sair 40% da viewport

Visual:
- barra fixa inferior com gradiente profundo
- altura `64`
- raio `22`
- sombra forte e quente

Microcopy:
- espelha a melhor acao disponivel:
  - `Quero esse horario`
  - `Reservar com beneficio`
  - `Repetir ultimo servico`

Interacao:
- 1 toque leva ao mesmo caminho do CTA principal do hero

## 3. Hero: 5 variacoes principais

### Hero `onTrack`
Quando usar:
- `userState == onTrack`
- sem recompensa disponivel

Tom:
- calmo, elegante, protetor

Visual:
- gradiente marfim -> cobre claro
- sem badge de urgencia

Copy:
- titulo: `Seu ritmo esta bonito. Se quiser, ja deixamos o proximo cuidado no lugar.`
- corpo smart: `Sua ultima ${lastService} com ${lastStaff} foi em ${lastVisitDate}. ${nextSlot} seria um jeito leve de manter esse resultado.`
- corpo default: `Seu ultimo cuidado ainda esta no tempo certo. Se quiser, ja da para encaminhar a proxima visita sem pensar em tudo de novo.`
- CTA: `Deixar reservado`

### Hero `dueSoon`
Quando usar:
- `userState == dueSoon`
- sem recompensa disponivel

Tom:
- antecipacao suave, sem pressao

Visual:
- champagne rosado com brilho lateral
- pill discreta: `Na hora certa`

Copy:
- titulo: `Seu momento de voltar esta chegando do jeito certo.`
- corpo smart: `${lastService} entra na janela ideal nos proximos dias. ${nextSlot} com ${lastStaff} ficou facil para voce.`
- corpo default: `Seu proximo retorno ja pode ficar encaminhado agora, antes de virar uma pendencia.`
- CTA: `Quero esse horario`

### Hero `dueNow`
Quando usar:
- `userState == dueNow`
- sem recompensa disponivel

Tom:
- decisivo, gostoso de agir

Visual:
- gradiente cobre profundo -> cacao
- contraste mais alto

Copy:
- titulo: `Agora e o melhor momento para repetir o que te faz bem.`
- corpo smart: `Ja esta na hora ideal de repetir ${lastService}. ${nextSlot} com ${lastStaff} esta livre e resolve isso em segundos.`
- corpo default: `Seu ultimo servico ja foi separado para voce voltar pelo caminho mais simples.`
- CTA: `Reservar agora`

### Hero `lapsed`
Quando usar:
- `userState == lapsed`
- sem recompensa disponivel

Tom:
- acolhimento com desejo de retorno, nunca culpa

Visual:
- fundo escuro premium, texto claro e quente
- sem vermelho de alerta

Copy:
- titulo: `Seu lugar aqui continua seu. Vamos trazer isso de volta com leveza.`
- corpo smart: `Ja faz ${daysSinceLastVisit} dias desde sua ultima ${lastService}. ${nextSlot} com ${lastStaff} e o caminho mais facil para voltar ao seu ritmo.`
- corpo default: `A gente nao vai fingir que sabe tudo sobre voce. So deixamos o melhor retorno possivel pronto para voce recomecar sem atrito.`
- CTA: `Voltar com facilidade`

### Hero `rewardAvailable`
Quando usar:
- `availableRewardsCount > 0`
- ou cashback aplicavel agora em reserva real

Tom:
- desejo, exclusividade, "isso e seu"

Visual:
- marfim luminoso com detalhe dourado
- selo premium pequeno: `Disponivel agora`

Copy:
- titulo: `Seu beneficio ja esta pronto para entrar na proxima visita.`
- corpo smart: `Voce pode usar isso em ${lastService}, e ${nextSlot} com ${lastStaff} ja deixa tudo encaixado.`
- corpo default: `Em vez de guardar sua vantagem escondida, a gente trouxe ela para perto da sua reserva.`
- CTA: `Usar meu beneficio`

## 4. Visual design

### Paleta base
Direcao: editorial quente, sofisticada, feminina sem estereotipo e sem roxo dominante.

| Token | Cor | Uso |
| --- | --- | --- |
| `ink` | `#231815` | texto principal e fundo premium escuro |
| `espresso` | `#4A2E2A` | profundidade, sticky CTA, estados noturnos |
| `copper` | `#C67449` | acento principal e CTA |
| `rosewood` | `#9C5B53` | apoio emocional, destaque secundario |
| `champagne` | `#F3D8C7` | brilho quente |
| `ivory` | `#FBF6F2` | fundo base |
| `blushMist` | `#F7ECE6` | superficies suaves |
| `goldSoft` | `#D6B06A` | loyalty e recompensa |

Uso recomendado no app:
- base clara: `ivory` + `blushMist`
- hero transacional: `espresso -> copper`
- reward: `ivory -> champagne -> goldSoft`
- evitar `glowSignature` como preset padrao desta experiencia; priorizar `softEditorial` ou `heritageDark`

### Tipografia
Objetivo: luxo legivel, nao revista exagerada.

Recomendacao:
- display: `Cormorant Garamond SemiBold`
- interface e corpo: `Plus Jakarta Sans`

Escala:
- hero title: `32/36`
- section title: `22/28`
- card title: `18/24`
- body: `15/22`
- label: `13/18`

Implementacao Flutter:
- adicionar fontes como assets em `pubspec.yaml`
- manter fallback seguro para `Georgia` e `sans-serif` apenas durante rollout

### Espacamento
Alinhar com `PremiumSpacing`.

Sistema:
- `4`, `8`, `12`, `16`, `20`, `24`, `32`, `40`
- padding horizontal de tela: `20`
- espacamento entre secoes: `24`
- respiro interno de card hero: `24-28`

### Cards
Padrao:
- raio normal: `28`
- raio hero: `32`
- borda: `1` com branco quente ou stroke suave
- sombra: quente, baixa e ampla

Tratamento visual:
- cards claros usam fundo `#FFFCFA`
- cards escuros usam brilho interno muito leve
- gradientes devem ter no maximo 3 stops
- jamais usar glassmorphism frio ou blur excessivo

### Botoes
Primary:
- altura `56`
- raio `20`
- gradiente `espresso -> copper`
- texto `17/700`
- sombra `0 10 24 rgba(74,46,42,0.22)`

Secondary:
- altura `48`
- raio `18`
- fundo transparente ou marfim
- borda suave

Disabled:
- sem opacidade lavada demais
- usar taupe dessaturado com texto ainda legivel

## 5. Feed profissional e envolvente

### Estrutura do modulo
- 1 card editorial principal `4:5`
- 1 stack inferior com 2 cards menores ou carrossel curto
- maximo de `3` posts na home

### Hierarquia de conteudo
1. Transformacoes ligadas ao `recommendedService`
2. Conteudo da `lastStaff` quando confiavel
3. Antes/depois acima de foto simples
4. Reels acima de foto simples quando tiverem servico relacionado
5. Engajamento so entra como desempate, nunca como criterio principal

### Card de post
- media dominante no topo
- etiqueta pequena: `Antes e depois`, `Video curto`, `Com Juliana`
- abaixo da media:
  - titulo do resultado
  - profissional
  - servico relacionado
  - preco e duracao discretos
  - CTA forte

### CTA dentro do post
- se houver servico ligado: `Agendar esse estilo`
- se houver profissional confiavel: `Agendar com Juliana`
- se o post for de inspiracao sem servico forte: `Quero algo assim`

### Interacoes
- tap abre detalhes do post em bottom sheet editorial
- double tap curte com burst elegante
- swipe horizontal troca imagens
- antes/depois pode usar divisor arrastavel com haptica leve no meio
- CTA abre booking com contexto carregado

## 6. Buttons: tato e premium

### Tamanho
- principal full width: `56h`
- principal inline: minimo `168w`
- secundario: `48h`
- chips acionaveis: `36h`

### Cores
- CTA principal sempre quente e profundo
- nunca usar azul corporativo ou roxo padrao
- urgencia usa contraste, nao vermelho gritante

### Animacao
Implementavel com `PressFeedback`.

Padrao:
- `pressedScale: 0.975`
- `pressedOpacity: 0.97`
- duracao `120-140ms`
- `HapticFeedback.selectionClick()` no down
- em confirmacao final usar `lightImpact`

### Copy
Curta e decidida:
- `Quero esse horario`
- `Reservar agora`
- `Garantir meu horario`
- `Usar meu beneficio`
- `Voltar com facilidade`

## 7. Decision logic

### Quando mostrar slot exato
- somente em Smart Mode
- slot compativel com duracao do servico
- slot nas proximas `48h`
- se houver profissional visivel, ela precisa estar `trusted`
- vacancy compatível pode furar fila e subir mesmo fora do ranking normal

### Quando cair para booking simples
- `time_confidence != trusted`
- nenhum slot nas proximas `48h`
- cliente esta em Default Mode
- slot existe, mas depende de profissional nao confiavel

### Quando esconder nome da profissional
- `staff_confidence != trusted`
- nome ausente
- empate real entre 2 profissionais no historico
- profissional nao aparece na agenda disponivel do slot sugerido

### Quando mostrar urgencia
- `dueSoon`: badge suave `Na hora certa`
- `dueNow`: linguagem direta no hero e CTA mais forte
- `lapsed`: mensagem de retorno, sem tom de culpa
- encaixe do dia: chip `Abriu agora`

### Quando nao personalizar
- sem historico valido
- ultimo atendimento muito antigo e sem servico ativo compativel
- dados contraditorios entre agenda e historico

Regra editorial:
- melhor parecer um pouco menos inteligente do que parecer falso

## 8. Camada emocional: microcopy

1. `Seu ritmo esta bonito.`
2. `Seu proximo cuidado pode ficar resolvido em segundos.`
3. `Seu lugar aqui continua seu.`
4. `A melhor versao da sua rotina cabe nesse horario.`
5. `Sem pressa, sem ruido, so o proximo passo certo.`
6. `A gente deixou isso simples para voce voltar quando quiser.`
7. `Seu beneficio nao precisa ficar escondido na carteira.`
8. `Esse horario parece ter sido feito para voce.`
9. `O resultado que voce gosta ja pode ficar encaminhado.`
10. `Seu momento de voltar chegou com leveza.`
11. `Ficou facil repetir o que te faz bem.`
12. `Tem um encaixe que combina com o seu ritmo.`
13. `Voce nao precisa recomecar tudo para reservar de novo.`
14. `Seu proximo horario ja pode nascer pronto.`
15. `Voltar aqui deve dar vontade, nao trabalho.`
16. `Seu cuidado favorito esta a um toque de distancia.`
17. `Tem dias em que decidir menos e o verdadeiro luxo.`
18. `Seu salao separou o caminho mais facil para voce.`

## 9. Delight moments

1. Hero entra com `AnimatedSwitcher` e leve subida de `12px`, como se a tela "respirasse" ao abrir.
2. Quando um slot exato surgir em tempo real, a pill do horario pulsa uma vez e dispara haptica leve.
3. No booking em 1 toque, o CTA se transforma no horario confirmado em vez de navegar para uma tela fria de sucesso.
4. No antes/depois, o divisor faz um pequeno `snap` no centro com feedback tatil.
5. Ao aplicar beneficio, o arco de loyalty percorre o cartao com brilho dourado e some em `600ms`.
6. Se a cliente repetir 3 vezes o mesmo servico, o hero usa uma linha de assinatura: `Seu corte ja virou sua marca.`

## 10. Booking flow

### Caso ideal: 1 toque
Condicao:
- Smart Mode
- slot exato disponivel
- servico confiavel

Fluxo:
1. Cliente toca `Quero esse horario`
2. App confirma instantaneamente
3. Tela mostra estado confirmado com opcao `Desfazer` por `8s`

Campos prefill:
- `serviceId`
- `serviceName`
- `initialDay`
- `initialSlot`
- `initialStaffMemberId` apenas se trusted
- beneficio aplicavel, se existir

Reducao de friccao:
- sem tela de escolha de servico
- sem grid mensal antes do slot
- sem pedir profissional quando nao precisa
- mesma tela, sem quebra emocional

### Fallback flow
Condicao:
- Default Mode
- ou horario exato indisponivel

Fluxo:
1. Servico ja vem selecionado, se confiavel
2. Tela abre em `proximos melhores dias`, nao no calendario vazio
3. Profissionais aparecem como sugestao, nao como obrigacao
4. Slots mais parecidos com o historico vem no topo
5. Confirmacao final mostra beneficio e resumo em linguagem curta

Reducao de friccao:
- manter ultimo servico carregado
- filtrar a agenda pelos 3 melhores dias primeiro
- destacar `sem preferencia` como opcao legitima
- reusar ultimo periodo favorito sem fixar horario falso

## 11. O que remover

- grid de atalhos competindo com o hero na primeira dobra
- banner promocional genérico acima do CTA principal
- carrosseis longos de servicos na home
- CTA de WhatsApp disputando o mesmo peso do CTA de reserva
- cards com 3 ou mais acoes fortes ao mesmo tempo
- texto genérico do tipo `Bem-vindo ao app`
- badges vermelhos de urgencia estilo e-commerce
- feed infinito sem ligacao com booking
- likes e comentarios com mais destaque que resultado, servico e CTA
- qualquer personalizacao com nome de profissional quando a confianca for fraca
- foto stock ou imagem sem contexto real do salao

## 12. Mapa de implementacao em Flutter

Arquivos mais naturais para esta evolucao:
- `apps/mobile/lib/src/features/retention_v1/application/retention_v1_builder.dart`
  - consolidar regras de `Default Mode`, `Smart Mode` e prioridade do hero
- `apps/mobile/lib/src/screens/premium_home_screen.dart`
  - reorganizar ordem da home e sticky CTA
- `apps/mobile/lib/src/features/retention_v1/presentation/widgets/retention_v1_home_block.dart`
  - trocar o bloco atual por hero realmente editorial
- `apps/mobile/lib/src/widgets/salon_feed_post_card.dart`
  - reforcar CTA de booking, antes/depois e hierarchy visual
- `apps/mobile/lib/src/widgets/press_feedback.dart`
  - padronizar microinteracoes dos botoes
- `apps/mobile/lib/src/theme/design_tokens.dart`
- `apps/mobile/lib/src/theme/tenant_theme.dart`
- `apps/mobile/lib/src/theme/salon_branding.dart`
  - travar paleta premium quente e evitar cara corporativa

## Critica honesta da solucao

### Onde pode falhar emocionalmente
- se a copy ficar "intima" sem base real, parece manipulacao
- se a recompensa aparecer cedo demais, o produto escorrega para desconto
- se toda visita virar urgencia, a cliente para de confiar

### Onde pode parecer fake
- citar profissional sem sinal trusted
- mostrar horario exato fora da janela viva
- usar frases muito poeticas em excesso sem prova concreta logo abaixo

### Como melhorar ainda mais
- adicionar score de recencia para saber quando o ultimo comportamento ja envelheceu demais
- medir taxa de conversao por copy de hero, nao apenas por cor ou layout
- usar aprendizado por segmento do salao para modular tom: unhas, cabelos, lashes, clinica estetica
- criar preview states dentro do app para testar as 5 variacoes com dados reais de exemplo

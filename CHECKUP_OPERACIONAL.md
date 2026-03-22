# Checkup Operacional

Roteiro de validação funcional do produto em ambiente local com Supabase remoto.

## Status técnico atual

- Painel web: compila e sobe sem erro com `npm run build`
- App cliente: `flutter analyze` sem issues
- App cliente: `flutter test` passando
- Supabase: migrations aplicadas até `0017`
- Push: function `send-vacancy-push` ativa no Supabase

## Pré-requisitos

Antes de testar os fluxos:

1. Suba o painel:
   ```bash
   cd "C:\Users\tsilv\Downloads\salon fun\apps\web"
   npm run dev
   ```
2. Gere e instale o APK de produção:
   ```bash
   cd "C:\Users\tsilv\Downloads\salon fun\apps\mobile"
   flutter build apk --release --dart-define-from-file=.env.production
   ```
3. Abra o app no celular.
4. Faça login no cliente.
5. Permita notificações no Android.

## Fluxo 1: Agendamento ponta a ponta

### Objetivo

Validar que o cliente agenda e o salão consegue operar esse horário no painel.

### Passos

1. No painel, cadastre pelo menos um serviço em `/dashboard/services`.
2. Em `/dashboard/team`, garanta que existe um profissional ativo com esse serviço.
3. Em `/dashboard/team`, confirme que a agenda semanal do profissional está aberta no dia do teste.
4. No app cliente:
   - abra o salão
   - escolha um serviço
   - escolha a data
   - escolha um profissional ou `qualquer profissional`
   - selecione um horário livre
   - confirme
5. Volte ao painel em `/dashboard/appointments`.

### Resultado esperado

- o agendamento aparece no painel com:
  - nome do cliente
  - serviço
  - profissional
  - data e hora
  - status `Pendente`

## Fluxo 2: Confirmação e conclusão do atendimento

### Objetivo

Validar o ciclo operacional do salão.

### Passos

1. No painel, em `/dashboard/appointments`, clique em `Confirmar`.
2. Verifique no app cliente se o histórico mostra o horário como confirmado.
3. Depois do horário passar, clique em `Marcar como atendido`.

### Resultado esperado

- o status muda para `Confirmado`
- depois muda para `Atendido`
- o cliente recebe aviso no app
- o histórico do cliente reflete o novo status

## Fluxo 3: Cancelamento pelo cliente com vaga liberada

### Objetivo

Validar desistência com motivo e abertura de vaga.

### Passos

1. No app cliente, abra o histórico.
2. Escolha um horário futuro.
3. Toque em desmarcar.
4. Informe o motivo.

### Resultado esperado

- o cancelamento é salvo
- o painel mostra:
  - quem cancelou
  - motivo
  - data do cancelamento
- o horário deixa de estar ocupado
- uma vaga liberada aparece para outros clientes do mesmo salão

## Fluxo 4: Promoções e planos

### Objetivo

Validar catálogo comercial do salão no app cliente.

### Passos

1. No painel, acesse `/dashboard/benefits`.
2. Crie uma promoção ativa.
3. Crie um plano mensal ativo.
4. No app cliente, atualize a home.

### Resultado esperado

- promoção e plano aparecem no app
- aparecem com título, descrição, valor e vigência
- ofertas fora da vigência deixam de aparecer para o cliente

## Fluxo 5: Programa de indicação

### Objetivo

Validar indicação com regra real.

### Passos

1. No painel, em `/dashboard/benefits`, ative o programa de indicação.
2. No app do cliente A, copie o código de indicação.
3. No app do cliente B:
   - crie conta
   - entre no salão
   - informe o código de indicação
4. Faça um agendamento com o cliente B.
5. No painel, depois do atendimento, marque como `Atendido`.

### Resultado esperado

- o painel registra:
  - cliente que indicou
  - cliente indicado
  - código usado
  - status da indicação
- antes da conclusão: `Pendente`
- depois da conclusão: `Validada`
- o cliente A vê a indicação no app

## Fluxo 6: Feed do salão

### Objetivo

Validar o feed interno com engajamento.

### Passos

1. No painel, acesse `/dashboard/feed`.
2. Publique uma foto ou galeria.
3. Opcionalmente vincule a publicação a um serviço.
4. No app cliente, abra a aba `Feed`.
5. Curta e comente.

### Resultado esperado

- o post aparece no app
- curtidas e comentários são persistidos
- o painel mostra os comentários recebidos
- se houver serviço vinculado, o post pode levar o cliente para agendamento

## Fluxo 7: Notificações no Android

### Objetivo

Validar push real no dispositivo.

### Passos

1. Instale o APK mais recente gerado com `.env.production`.
2. Abra o app e faça login.
3. Permita notificações.
4. Deixe o app em segundo plano.
5. No painel, execute uma ação que gere aviso:
   - nova promoção
   - atualização de plano
   - confirmação de horário
   - cancelamento pelo salão
   - conclusão de atendimento

### Resultado esperado

- a notificação aparece na bandeja do Android
- o aparelho toca com som padrão
- ao tocar nela, abre a tela de aviso do app
- o sino dentro do app também mostra o aviso

## Fluxo 8: Histórico de avisos

### Objetivo

Validar o histórico de comunicação.

### Passos

1. No painel, acesse `/dashboard/notifications`.
2. Filtre por categoria, público e período.
3. Exporte o CSV.
4. No app cliente, abra o sino.
5. Arquive um aviso.

### Resultado esperado

- o painel lista avisos enviados com filtros
- o CSV baixa corretamente
- o app mostra avisos novos e vistos
- o cliente pode apagar os avisos da própria central

## Fluxos que merecem atenção extra

- Push no Android físico:
  depende de permissão ativa, token registrado e APK atualizado
- Indicação:
  precisa de dois clientes reais para validação completa
- Conclusão de atendimento:
  deve ser retestada após a correção da migration `0017`

## Critério final de aceite

O sistema pode ser considerado operacionalmente consistente quando:

- o cliente consegue agendar sem conflito
- o salão consegue confirmar, cancelar e concluir
- promoções aparecem e somem conforme vigência
- indicação muda de pendente para validada
- feed publica e recebe interação
- o Android recebe e abre notificações reais

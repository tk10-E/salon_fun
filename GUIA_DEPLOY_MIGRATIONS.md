# Guia de Deploy de Migrations

Fluxo padrão para publicar migrations do Supabase com segurança, sem prejudicar o app e sem depender de um único caminho da CLI.

Data de referência deste guia: 22 de março de 2026.

## Objetivo

- manter o schema remoto alinhado com `supabase/migrations`
- evitar mudanças manuais soltas em produção
- ter um fallback seguro quando `supabase db push` falhar no pooler

## Regra principal

Toda mudança de banco deve nascer em migration versionada.

Não faça alteração direto no painel SQL do Supabase como caminho normal.

## Fluxo padrão

1. Criar a migration em `supabase/migrations`.
2. Revisar o impacto:
   - novas tabelas
   - novas colunas
   - índices
   - RLS
   - funções/RPCs
   - compatibilidade com o app atual
3. Validar o código que depende dela:
   - `apps/web`: `npm run lint` e `npm run build`
   - `apps/mobile`: `flutter analyze` e `flutter test`
4. Ver o que seria aplicado:

```bash
supabase db push --dry-run
```

5. Aplicar no remoto pelo caminho normal:

```bash
supabase db push
```

6. Confirmar se entrou:
   - migration registrada
   - objetos realmente criados no banco
   - app compilando e funcionando

## Fallback seguro quando `supabase db push` falhar

Se a CLI falhar no `cli_login_postgres`, `pooler` ou `Circuit breaker open`, use esta ordem:

1. Refazer o link do projeto:

```bash
supabase link --project-ref <project-ref>
```

2. Tentar novamente:

```bash
supabase db push
```

3. Se continuar falhando, usar conexão direta com senha do banco:

```bash
supabase db push --password "<db-password>"
```

ou

```bash
supabase db push --db-url "postgresql://postgres:<senha>@db.<project-ref>.supabase.co:5432/postgres"
```

Esse caminho evita depender do pooler quando ele estiver instável.

## Como validar o banco remoto

Primeira checagem:

```bash
supabase migration list
```

Se a CLI estiver ruim para leitura de migrations, use a Management API da própria Supabase para conferir o histórico:

```bash
ACCESS_TOKEN=$(cat ~/.supabase/access-token)

curl -sS -X POST "https://api.supabase.com/v1/projects/<project-ref>/database/query" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"select version from supabase_migrations.schema_migrations order by version desc limit 10;","read_only":true}'
```

Depois confirme o objeto criado. Exemplos:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'customers';
```

```sql
select table_name
from information_schema.tables
where table_schema = 'public';
```

```sql
select proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';
```

## Fluxo recomendado de release

1. Subir migration.
2. Confirmar schema remoto.
3. Só depois publicar web/app que dependem dela.
4. Testar o fluxo real em produção.

## O que evitar

- aplicar SQL manual sem migration versionada
- publicar app antes de o schema remoto estar pronto
- confiar só no sucesso do comando sem validar o banco
- editar a tabela de histórico de migrations manualmente, exceto em recuperação bem controlada

## Estado atual deste projeto

Em 22 de março de 2026, o repositório já contém migrations até `0040`.

As migrations `0035` e `0036` já foram confirmadas no remoto do projeto `igfitysewvsguvoisytr`, mesmo com o `supabase db push` apresentando falha intermitente no pooler.

No momento, o lote `0037` a `0040` foi preparado no código, mas permanece pendente de aplicação intencionalmente.

Pacote operacional deste lote:

- [PACOTE_RELEASE_0037_0040.md](/mnt/c/Users/tsilv/Downloads/salon%20fun/PACOTE_RELEASE_0037_0040.md)
- [0037_0040_post_deploy_verification.sql](/mnt/c/Users/tsilv/Downloads/salon%20fun/supabase/post_deploy_checks/0037_0040_post_deploy_verification.sql)

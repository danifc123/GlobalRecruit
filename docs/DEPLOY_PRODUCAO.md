# Subir para produção e entregar ao cliente

Checklist do que fazer no Railway depois das entregas de **importação da
planilha** (PR #15), **tradução automática PT-BR** (PR #16) e
**arquivamento no OpenSpec** (PR #17), que já estão na `main`.

Estado validado na `main` antes do merge: 121 testes do backend (pytest),
29 testes do frontend (vitest), `ng build` e `npm run lint` passando.

> ⚠️ **Urgente se o Railway faz deploy automático da `main`:** o backend novo
> espera as colunas das migrations `0007` e `0008`. Até `alembic upgrade head`
> rodar no banco de produção, as telas de vagas podem dar erro 500. Faça o
> passo 2 primeiro.

## 1. Variáveis de ambiente do serviço backend (Railway → serviço → Variables)

| Variável | Valor | Novo? |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://...` do Postgres do Railway (trocar `postgresql://` por `postgresql+asyncpg://`) | já existia |
| `JWT_SECRET` | segredo forte (`python -c "import secrets; print(secrets.token_urlsafe(64))"`) | já existia |
| `CORS_ORIGINS` | `https://front-production-dac0.up.railway.app` (ou o domínio final do cliente) | já existia |
| `ENVIRONMENT` | `production` | já existia |
| `DEEPL_API_KEY` | chave da conta DeepL **do cliente** (opcional: vazio = sem tradução, o sistema funciona normalmente) | **novo** |
| `DEEPL_API_URL` | `https://api-free.deepl.com` (plano Free) ou `https://api.deepl.com` (Pro) | **novo** |

## 2. Migrations do banco (0007 e 0008)

O `Dockerfile` não roda migration sozinho. Duas opções:

- **Recomendado (fica automático):** Railway → serviço backend → Settings →
  Deploy → **Pre-deploy Command** = `alembic upgrade head`. Depois clique em
  *Redeploy*.
- **Manual, uma vez:** com a CLI do Railway logada no projeto, dentro de
  `backend/`:

  ```bash
  railway run alembic upgrade head
  ```

Conferir: `GET /health` responde e a tela de Vagas abre sem erro.

## 3. Primeira tradução das vagas (só se configurou o DeepL)

Vagas novas e vagas alteradas por importação são traduzidas sozinhas em
segundo plano. Para traduzir de uma vez as vagas que já estavam no banco:

```bash
railway run python -m app.traduzir_vagas
```

## 4. Frontend

Nenhuma variável nova. A URL da API fica em
`globalRecruit/src/environments/environment.prod.ts`. Se o backend mudar de
domínio (ex.: projeto recriado na conta do cliente), atualize `apiUrl` ali,
faça commit e redeploy do serviço do front.

## 5. Vincular as contas do cliente

**Infraestrutura (para o cliente ser o dono e pagar):**

1. **Railway:** convidar o cliente para o workspace ou transferir o projeto
   para o workspace dele (Project Settings → Transfer project). Se ele
   recriar o projeto do zero, refaça os passos 1–4 e atualize
   `apiUrl` / `CORS_ORIGINS`.
2. **DeepL:** o cliente cria a conta de API em <https://www.deepl.com/pro-api>,
   gera a chave e cola em `DEEPL_API_KEY` direto no Railway. A chave nunca
   vai para o Git nem por chat.
3. **GitHub:** se o deploy passar a sair de um repositório dele, conectar o
   repositório no serviço (Settings → Source) apontando para a branch `main`.

**Usuários no sistema:**

1. Primeiro admin (só se o banco de produção for novo):
   `railway run python -m app.seed_admin` (pede email e senha no terminal).
2. Logado como admin: **Projetos** → criar o projeto parceiro
   (ex.: "DS Recruitment Solutions").
3. **Usuários** → criar a conta de cada pessoa do cliente: `admin` para quem
   gerencia, `recruiter` para recrutador, vinculando o recrutador aos
   projetos que ele pode ver.
4. **Vagas ativas → Importar planilha** → escolher o projeto, enviar o
   `.xlsx` da "Recruiter View", conferir a pré-visualização e confirmar.
   Reimportar a planilha depois só atualiza as vagas, não duplica.

## Mapeamentos da planilha (para explicar ao cliente)

- **Status:** OPEN → Open · CLOSE/CLOSED → Closed · ON-HOLD/HOLD → On-Hold
- **Priority:** Urgent → High · Active → Medium · Low priority → Low
- Vagas que saem da planilha **não são apagadas** do sistema.

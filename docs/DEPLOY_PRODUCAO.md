# Deploy em produção — Neon + Render + Vercel

| Parte | Onde | O que é |
|---|---|---|
| Banco | **Neon** (Postgres) | só a connection string |
| Backend (FastAPI) | **Render** — Web Service | pasta `backend/` |
| Frontend (Angular) | **Vercel** | pasta `globalRecruit/` |

> 🔒 A connection string do Neon contém a senha do banco. Ela só vai no
> painel do Render (variável `DATABASE_URL`) e no `.env` local — **nunca** no
> Git nem em chat. Se ela já vazou, troque a senha no Neon (Roles → Reset
> password) e atualize no Render.

## 1. Neon (banco)

Neon → projeto → **Connect** → copiar a connection string. Pode colar
exatamente como o Neon mostra
(`postgresql://...neon.tech/neondb?sslmode=require&channel_binding=require`):
o backend converte sozinho para o formato do driver (`postgresql+asyncpg://...?ssl=require`).

Recomendado: desligar a opção **Connection pooling** no Neon antes de copiar
(o host fica sem `-pooler`). Funciona com pooler também, mas a conexão
direta evita qualquer surpresa com prepared statements do asyncpg.

As tabelas são criadas automaticamente no primeiro deploy do backend
(`alembic upgrade head` roda antes do servidor subir — ver `backend/Dockerfile`).

## 2. Render (backend)

Render → **New → Web Service** → conectar o repositório `danifc123/GlobalRecruit`.

| Campo | Valor |
|---|---|
| Branch | `main` |
| Root Directory | `backend` |
| Runtime / Language | **Docker** (usa o `backend/Dockerfile`) |
| Health Check Path | `/health` |

Se preferir o runtime **Python** em vez de Docker:
Build Command `pip install -r requirements.txt` e
Start Command `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

### Variáveis de ambiente (Render → serviço → Environment)

| Variável | Valor | Obrigatória |
|---|---|---|
| `DATABASE_URL` | connection string do Neon (passo 1) | ✅ |
| `JWT_SECRET` | texto aleatório longo — gerar com `python -c "import secrets; print(secrets.token_urlsafe(64))"` (ou botão *Generate* do Render) | ✅ |
| `ENVIRONMENT` | `production` | ✅ |
| `CORS_ORIGINS` | URL do front na Vercel, **sem barra no final**, ex.: `https://globalrecruit.vercel.app`. Mais de uma: separar por vírgula | ✅ |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` (padrão) | opcional |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` (padrão) | opcional |
| `JWT_ALGORITHM` | `HS256` (padrão) | opcional |
| `DEEPL_API_KEY` | chave da API DeepL (tradução PT-BR das vagas). Vazio = sem tradução, resto funciona | opcional |
| `DEEPL_API_URL` | `https://api-free.deepl.com` (Free) ou `https://api.deepl.com` (Pro) | opcional |

`PORT` **não** precisa criar — o Render injeta sozinho.

Conferir depois do deploy: abrir `https://<seu-backend>.onrender.com/health`
→ deve responder `{"status":"ok"}`. (No plano grátis o primeiro acesso depois
de um tempo parado demora ~1 min: o serviço "acorda".)

## 3. Vercel (frontend)

Vercel → **Add New → Project** → importar `danifc123/GlobalRecruit`.

| Campo | Valor |
|---|---|
| Root Directory | `globalRecruit` |
| Framework Preset | **Other** (o `globalRecruit/vercel.json` já define build, saída e rotas) |
| Build / Output / Install | deixar em branco (vem do `vercel.json`) |
| Environment Variables | **nenhuma** |

O front é publicado como site estático (`dist/globalRecruit/browser`), com
todas as rotas caindo no `index.csr.html` — por isso F5 em `/vagas-ativas/123`
não dá 404.

**A URL do backend fica no código**, não em variável da Vercel:
`globalRecruit/src/environments/environment.prod.ts` → `apiUrl` =
`https://<seu-backend>.onrender.com/api`. Trocou o backend de lugar → editar
essa linha, commit na `main` e a Vercel republica sozinha.

## 4. Ordem certa

1. Render com as variáveis (pode pôr `CORS_ORIGINS` provisório) → deploy → `/health` ok.
2. `apiUrl` do `environment.prod.ts` apontando pro Render → commit na `main`.
3. Vercel → deploy → pegar a URL final.
4. Voltar no Render e acertar `CORS_ORIGINS` com a URL exata da Vercel → *Save* (redeploya).

Sintoma clássico de `CORS_ORIGINS` errado: o login no site dá "erro de
conexão", mas o `/health` do backend abre normal no navegador.

## 5. Primeiro acesso e contas do cliente

O plano grátis do Render não tem terminal, então o primeiro admin é criado
**do seu PC**, apontando para o banco do Neon:

```powershell
cd backend
.venv\Scripts\activate
$env:DATABASE_URL = "<connection string do Neon>"
python -m app.seed_admin
```

(`seed_admin` pede email e senha no terminal. Sem o `$env:` ele usaria o
banco local do `.env`.) Se o DeepL estiver configurado, o mesmo vale para
traduzir de uma vez as vagas já existentes: `python -m app.traduzir_vagas`.

Depois, logado no site como admin:

1. **Projetos** → criar o projeto parceiro (ex.: "DS Recruitment Solutions").
2. **Usuários** → criar a conta de cada pessoa do cliente — `admin` para quem
   gerencia, `recruiter` para recrutador, vinculando o recrutador ao projeto.
3. **Vagas ativas → Importar planilha** → escolher o projeto, enviar o `.xlsx`
   da "Recruiter View", conferir a pré-visualização e confirmar.
   Reimportar depois só atualiza as vagas, não duplica.

### Mapeamentos da planilha (para explicar ao cliente)

- **Status:** OPEN → Open · CLOSE/CLOSED → Closed · ON-HOLD/HOLD → On-Hold
- **Priority:** Urgent → High · Active → Medium · Low priority → Low
- Vagas que saem da planilha **não são apagadas** do sistema.

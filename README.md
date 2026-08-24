# GlobalRecruit

**Engenheiro de Software:** Daniel Faria

![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB?logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0%20async-D71F00)
![JWT](https://img.shields.io/badge/Auth-JWT%20%2B%20bcrypt-6E56CF)
![Docker](https://img.shields.io/badge/Docker-Postgres-2496ED?logo=docker&logoColor=white)

Sistema de recrutamento para gestão de vagas, candidatos e pipeline de seleção,
com painel web em Angular e API própria em FastAPI.

**Objetivo:** permitir que recrutadores e administradores abram vagas, recebam
candidatos, movam cada um pelas etapas do processo seletivo (triagem →
entrevista → proposta → contratado/rejeitado) e acompanhem tudo isso num
dashboard — com escopo de dados por projeto parceiro para quem tem papel de
recrutador.

## Sumário

- [Arquitetura](#arquitetura)
- [Domínio](#domínio)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como rodar](#como-rodar)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Rotas REST expostas pelo backend](#rotas-rest-expostas-pelo-backend)
- [Autenticação, papéis e segurança](#autenticação-papéis-e-segurança)
- [Testes](#testes)
- [Convenções de clean code do projeto](#convenções-de-clean-code-do-projeto)

---

## Arquitetura

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/arquitetura-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/arquitetura-light.svg">
  <img src="docs/arquitetura-dark.svg" alt="Diagrama de arquitetura do GlobalRecruit: o Angular Web App autentica via JWT e fala REST com o Backend FastAPI, que valida o token, aplica rate limit e headers de segurança, e persiste tudo no PostgreSQL (via Docker) usando SQLAlchemy async. O Alembic aplica as migrations de schema diretamente no banco, fora do processo do backend." width="100%">
</picture>

| Camada | Tecnologia | Papel |
|---|---|---|
| Frontend | Angular 21 (standalone components) | Único cliente da API — telas de vagas, pipeline, banco de talentos, dashboard e administração |
| Autenticação | JWT (access + refresh) | Login próprio do sistema, sem IdP externo — guard + interceptor no Angular anexam o token em toda chamada |
| Backend | FastAPI + Uvicorn | REST API única — validação de token, regra de negócio, escopo de dado por recrutador |
| Banco | PostgreSQL 16 (Docker Compose) | Único banco do sistema — usuários, vagas, candidatos, pipeline, projetos parceiros |
| Migrations | Alembic | Roda via CLI, fora do processo do backend — nunca `create_all` automático |

Um único banco, uma única API — não há orquestração de IA, fila de mensagens
ou serviço externo nesta versão do projeto: o backend fala REST com o
frontend e SQL com o Postgres, e é só isso.

## Domínio

| Entidade | Campos-chave | Observação |
|---|---|---|
| `User` | `role` (`admin` / `recruiter` / `developer`) | Recrutador é vinculado a N projetos parceiros (`user_projetos_parceiros`) — só enxerga dado desses projetos |
| `Vaga` | `status` (`aberta` / `pausada` / `fechada`), `prioridade` (`baixa` / `media` / `alta`) | Pertence a um projeto parceiro |
| `Candidato` | vinculado a uma `Vaga` | Histórico de estágio fica em `PipelineStage` |
| `PipelineStage` | `estagio` (`triagem` → `entrevista` → `proposta` → `contratado` / `rejeitado`) | Uma linha por transição — dá o histórico completo do candidato na vaga |
| `ProjetoParceiro` | `status` (`ativo` / ...) | Unidade de escopo: todo dado de vaga/candidato pertence a um projeto, e recrutador só vê os seus |

**Papéis:**

| Papel | Acesso |
|---|---|
| `developer` | Irrestrito — mesmo espírito de "acesso total" para quem mantém o sistema |
| `admin` | Gestão de usuários e projetos parceiros, visão completa de vagas/candidatos |
| `recruiter` | Só os projetos parceiros aos quais está vinculado (`scoped_projeto_ids`) |

## Estrutura do projeto

Camadas do backend, dependência sempre numa direção só: `api/` (HTTP) →
`core/`/`schemas/` (regra de negócio e contrato) → `db/` (persistência).
Nenhuma rota faz SQL direto — sempre via SQLAlchemy async, sessão injetada
por `Depends(get_db)`.

### Backend

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/arvore-backend-resumo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/arvore-backend-resumo-light.svg">
  <img src="docs/arvore-backend-resumo-dark.svg" alt="Árvore de diretórios do backend (backend/app/): main.py monta o FastAPI (CORS, rate limit, security headers, api_router); api/ tem as rotas REST; core/ tem config, security e deps; db/ tem os models SQLAlchemy; middleware/ tem rate limit e security headers; schemas/ tem os contratos Pydantic; seed_admin.py cria o primeiro usuário admin." width="100%">
</picture>

### Frontend

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/arvore-frontend-resumo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/arvore-frontend-resumo-light.svg">
  <img src="docs/arvore-frontend-resumo-dark.svg" alt="Árvore de diretórios do frontend (globalRecruit/src/app/): core/ tem AuthService, guard, interceptor e JWT; features/ tem as telas (dashboard, vagas, pipeline, banco de talentos, projetos parceiros, admin, conta); layout/ tem shell, sidebar e bottom-nav; shared/ tem componentes e utilitários reaproveitados." width="100%">
</picture>

*(gerado por [`docs/gerar_arvore.py`](docs/gerar_arvore.py) — editar as tuplas `BACKEND_RESUMO`/`FRONTEND_RESUMO` e rodar `python docs/gerar_arvore.py` de novo quando a estrutura de pastas mudar)*

## Como rodar

Sempre nessa ordem: **Docker → Backend → Frontend.** Se pular o Docker, o
backend sobe mas o login dá erro 500 (ele fala com o banco).

### Pré-requisitos

- Python 3.12+
- Node.js 20+ / npm
- Docker Desktop

### 1. Banco de dados (Docker)

O `docker-compose.yml` fica em `backend/`. Suba o Postgres:

```bash
cd backend
docker compose up -d
```

Confirme que subiu:

```bash
docker ps
```

Precisa aparecer uma linha `backend-db-1` com status `Up`/`healthy`. A porta
exposta é a **5434** (não 5432) — o `.env.example` já vem configurado assim,
para não colidir com um Postgres nativo do sistema operacional na 5432.

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/Mac

pip install -r requirements.txt
copy .env.example .env          # Windows — edite o JWT_SECRET
# cp .env.example .env          # Linux/Mac

alembic upgrade head
uvicorn app.main:app --reload --port 8001
```

Espera aparecer `Application startup complete.` Rodar **de dentro da pasta
`backend`** é obrigatório — de fora, dá `ModuleNotFoundError: No module
named 'app'`.

Primeiro usuário: crie um admin com o script de seed:

```bash
python -m app.seed_admin
```

### 3. Frontend

```bash
cd globalRecruit
npm install
ng serve
```

Espera aparecer `➜ Local: http://localhost:4200/`. Abra
[http://localhost:4200](http://localhost:4200) e faça login.

## Variáveis de ambiente

`backend/.env` (ver `.env.example` completo):

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql+asyncpg://user:senha@host:porta/db` — porta `5434` no Compose local |
| `JWT_SECRET` | ✅ | Gerar com `python -c "import secrets; print(secrets.token_urlsafe(64))"` — nunca commitar |
| `JWT_ALGORITHM` | | `HS256` por padrão |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | | `30` por padrão |
| `REFRESH_TOKEN_EXPIRE_DAYS` | | `7` por padrão |
| `CORS_ORIGINS` | | Origem exata do frontend — nunca `*` |
| `ENVIRONMENT` | | `development` ou `production` (esconde `/docs`, `/redoc`, `/openapi.json` em produção) |

## Rotas REST expostas pelo backend

Todas sob o prefixo `/api`:

| Prefixo | O que expõe |
|---|---|
| `/api/auth/*` | `login` (rate limit 5/min), `refresh` (10/min), `me` |
| `/api/vagas/*` | Listagem paginada, criação, detalhe, atualização, mudança de `status` e de `prioridade` |
| `/api/candidatos/*` | Listagem, detalhe, criação, mudança de estágio no pipeline |
| `/api/projetos-parceiros/*` | Listagem e criação |
| `/api/dashboard/stats` | Estatísticas agregadas para o painel |
| `/api/users/*` | CRUD de usuário — restrito a `role=admin` |

Toda rota autenticada depende de `get_current_user` (valida o Bearer JWT) e,
quando precisa restringir por papel, de `require_roles(...)`
([`deps.py`](backend/app/core/deps.py)) — `developer` sempre passa,
independente de quais papéis a rota pediu.

## Autenticação, papéis e segurança

| Proteção | Como |
|---|---|
| Senha | `bcrypt`, nunca texto puro — bytes acima de 72 são rejeitados explicitamente em vez de truncados em silêncio |
| Sessão | JWT de acesso (30 min) + refresh (7 dias), `HS256`, assinado com `JWT_SECRET` |
| Rate limit | `slowapi` — `/auth/login` 5/min, `/auth/refresh` 10/min, por IP |
| Headers de segurança | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` ([`security_headers.py`](backend/app/middleware/security_headers.py)) |
| CORS | Lista explícita de origens (`CORS_ORIGINS`) — nunca `*` |
| Escopo por recrutador | `scoped_projeto_ids()` filtra toda query de vaga/candidato pelos projetos do usuário logado quando `role=recruiter` |
| Docs da API | `/docs`, `/redoc`, `/openapi.json` desabilitados quando `ENVIRONMENT=production` |

## Testes

Não há suíte de testes automatizados neste momento — nem `pytest` no
backend (`requirements.txt` não inclui), nem specs reais no frontend (só o
`app.spec.ts` padrão gerado pelo Angular CLI, sem cobertura de feature).
Validação hoje é manual: `ng build` + navegar nas telas, e checar a resposta
das rotas via `/docs` (Swagger, disponível fora de produção).

## Convenções de clean code do projeto

- **Camadas de dependência única direção:** `api/` só traduz HTTP ⇄ chamada
  de serviço; regra de negócio e checagem de papel ficam em `core/deps.py`
  e nos próprios routers — nunca `if role == "x"` espalhado pela API.
- **Escopo de dado nunca decidido pelo frontend:** o backend sempre deriva
  os projetos visíveis a partir do usuário autenticado no token
  (`scoped_projeto_ids`), nunca de um parâmetro que o cliente possa forjar.
- **Migration é sempre via Alembic:** nenhuma tabela é criada com
  `Base.metadata.create_all` em runtime — toda mudança de schema é uma
  revisão versionada em `backend/alembic/versions/`.
- **Mensagem de erro não vaza informação:** `/auth/login` devolve o mesmo
  erro genérico para e-mail inexistente e senha errada, para não permitir
  enumeração de contas.

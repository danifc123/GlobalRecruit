# Como iniciar o GlobalRecruit

Três partes, nesta ordem: banco de dados (Docker) → backend (porta 8001) → frontend (`ng serve`).

## 1. Banco de dados (Docker)

```powershell
cd backend
docker compose up -d
```

Sobe um Postgres em `localhost:5434` (a 5432 já está ocupada por um Postgres nativo do Windows nesta máquina). Só precisa rodar de novo se o container tiver sido parado — `docker ps` mostra se já está de pé.

## 2. Backend (FastAPI)

```powershell
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8001
```

- O `.venv` já existe em `backend/.venv`. Se for uma máquina nova sem ele: `python -m venv .venv` e depois `pip install -r requirements.txt`.
- Precisa de um `backend/.env` (copie de `.env.example` e preencha `JWT_SECRET`) — sem ele o backend não sobe.
- Fica escutando em `http://localhost:8001`.

## 3. Frontend (Angular)

```powershell
cd globalRecruit
ng serve
```

- Abre em `http://localhost:4200`.
- Se for a primeira vez ou tiver mudado dependências: `npm install` antes.

## Checagem rápida

```powershell
netstat -ano | findstr ":8001 :4200"
```

Se as duas portas aparecerem como `LISTENING`, está tudo de pé.

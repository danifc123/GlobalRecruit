FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# não roda como root em produção
RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
# forma shell (não exec) de propósito -- plataformas tipo Render/Railway
# injetam $PORT em runtime, e só a forma shell expande variável de ambiente;
# ${PORT:-8000} cai pra 8000 rodando local sem essa variável definida.
# `alembic upgrade head` antes de subir: aplica migration pendente a cada
# deploy (idempotente -- sem migration nova não faz nada), já que o plano
# grátis do Render não tem shell nem pre-deploy command. `seed_admin --env`
# cria o primeiro admin a partir de ADMIN_EMAIL/ADMIN_PASSWORD, se definidas
CMD alembic upgrade head && python -m app.seed_admin --env && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

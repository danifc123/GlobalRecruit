FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# não roda como root em produção
RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
# forma shell (não exec) de propósito -- plataformas tipo Railway injetam
# $PORT em runtime, e só a forma shell expande variável de ambiente;
# ${PORT:-8000} cai pra 8000 rodando local sem essa variável definida
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

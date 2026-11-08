"""Cria o primeiro usuário admin.

Dois jeitos:

- Interativo (no seu PC): `python -m app.seed_admin` — pede email e senha.
- Automático (no deploy): `python -m app.seed_admin --env` — lê as variáveis
  ADMIN_EMAIL e ADMIN_PASSWORD. Sem elas, não faz nada. Se o email já existe,
  também não faz nada (nunca troca senha de usuário existente). Roda a cada
  boot do container (ver Dockerfile), por isso precisa ser idempotente.

Não existe endpoint público de registro de propósito — criar conta é ação
administrativa (evita qualquer um se auto-cadastrar como admin/recruiter).
"""

import asyncio
import getpass
import os
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db.base import async_session_factory
from app.db.models.user import Role, User

SENHA_MINIMA = 8


async def criar_admin(email: str, password: str) -> bool:
    """Cria o admin. Devolve False se o email já existia (nada muda)."""
    email = email.strip().lower()
    async with async_session_factory() as db:
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none() is not None:
            return False
        db.add(User(email=email, hashed_password=hash_password(password), role=Role.ADMIN))
        await db.commit()
    return True


async def main_env() -> None:
    email = os.environ.get("ADMIN_EMAIL", "").strip()
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not email or not password:
        return
    if len(password) < SENHA_MINIMA:
        # não derruba o deploy por isso — só avisa no log e segue sem criar
        print(f"[seed_admin] ADMIN_PASSWORD precisa ter pelo menos {SENHA_MINIMA} caracteres; admin NÃO criado.")
        return
    if await criar_admin(email, password):
        print(f"[seed_admin] Admin {email.lower()} criado.")
    else:
        print(f"[seed_admin] Admin {email.lower()} já existe; nada a fazer.")


async def main_interativo() -> None:
    email = input("Email do admin: ")
    password = getpass.getpass(f"Senha (mín. {SENHA_MINIMA} caracteres): ")
    if len(password) < SENHA_MINIMA:
        raise SystemExit(f"Senha precisa ter pelo menos {SENHA_MINIMA} caracteres.")
    if not await criar_admin(email, password):
        raise SystemExit(f"Já existe um usuário com o email {email.strip().lower()}.")
    print(f"Admin {email.strip().lower()} criado com sucesso.")


if __name__ == "__main__":
    asyncio.run(main_env() if "--env" in sys.argv else main_interativo())

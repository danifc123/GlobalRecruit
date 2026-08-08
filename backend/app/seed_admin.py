"""Cria o primeiro usuário admin. Rodar uma vez: python -m app.seed_admin

Não existe endpoint público de registro de propósito — criar conta é ação
administrativa (evita qualquer um se auto-cadastrar como admin/recruiter).
"""

import asyncio
import getpass

from sqlalchemy import select

from app.core.security import hash_password
from app.db.base import async_session_factory
from app.db.models.user import Role, User


async def main() -> None:
    email = input("Email do admin: ").strip().lower()
    password = getpass.getpass("Senha (mín. 8 caracteres): ")
    if len(password) < 8:
        raise SystemExit("Senha precisa ter pelo menos 8 caracteres.")

    async with async_session_factory() as db:
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none() is not None:
            raise SystemExit(f"Já existe um usuário com o email {email}.")

        db.add(User(email=email, hashed_password=hash_password(password), role=Role.ADMIN))
        await db.commit()

    print(f"Admin {email} criado com sucesso.")


if __name__ == "__main__":
    asyncio.run(main())

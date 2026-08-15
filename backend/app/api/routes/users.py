from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db, require_roles
from app.core.security import hash_password
from app.db.models.projeto_parceiro import ProjetoParceiro
from app.db.models.user import Role, User
from app.schemas.user import UserCreate, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut], dependencies=[Depends(require_roles(Role.ADMIN))])
async def list_users(db: AsyncSession = Depends(get_db)) -> list[User]:
    stmt = select(User).options(selectinload(User.projetos)).order_by(User.email)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post(
    "",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(Role.ADMIN))],
)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)) -> User:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já cadastrado")

    projetos: list[ProjetoParceiro] = []
    if payload.project_ids:
        result = await db.execute(select(ProjetoParceiro).where(ProjetoParceiro.id.in_(payload.project_ids)))
        projetos = list(result.scalars().all())
        if len(projetos) != len(set(payload.project_ids)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Um ou mais projetos não encontrados")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        projetos=projetos,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user, attribute_names=["projetos"])
    return user

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_db, require_roles
from app.core.security import hash_password, verify_password
from app.db.models.projeto_parceiro import ProjetoParceiro
from app.db.models.user import Role, User
from app.schemas.auth import PasswordChange, ProfileUpdate
from app.schemas.user import UserCreate, UserOut, UserProjetosUpdate, UserStatusUpdate

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


@router.patch("/{user_id}/status", response_model=UserOut)
async def update_user_status(
    user_id: uuid.UUID,
    payload: UserStatusUpdate,
    current_user: User = Depends(require_roles(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> User:
    # ninguém desativa a própria conta — evita o admin se trancar pra fora
    # do sistema sem ter mais ninguém pra reverter
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Você não pode desativar sua própria conta"
        )

    stmt = select(User).options(selectinload(User.projetos)).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")

    user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user, attribute_names=["projetos"])
    return user


@router.patch("/{user_id}/projetos", response_model=UserOut)
async def update_user_projetos(
    user_id: uuid.UUID,
    payload: UserProjetosUpdate,
    current_user: User = Depends(require_roles(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> User:
    stmt = select(User).options(selectinload(User.projetos)).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    if user.role != Role.RECRUITER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Vínculo de projeto só se aplica a recrutador"
        )

    projetos: list[ProjetoParceiro] = []
    if payload.project_ids:
        result = await db.execute(select(ProjetoParceiro).where(ProjetoParceiro.id.in_(payload.project_ids)))
        projetos = list(result.scalars().all())
        if len(projetos) != len(set(payload.project_ids)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Um ou mais projetos não encontrados")

    user.projetos = projetos
    await db.commit()
    await db.refresh(user, attribute_names=["projetos"])
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    if payload.email != user.email:
        existing = await db.execute(
            select(User).where(User.email == payload.email, User.id != user.id)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já cadastrado")
        user.email = payload.email
    user.nome = payload.nome
    await db.commit()
    return user


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_my_password(
    payload: PasswordChange,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    if not verify_password(payload.senha_atual, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Senha atual incorreta")
    user.hashed_password = hash_password(payload.nova_senha)
    await db.commit()

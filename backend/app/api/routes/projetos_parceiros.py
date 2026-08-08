from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_roles
from app.db.models.projeto_parceiro import ProjetoParceiro
from app.db.models.user import Role, User
from app.schemas.projeto_parceiro import ProjetoParceiroCreate, ProjetoParceiroOut

router = APIRouter(prefix="/projetos-parceiros", tags=["projetos-parceiros"])


@router.get("", response_model=list[ProjetoParceiroOut])
async def list_projetos(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[ProjetoParceiro]:
    stmt = select(ProjetoParceiro).order_by(ProjetoParceiro.nome)
    if user.role == Role.PARTNER:
        stmt = stmt.where(ProjetoParceiro.id == user.partner_project_id)
    return (await db.execute(stmt)).scalars().all()


@router.post("", response_model=ProjetoParceiroOut, status_code=status.HTTP_201_CREATED)
async def create_projeto(
    payload: ProjetoParceiroCreate,
    user: User = Depends(require_roles(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ProjetoParceiro:
    projeto = ProjetoParceiro(**payload.model_dump())
    db.add(projeto)
    await db.commit()
    await db.refresh(projeto)
    return projeto

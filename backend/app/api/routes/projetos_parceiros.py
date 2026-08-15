from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_roles, scoped_projeto_ids
from app.db.models.projeto_parceiro import ProjetoParceiro
from app.db.models.user import Role, User
from app.db.models.vaga import Vaga
from app.schemas.projeto_parceiro import ProjetoParceiroCreate, ProjetoParceiroOut

router = APIRouter(prefix="/projetos-parceiros", tags=["projetos-parceiros"])


@router.get("", response_model=list[ProjetoParceiroOut])
async def list_projetos(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[ProjetoParceiroOut]:
    vagas_count = (
        select(func.count())
        .select_from(Vaga)
        .where(Vaga.projeto_id == ProjetoParceiro.id)
        .correlate(ProjetoParceiro)
        .scalar_subquery()
    )
    stmt = select(ProjetoParceiro, vagas_count).order_by(ProjetoParceiro.nome)
    ids = scoped_projeto_ids(user)
    if ids is not None:
        stmt = stmt.where(ProjetoParceiro.id.in_(ids))

    rows = await db.execute(stmt)
    return [
        ProjetoParceiroOut(
            id=projeto.id,
            nome=projeto.nome,
            cliente=projeto.cliente,
            status=projeto.status,
            created_at=projeto.created_at,
            vagas_count=count,
        )
        for projeto, count in rows
    ]


@router.post("", response_model=ProjetoParceiroOut, status_code=status.HTTP_201_CREATED)
async def create_projeto(
    payload: ProjetoParceiroCreate,
    user: User = Depends(require_roles(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ProjetoParceiroOut:
    projeto = ProjetoParceiro(**payload.model_dump())
    db.add(projeto)
    await db.commit()
    await db.refresh(projeto)
    return ProjetoParceiroOut(
        id=projeto.id,
        nome=projeto.nome,
        cliente=projeto.cliente,
        status=projeto.status,
        created_at=projeto.created_at,
        vagas_count=0,
    )

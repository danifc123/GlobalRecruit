import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_roles
from app.db.models.user import Role, User
from app.db.models.vaga import StatusVaga, Vaga
from app.schemas.vaga import VagaCreate, VagaOut, VagaPage

router = APIRouter(prefix="/vagas", tags=["vagas"])

_LIST_COLUMNS = (
    Vaga.id,
    Vaga.projeto_id,
    Vaga.cliente,
    Vaga.cargo,
    Vaga.idioma,
    Vaga.pais,
    Vaga.modalidade,
    Vaga.salario,
    Vaga.comissao,
    Vaga.prioridade,
    Vaga.status,
    Vaga.created_at,
)


def _scope_to_user(stmt, user: User):
    # única linha de defesa que importa para o partner nunca ver vaga de
    # outro projeto: o filtro vem do token (server-side), não de query param
    if user.role == Role.PARTNER:
        return stmt.where(Vaga.projeto_id == user.partner_project_id)
    return stmt


@router.get("", response_model=VagaPage)
async def list_vagas(
    status_filter: StatusVaga | None = Query(default=None, alias="status"),
    page: int = Query(default=0, ge=0),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VagaPage:
    base = select(*_LIST_COLUMNS)
    base = _scope_to_user(base, user)
    if status_filter is not None:
        base = base.where(Vaga.status == status_filter)  # usa idx em vagas.status

    count_stmt = _scope_to_user(select(func.count()).select_from(Vaga), user)
    if status_filter is not None:
        count_stmt = count_stmt.where(Vaga.status == status_filter)
    total = (await db.execute(count_stmt)).scalar_one()

    rows = await db.execute(
        base.order_by(Vaga.created_at.desc()).offset(page * page_size).limit(page_size)
    )
    items = [VagaOut.model_validate(row) for row in rows]

    return VagaPage(items=items, page=page, page_size=page_size, total=total)


@router.post("", response_model=VagaOut, status_code=status.HTTP_201_CREATED)
async def create_vaga(
    payload: VagaCreate,
    user: User = Depends(require_roles(Role.ADMIN, Role.RECRUITER)),
    db: AsyncSession = Depends(get_db),
) -> Vaga:
    vaga = Vaga(**payload.model_dump(), status=StatusVaga.ABERTA)
    db.add(vaga)
    await db.commit()
    await db.refresh(vaga)
    return vaga


@router.get("/{vaga_id}", response_model=VagaOut)
async def get_vaga(
    vaga_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> Vaga:
    stmt = _scope_to_user(select(Vaga).where(Vaga.id == vaga_id), user)
    vaga = (await db.execute(stmt)).scalar_one_or_none()
    if vaga is None:
        # 404, não 403 — não confirmar pra um partner que a vaga existe em outro projeto
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga não encontrada")
    return vaga

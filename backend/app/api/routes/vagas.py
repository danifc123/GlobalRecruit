import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_roles, scoped_projeto_ids
from app.db.models.candidato import Candidato
from app.db.models.user import Role, User
from app.db.models.vaga import StatusVaga, Vaga
from app.schemas.vaga import VagaCreate, VagaOut, VagaPage, VagaPrioridadeUpdate, VagaStatusUpdate, VagaUpdate

router = APIRouter(prefix="/vagas", tags=["vagas"])

_CANDIDATOS_COUNT = (
    select(func.count())
    .select_from(Candidato)
    .where(Candidato.vaga_id == Vaga.id)
    .correlate(Vaga)
    .scalar_subquery()
)

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
    _CANDIDATOS_COUNT.label("candidatos_count"),
)


def _scope_to_user(stmt, user: User):
    # única linha de defesa que importa para o recrutador nunca ver vaga de
    # um projeto ao qual não está vinculado: o filtro vem do usuário
    # recarregado do banco a cada request, não de query param
    ids = scoped_projeto_ids(user)
    if ids is not None:
        return stmt.where(Vaga.projeto_id.in_(ids))
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
    user: User = Depends(require_roles(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> VagaOut:
    vaga = Vaga(**payload.model_dump(), status=StatusVaga.ABERTA)
    db.add(vaga)
    await db.commit()
    await db.refresh(vaga)
    return VagaOut(
        id=vaga.id,
        projeto_id=vaga.projeto_id,
        cliente=vaga.cliente,
        cargo=vaga.cargo,
        idioma=vaga.idioma,
        pais=vaga.pais,
        modalidade=vaga.modalidade,
        salario=vaga.salario,
        comissao=vaga.comissao,
        prioridade=vaga.prioridade,
        status=vaga.status,
        created_at=vaga.created_at,
        candidatos_count=0,
    )


@router.get("/{vaga_id}", response_model=VagaOut)
async def get_vaga(
    vaga_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> VagaOut:
    stmt = _scope_to_user(select(*_LIST_COLUMNS).where(Vaga.id == vaga_id), user)
    row = (await db.execute(stmt)).first()
    if row is None:
        # 404, não 403 — não confirmar pra um recrutador que a vaga existe em outro projeto
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga não encontrada")
    return VagaOut.model_validate(row)


@router.patch("/{vaga_id}", response_model=VagaOut)
async def update_vaga(
    vaga_id: uuid.UUID,
    payload: VagaUpdate,
    user: User = Depends(require_roles(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> VagaOut:
    vaga = await db.get(Vaga, vaga_id)
    if vaga is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga não encontrada")

    for field, value in payload.model_dump().items():
        setattr(vaga, field, value)
    await db.commit()

    row = (await db.execute(select(*_LIST_COLUMNS).where(Vaga.id == vaga_id))).first()
    return VagaOut.model_validate(row)


@router.patch("/{vaga_id}/status", response_model=VagaOut)
async def update_status(
    vaga_id: uuid.UUID,
    payload: VagaStatusUpdate,
    user: User = Depends(require_roles(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> VagaOut:
    vaga = await db.get(Vaga, vaga_id)
    if vaga is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga não encontrada")

    vaga.status = payload.status
    await db.commit()

    row = (await db.execute(select(*_LIST_COLUMNS).where(Vaga.id == vaga_id))).first()
    return VagaOut.model_validate(row)


@router.patch("/{vaga_id}/prioridade", response_model=VagaOut)
async def update_prioridade(
    vaga_id: uuid.UUID,
    payload: VagaPrioridadeUpdate,
    user: User = Depends(require_roles(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> VagaOut:
    vaga = await db.get(Vaga, vaga_id)
    if vaga is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga não encontrada")

    vaga.prioridade = payload.prioridade
    await db.commit()

    row = (await db.execute(select(*_LIST_COLUMNS).where(Vaga.id == vaga_id))).first()
    return VagaOut.model_validate(row)

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_roles, scoped_projeto_ids
from app.db.models.candidato import Candidato
from app.db.models.user import Role, User
from app.db.models.vaga import StatusVaga, Vaga
from app.schemas.vaga import VagaCreate, VagaOut, VagaPage, VagaPrioridadeUpdate, VagaStatusUpdate, VagaUpdate
from app.services.traducao.agendamento import (
    FabricaSessao,
    get_fabrica_sessao,
    get_tradutor,
    traduzir_vagas_em_segundo_plano,
)
from app.services.traducao.pendencias import traducoes_por_vaga
from app.services.traducao.tradutor import Tradutor
from app.services.vagas import encerrar_candidatos_em_andamento

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
    Vaga.codigo,
    Vaga.cliente,
    Vaga.cargo,
    Vaga.idioma,
    Vaga.pais,
    Vaga.localizacao,
    Vaga.modalidade,
    Vaga.headcount,
    Vaga.data_inicio,
    Vaga.salario,
    Vaga.faixa_salarial,
    Vaga.moeda,
    Vaga.tipo_salario,
    Vaga.comissao,
    Vaga.beneficios,
    Vaga.realocacao,
    Vaga.requisitos,
    Vaga.notas_internas,
    Vaga.jd_nome,
    Vaga.jd_url,
    Vaga.prioridade,
    Vaga.status,
    Vaga.created_at,
    _CANDIDATOS_COUNT.label("candidatos_count"),
)


async def _vagas_out(db: AsyncSession, rows) -> list[VagaOut]:
    """Converte linhas em VagaOut já com as traduções válidas de cada vaga."""
    lista = list(rows)
    traducoes = await traducoes_por_vaga(db, lista)
    return [VagaOut.model_validate(row).model_copy(update={"traducoes": traducoes[row.id]}) for row in lista]


async def _vaga_out_por_id(db: AsyncSession, vaga_id: uuid.UUID) -> VagaOut:
    row = (await db.execute(select(*_LIST_COLUMNS).where(Vaga.id == vaga_id))).first()
    return (await _vagas_out(db, [row]))[0]


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
    # 500 cobre a planilha do cliente (~136 vagas) numa página só
    page_size: int = Query(default=20, ge=1, le=500),
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
    items = await _vagas_out(db, rows)

    return VagaPage(items=items, page=page, page_size=page_size, total=total)


@router.post("", response_model=VagaOut, status_code=status.HTTP_201_CREATED)
async def create_vaga(
    payload: VagaCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_roles(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
    fabrica_sessao: FabricaSessao = Depends(get_fabrica_sessao),
    tradutor: Tradutor = Depends(get_tradutor),
) -> VagaOut:
    vaga = Vaga(**payload.model_dump(), status=StatusVaga.ABERTA)
    db.add(vaga)
    await db.commit()
    await db.refresh(vaga)
    background_tasks.add_task(traduzir_vagas_em_segundo_plano, [vaga.id], fabrica_sessao, tradutor)
    # vaga recém-criada: sem candidatos e ainda sem tradução (gerada depois da resposta)
    return VagaOut.model_validate(vaga)


@router.get("/{vaga_id}", response_model=VagaOut)
async def get_vaga(
    vaga_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> VagaOut:
    stmt = _scope_to_user(select(*_LIST_COLUMNS).where(Vaga.id == vaga_id), user)
    row = (await db.execute(stmt)).first()
    if row is None:
        # 404, não 403 — não confirmar pra um recrutador que a vaga existe em outro projeto
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga não encontrada")
    return (await _vagas_out(db, [row]))[0]


@router.patch("/{vaga_id}", response_model=VagaOut)
async def update_vaga(
    vaga_id: uuid.UUID,
    payload: VagaUpdate,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_roles(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
    fabrica_sessao: FabricaSessao = Depends(get_fabrica_sessao),
    tradutor: Tradutor = Depends(get_tradutor),
) -> VagaOut:
    vaga = await db.get(Vaga, vaga_id)
    if vaga is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga não encontrada")

    for field, value in payload.model_dump().items():
        setattr(vaga, field, value)
    await db.commit()
    background_tasks.add_task(traduzir_vagas_em_segundo_plano, [vaga_id], fabrica_sessao, tradutor)

    return await _vaga_out_por_id(db, vaga_id)


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

    # reativação: candidatos ainda em processo nessa vaga viram "concluído"
    if payload.status == StatusVaga.ABERTA and vaga.status != StatusVaga.ABERTA:
        await encerrar_candidatos_em_andamento(db, vaga_id)

    vaga.status = payload.status
    await db.commit()

    return await _vaga_out_por_id(db, vaga_id)


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

    return await _vaga_out_por_id(db, vaga_id)

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_db, require_roles, scoped_projeto_ids
from app.db.models.candidato import Candidato
from app.db.models.pipeline_stage import Estagio, PipelineStage
from app.db.models.user import Role, User
from app.db.models.vaga import Vaga
from app.schemas.candidato import CandidatoCreate, CandidatoOut, OutraCandidatura, PipelineStageUpdate

router = APIRouter(prefix="/candidatos", tags=["candidatos"])


def _estagio_atual(candidato: Candidato) -> Estagio | None:
    return candidato.pipeline_stages[0].estagio if candidato.pipeline_stages else None


def _to_out(candidato: Candidato, outras: list[OutraCandidatura] | None = None) -> CandidatoOut:
    return CandidatoOut(
        id=candidato.id,
        nome=candidato.nome,
        email=candidato.email,
        vaga_id=candidato.vaga_id,
        created_at=candidato.created_at,
        estagio_atual=_estagio_atual(candidato),
        # pipeline_stages já vem ordenado desc (ver relationship em Candidato) —
        # é o histórico completo, não só o estágio atual
        historico=list(candidato.pipeline_stages),
        outras_candidaturas=outras or [],
    )


@router.get("", response_model=list[CandidatoOut])
async def list_candidatos(
    vaga_id: uuid.UUID = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CandidatoOut]:
    # confirma que a vaga pertence ao escopo do usuário antes de listar
    # candidatos dela (recrutador não pode enumerar candidatos trocando vaga_id)
    vaga_stmt = select(Vaga.id).where(Vaga.id == vaga_id)
    ids = scoped_projeto_ids(user)
    if ids is not None:
        vaga_stmt = vaga_stmt.where(Vaga.projeto_id.in_(ids))
    if (await db.execute(vaga_stmt)).scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga não encontrada")

    # selectinload evita N+1: 1 query pra candidatos + 1 query pra todos os
    # pipeline_stages relacionados, em vez de 1 query por candidato
    stmt = (
        select(Candidato)
        .where(Candidato.vaga_id == vaga_id)
        .options(selectinload(Candidato.pipeline_stages))
        .order_by(Candidato.created_at.desc())
    )
    candidatos = (await db.execute(stmt)).scalars().all()
    return [_to_out(c) for c in candidatos]


@router.get("/{candidato_id}", response_model=CandidatoOut)
async def get_candidato(
    candidato_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> CandidatoOut:
    stmt = (
        select(Candidato)
        .join(Vaga, Vaga.id == Candidato.vaga_id)
        .where(Candidato.id == candidato_id)
        .options(selectinload(Candidato.pipeline_stages))
    )
    ids = scoped_projeto_ids(user)
    if ids is not None:
        stmt = stmt.where(Vaga.projeto_id.in_(ids))
    candidato = (await db.execute(stmt)).scalar_one_or_none()
    if candidato is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato não encontrado")

    # mesma pessoa em outras vagas — não existe cadastro de "pessoa" separado,
    # então agrupa por e-mail (mesmo critério que o resto do produto já usa
    # informalmente pra reconhecer "é o mesmo candidato")
    outras_stmt = (
        select(Candidato, Vaga.cargo, Vaga.cliente)
        .join(Vaga, Vaga.id == Candidato.vaga_id)
        .where(Candidato.email == candidato.email, Candidato.id != candidato.id)
        .options(selectinload(Candidato.pipeline_stages))
        .order_by(Candidato.created_at.desc())
    )
    if ids is not None:
        outras_stmt = outras_stmt.where(Vaga.projeto_id.in_(ids))
    outras = [
        OutraCandidatura(
            id=outro.id,
            vaga_id=outro.vaga_id,
            vaga_cargo=cargo,
            vaga_cliente=cliente,
            estagio_atual=_estagio_atual(outro),
        )
        for outro, cargo, cliente in (await db.execute(outras_stmt)).all()
    ]

    return _to_out(candidato, outras)


@router.post("", response_model=CandidatoOut, status_code=status.HTTP_201_CREATED)
async def create_candidato(
    payload: CandidatoCreate,
    user: User = Depends(require_roles(Role.ADMIN, Role.RECRUITER)),
    db: AsyncSession = Depends(get_db),
) -> CandidatoOut:
    vaga = await db.get(Vaga, payload.vaga_id)
    if vaga is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga não encontrada")

    # mesma regra de escopo do GET: recrutador só indica candidato pra vaga
    # de projeto vinculado a ele. 404, não 403 — não confirma pra ele que a
    # vaga existe em outro projeto.
    ids = scoped_projeto_ids(user)
    if ids is not None and vaga.projeto_id not in ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga não encontrada")

    candidato = Candidato(nome=payload.nome, email=payload.email, vaga_id=payload.vaga_id)
    db.add(candidato)
    await db.flush()
    db.add(PipelineStage(candidato_id=candidato.id, estagio=Estagio.TRIAGEM))
    await db.commit()
    await db.refresh(candidato, attribute_names=["pipeline_stages"])
    return _to_out(candidato)


@router.patch("/{candidato_id}/pipeline", response_model=CandidatoOut)
async def update_pipeline_stage(
    candidato_id: uuid.UUID,
    payload: PipelineStageUpdate,
    user: User = Depends(require_roles(Role.ADMIN, Role.RECRUITER)),
    db: AsyncSession = Depends(get_db),
) -> CandidatoOut:
    stmt = (
        select(Candidato)
        .join(Vaga, Vaga.id == Candidato.vaga_id)
        .where(Candidato.id == candidato_id)
        .options(selectinload(Candidato.pipeline_stages))
    )
    ids = scoped_projeto_ids(user)
    if ids is not None:
        stmt = stmt.where(Vaga.projeto_id.in_(ids))
    candidato = (await db.execute(stmt)).scalar_one_or_none()
    if candidato is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato não encontrado")

    db.add(PipelineStage(candidato_id=candidato.id, estagio=payload.estagio))
    await db.commit()
    await db.refresh(candidato, attribute_names=["pipeline_stages"])
    return _to_out(candidato)

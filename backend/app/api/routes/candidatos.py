import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_db, require_roles
from app.db.models.candidato import Candidato
from app.db.models.pipeline_stage import Estagio, PipelineStage
from app.db.models.user import Role, User
from app.db.models.vaga import Vaga
from app.schemas.candidato import CandidatoCreate, CandidatoOut, PipelineStageUpdate

router = APIRouter(prefix="/candidatos", tags=["candidatos"])


def _to_out(candidato: Candidato) -> CandidatoOut:
    atual = candidato.pipeline_stages[0].estagio if candidato.pipeline_stages else None
    return CandidatoOut(
        id=candidato.id,
        nome=candidato.nome,
        email=candidato.email,
        vaga_id=candidato.vaga_id,
        created_at=candidato.created_at,
        estagio_atual=atual,
    )


@router.get("", response_model=list[CandidatoOut])
async def list_candidatos(
    vaga_id: uuid.UUID = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CandidatoOut]:
    # confirma que a vaga pertence ao escopo do usuário antes de listar
    # candidatos dela (partner não pode enumerar candidatos trocando vaga_id)
    vaga_stmt = select(Vaga.id).where(Vaga.id == vaga_id)
    if user.role == Role.PARTNER:
        vaga_stmt = vaga_stmt.where(Vaga.projeto_id == user.partner_project_id)
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


@router.post("", response_model=CandidatoOut, status_code=status.HTTP_201_CREATED)
async def create_candidato(
    payload: CandidatoCreate,
    user: User = Depends(require_roles(Role.ADMIN, Role.RECRUITER)),
    db: AsyncSession = Depends(get_db),
) -> CandidatoOut:
    vaga = await db.get(Vaga, payload.vaga_id)
    if vaga is None:
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
        .where(Candidato.id == candidato_id)
        .options(selectinload(Candidato.pipeline_stages))
    )
    candidato = (await db.execute(stmt)).scalar_one_or_none()
    if candidato is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato não encontrado")

    db.add(PipelineStage(candidato_id=candidato.id, estagio=payload.estagio))
    await db.commit()
    await db.refresh(candidato, attribute_names=["pipeline_stages"])
    return _to_out(candidato)

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.db.models.candidato import Candidato
from app.db.models.pipeline_stage import Estagio, PipelineStage
from app.db.models.projeto_parceiro import ProjetoParceiro
from app.db.models.user import Role, User
from app.db.models.vaga import StatusVaga, Vaga
from app.schemas.dashboard import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def stats(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> DashboardStats:
    vagas_stmt = select(
        func.count(),
        func.count(case((Vaga.modalidade.ilike("remoto"), 1))),
    ).where(Vaga.status == StatusVaga.ABERTA)
    if user.role == Role.PARTNER:
        vagas_stmt = vagas_stmt.where(Vaga.projeto_id == user.partner_project_id)
    vagas_abertas, vagas_remotas = (await db.execute(vagas_stmt)).one()
    pct_modalidade_remota = round(100 * vagas_remotas / vagas_abertas, 1) if vagas_abertas else 0.0

    clientes_stmt = select(func.count(func.distinct(ProjetoParceiro.cliente))).where(
        ProjetoParceiro.status == "ativo"
    )
    if user.role == Role.PARTNER:
        clientes_stmt = clientes_stmt.where(ProjetoParceiro.id == user.partner_project_id)
    clientes_ativos = (await db.execute(clientes_stmt)).scalar_one()

    # último estágio por candidato via DISTINCT ON, agregado em uma query só
    latest_stage = (
        select(
            PipelineStage.candidato_id,
            PipelineStage.estagio,
        )
        .distinct(PipelineStage.candidato_id)
        .order_by(PipelineStage.candidato_id, PipelineStage.updated_at.desc())
        .subquery()
    )

    pipeline_stmt = (
        select(
            func.count(
                case((latest_stage.c.estagio.notin_([Estagio.CONTRATADO, Estagio.REJEITADO]), 1))
            ),
            func.count(case((latest_stage.c.estagio == Estagio.CONTRATADO, 1))),
        )
        .select_from(latest_stage)
        .join(Candidato, Candidato.id == latest_stage.c.candidato_id)
        .join(Vaga, Vaga.id == Candidato.vaga_id)
    )
    if user.role == Role.PARTNER:
        pipeline_stmt = pipeline_stmt.where(Vaga.projeto_id == user.partner_project_id)

    em_pipeline, contratados = (await db.execute(pipeline_stmt)).one()

    return DashboardStats(
        vagas_abertas=vagas_abertas,
        candidatos_em_pipeline=em_pipeline or 0,
        candidatos_contratados=contratados or 0,
        clientes_ativos=clientes_ativos,
        pct_modalidade_remota=pct_modalidade_remota,
    )

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, scoped_projeto_ids
from app.db.models.candidato import Candidato
from app.db.models.pipeline_stage import Estagio, PipelineStage
from app.db.models.projeto_parceiro import ProjetoParceiro
from app.db.models.user import User
from app.db.models.vaga import Prioridade, StatusVaga, Vaga
from app.schemas.dashboard import (
    CandidatoParado,
    DashboardStats,
    EtapaCount,
    PropostaAguardando,
    VagaPorIdioma,
    VagaSemCandidato,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# candidato sem mudança de estágio há mais de N dias entra em "precisa de você hoje"
_DIAS_PARADO = 10
_TOP_N = 3


@router.get("/stats", response_model=DashboardStats)
async def stats(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> DashboardStats:
    ids = scoped_projeto_ids(user)

    vagas_stmt = select(
        func.count(),
        func.count(case((Vaga.modalidade.ilike("remoto"), 1))),
        func.count(case((Vaga.prioridade == Prioridade.ALTA, 1))),
    ).where(Vaga.status == StatusVaga.ABERTA)
    if ids is not None:
        vagas_stmt = vagas_stmt.where(Vaga.projeto_id.in_(ids))
    vagas_abertas, vagas_remotas, vagas_alta_prioridade = (await db.execute(vagas_stmt)).one()
    pct_modalidade_remota = round(100 * vagas_remotas / vagas_abertas, 1) if vagas_abertas else 0.0

    clientes_stmt = select(func.count(func.distinct(ProjetoParceiro.cliente))).where(
        ProjetoParceiro.status == "ativo"
    )
    if ids is not None:
        clientes_stmt = clientes_stmt.where(ProjetoParceiro.id.in_(ids))
    clientes_ativos = (await db.execute(clientes_stmt)).scalar_one()

    idioma_stmt = (
        select(Vaga.idioma, func.count())
        .where(Vaga.status == StatusVaga.ABERTA, Vaga.idioma.isnot(None))
        .group_by(Vaga.idioma)
        .order_by(func.count().desc())
    )
    if ids is not None:
        idioma_stmt = idioma_stmt.where(Vaga.projeto_id.in_(ids))
    vagas_por_idioma = [
        VagaPorIdioma(idioma=idioma, count=count) for idioma, count in (await db.execute(idioma_stmt)).all()
    ]

    sem_candidato_stmt = (
        select(Vaga.id, Vaga.cargo, Vaga.cliente)
        .outerjoin(Candidato, Candidato.vaga_id == Vaga.id)
        .where(Vaga.status == StatusVaga.ABERTA, Candidato.id.is_(None))
        .limit(_TOP_N)
    )
    if ids is not None:
        sem_candidato_stmt = sem_candidato_stmt.where(Vaga.projeto_id.in_(ids))
    vagas_sem_candidato = [
        VagaSemCandidato(id=id_, cargo=cargo, cliente=cliente)
        for id_, cargo, cliente in (await db.execute(sem_candidato_stmt)).all()
    ]

    semana_cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    novas_stmt = select(func.count()).where(Vaga.created_at >= semana_cutoff)
    if ids is not None:
        novas_stmt = novas_stmt.where(Vaga.projeto_id.in_(ids))
    vagas_novas_semana = (await db.execute(novas_stmt)).scalar_one()

    # último estágio por candidato via DISTINCT ON, agregado em uma query só —
    # reaproveitada tanto pros totais do pipeline quanto pra lista de parados
    latest_stage = (
        select(
            PipelineStage.candidato_id,
            PipelineStage.estagio,
            PipelineStage.updated_at,
        )
        .distinct(PipelineStage.candidato_id)
        .order_by(PipelineStage.candidato_id, PipelineStage.updated_at.desc())
        .subquery()
    )

    pipeline_stmt = (
        select(
            func.count(
                case((latest_stage.c.estagio.notin_([Estagio.CONTRATADO, Estagio.REJEITADO, Estagio.CONCLUIDO]), 1))
            ),
            func.count(case((latest_stage.c.estagio == Estagio.CONTRATADO, 1))),
        )
        .select_from(latest_stage)
        .join(Candidato, Candidato.id == latest_stage.c.candidato_id)
        .join(Vaga, Vaga.id == Candidato.vaga_id)
    )
    if ids is not None:
        pipeline_stmt = pipeline_stmt.where(Vaga.projeto_id.in_(ids))

    em_pipeline, contratados = (await db.execute(pipeline_stmt)).one()

    cutoff = datetime.now(timezone.utc) - timedelta(days=_DIAS_PARADO)
    parados_stmt = (
        select(Candidato.id, Candidato.nome, Vaga.cargo, latest_stage.c.updated_at)
        .select_from(latest_stage)
        .join(Candidato, Candidato.id == latest_stage.c.candidato_id)
        .join(Vaga, Vaga.id == Candidato.vaga_id)
        .where(
            latest_stage.c.estagio.notin_([Estagio.CONTRATADO, Estagio.REJEITADO, Estagio.CONCLUIDO]),
            latest_stage.c.updated_at < cutoff,
        )
        .order_by(latest_stage.c.updated_at.asc())
        .limit(_TOP_N)
    )
    if ids is not None:
        parados_stmt = parados_stmt.where(Vaga.projeto_id.in_(ids))

    now = datetime.now(timezone.utc)
    candidatos_parados = [
        CandidatoParado(id=id_, nome=nome, vaga_cargo=cargo, dias_parado=(now - updated_at).days)
        for id_, nome, cargo, updated_at in (await db.execute(parados_stmt)).all()
    ]

    funil_stmt = (
        select(latest_stage.c.estagio, func.count())
        .select_from(latest_stage)
        .join(Candidato, Candidato.id == latest_stage.c.candidato_id)
        .join(Vaga, Vaga.id == Candidato.vaga_id)
        .group_by(latest_stage.c.estagio)
    )
    if ids is not None:
        funil_stmt = funil_stmt.where(Vaga.projeto_id.in_(ids))
    funil_counts = dict((await db.execute(funil_stmt)).all())
    funil_por_etapa = [
        EtapaCount(estagio=estagio.value, count=funil_counts.get(estagio, 0)) for estagio in Estagio
    ]

    propostas_stmt = (
        select(Candidato.id, Candidato.nome, Vaga.cargo, latest_stage.c.updated_at)
        .select_from(latest_stage)
        .join(Candidato, Candidato.id == latest_stage.c.candidato_id)
        .join(Vaga, Vaga.id == Candidato.vaga_id)
        .where(latest_stage.c.estagio == Estagio.PROPOSTA)
        .order_by(latest_stage.c.updated_at.asc())
        .limit(_TOP_N)
    )
    if ids is not None:
        propostas_stmt = propostas_stmt.where(Vaga.projeto_id.in_(ids))
    propostas_aguardando = [
        PropostaAguardando(id=id_, nome=nome, vaga_cargo=cargo, enviada_em=updated_at.date().isoformat())
        for id_, nome, cargo, updated_at in (await db.execute(propostas_stmt)).all()
    ]

    return DashboardStats(
        vagas_abertas=vagas_abertas,
        vagas_alta_prioridade=vagas_alta_prioridade,
        candidatos_em_pipeline=em_pipeline or 0,
        candidatos_contratados=contratados or 0,
        clientes_ativos=clientes_ativos,
        pct_modalidade_remota=pct_modalidade_remota,
        vagas_novas_semana=vagas_novas_semana,
        vagas_por_idioma=vagas_por_idioma,
        candidatos_parados=candidatos_parados,
        vagas_sem_candidato=vagas_sem_candidato,
        funil_por_etapa=funil_por_etapa,
        propostas_aguardando=propostas_aguardando,
    )

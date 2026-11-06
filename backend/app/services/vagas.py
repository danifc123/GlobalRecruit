"""Regras de negócio de vaga compartilhadas entre rotas e importação."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.candidato import Candidato
from app.db.models.pipeline_stage import Estagio, PipelineStage

_ESTAGIOS_EM_ANDAMENTO = (Estagio.TRIAGEM, Estagio.ENTREVISTA, Estagio.PROPOSTA)


async def encerrar_candidatos_em_andamento(db: AsyncSession, vaga_id: uuid.UUID) -> int:
    """Marca como "concluído" os candidatos da vaga ainda em processo.

    Usado quando uma vaga pausada/fechada volta a ficar aberta: fecha o
    vínculo sem apagar histórico, deixando a vaga livre pra receber indicação
    nova. Contratado/rejeitado ficam como estão, já são desfechos registrados.
    Só adiciona os estágios na sessão — quem chama decide o commit.

    Retorna quantos candidatos foram encerrados.
    """
    latest_stage = (
        select(PipelineStage.candidato_id, PipelineStage.estagio)
        .distinct(PipelineStage.candidato_id)
        .order_by(PipelineStage.candidato_id, PipelineStage.updated_at.desc())
        .subquery()
    )
    em_andamento_stmt = (
        select(Candidato.id)
        .select_from(latest_stage)
        .join(Candidato, Candidato.id == latest_stage.c.candidato_id)
        .where(
            Candidato.vaga_id == vaga_id,
            latest_stage.c.estagio.in_(_ESTAGIOS_EM_ANDAMENTO),
        )
    )
    candidato_ids = (await db.execute(em_andamento_stmt)).scalars().all()
    for candidato_id in candidato_ids:
        db.add(PipelineStage(candidato_id=candidato_id, estagio=Estagio.CONCLUIDO))
    return len(candidato_ids)

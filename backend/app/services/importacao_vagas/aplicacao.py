"""Aplica as linhas normalizadas às vagas de um projeto (criar/atualizar).

Só mexe na sessão — quem chama decide entre commit (importação real) e
rollback (pré-visualização), o que garante o mesmo resumo nos dois modos.
"""

import enum
import uuid
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.vaga import Prioridade, StatusVaga, Vaga
from app.services.importacao_vagas.leitura import PlanilhaLida
from app.services.importacao_vagas.normalizacao import (
    ErroLinha,
    LinhaIgnorada,
    VagaDaPlanilha,
    normalizar_linha,
)
from app.services.vagas import encerrar_candidatos_em_andamento

# padrões para vaga nova quando a célula vem vazia (decisões P2 e P4)
STATUS_PADRAO_VAGA_NOVA = StatusVaga.ABERTA
PRIORIDADE_PADRAO_VAGA_NOVA = Prioridade.MEDIA

ChaveVaga = tuple[str, str, str]


class Acao(str, enum.Enum):
    CRIAR = "criar"
    ATUALIZAR = "atualizar"
    IGNORAR = "ignorar"


@dataclass(frozen=True)
class ItemImportacao:
    linha: int
    codigo: str | None
    cargo: str | None
    cliente: str | None
    acao: Acao


@dataclass
class ResultadoImportacao:
    criadas: int = 0
    atualizadas: int = 0
    ignoradas: int = 0
    erros: list[ErroLinha] = field(default_factory=list)
    itens: list[ItemImportacao] = field(default_factory=list)
    # vagas criadas/atualizadas, preenchido após o flush (ex.: para traduzir só elas)
    vaga_ids: list[uuid.UUID] = field(default_factory=list)


def chave_vaga(codigo: str | None, cliente: str, cargo: str) -> ChaveVaga:
    """(código, cargo) sem diferenciar maiúsculas; sem código, (cliente, cargo)."""
    if codigo:
        return ("codigo", codigo.casefold(), cargo.casefold())
    return ("cliente", cliente.casefold(), cargo.casefold())


async def importar_vagas(db: AsyncSession, projeto_id: uuid.UUID, planilha: PlanilhaLida) -> ResultadoImportacao:
    existentes = await _vagas_do_projeto_por_chave(db, projeto_id)
    primeira_linha_por_chave: dict[ChaveVaga, int] = {}
    resultado = ResultadoImportacao()
    afetadas: list[Vaga] = []

    for linha in planilha.linhas:
        normalizada = normalizar_linha(linha)
        if isinstance(normalizada, ErroLinha):
            resultado.erros.append(normalizada)
        elif isinstance(normalizada, LinhaIgnorada):
            _registrar_ignorada(resultado, normalizada)
        else:
            vaga = await _aplicar_vaga(db, projeto_id, normalizada, existentes, primeira_linha_por_chave, resultado)
            if vaga is not None:
                afetadas.append(vaga)

    await db.flush()
    resultado.vaga_ids = [vaga.id for vaga in afetadas]
    return resultado


async def _vagas_do_projeto_por_chave(db: AsyncSession, projeto_id: uuid.UUID) -> dict[ChaveVaga, Vaga]:
    vagas = (await db.execute(select(Vaga).where(Vaga.projeto_id == projeto_id))).scalars().all()
    return {chave_vaga(vaga.codigo, vaga.cliente, vaga.cargo): vaga for vaga in vagas}


def _registrar_ignorada(resultado: ResultadoImportacao, ignorada: LinhaIgnorada) -> None:
    resultado.ignoradas += 1
    resultado.itens.append(
        ItemImportacao(
            linha=ignorada.linha, codigo=ignorada.codigo, cargo=None, cliente=ignorada.cliente, acao=Acao.IGNORAR
        )
    )


async def _aplicar_vaga(
    db: AsyncSession,
    projeto_id: uuid.UUID,
    dados: VagaDaPlanilha,
    existentes: dict[ChaveVaga, Vaga],
    primeira_linha_por_chave: dict[ChaveVaga, int],
    resultado: ResultadoImportacao,
) -> Vaga | None:
    cliente, cargo = dados.campos["cliente"], dados.campos["cargo"]
    if cliente is None or cargo is None:
        # normalizar_linha já transforma esses casos em erro/ignorada
        raise RuntimeError(f"linha {dados.linha} chegou sem cliente/cargo na aplicação")
    chave = chave_vaga(dados.campos.get("codigo"), cliente, cargo)

    linha_original = primeira_linha_por_chave.get(chave)
    if linha_original is not None:
        resultado.erros.append(ErroLinha(linha=dados.linha, motivo=f"duplicada da linha {linha_original}"))
        return None
    primeira_linha_por_chave[chave] = dados.linha

    vaga = existentes.get(chave)
    if vaga is None:
        vaga = _criar_vaga(db, projeto_id, dados)
        resultado.criadas += 1
        acao = Acao.CRIAR
    else:
        await _atualizar_vaga(db, vaga, dados)
        resultado.atualizadas += 1
        acao = Acao.ATUALIZAR

    resultado.itens.append(
        ItemImportacao(linha=dados.linha, codigo=dados.campos.get("codigo"), cargo=cargo, cliente=cliente, acao=acao)
    )
    return vaga


def _criar_vaga(db: AsyncSession, projeto_id: uuid.UUID, dados: VagaDaPlanilha) -> Vaga:
    vaga = Vaga(
        projeto_id=projeto_id,
        **dados.campos,
        status=dados.status or STATUS_PADRAO_VAGA_NOVA,
        prioridade=dados.prioridade or PRIORIDADE_PADRAO_VAGA_NOVA,
    )
    db.add(vaga)
    return vaga


async def _atualizar_vaga(db: AsyncSession, vaga: Vaga, dados: VagaDaPlanilha) -> None:
    # só as colunas presentes na planilha: célula vazia apaga o valor (P6),
    # coluna ausente não toca no campo; comissão nunca vem da planilha
    for campo, valor in dados.campos.items():
        setattr(vaga, campo, valor)
    if dados.prioridade is not None:
        vaga.prioridade = dados.prioridade
    if dados.status is None:
        return
    if dados.status == StatusVaga.ABERTA and vaga.status != StatusVaga.ABERTA:
        await encerrar_candidatos_em_andamento(db, vaga.id)
    vaga.status = dados.status

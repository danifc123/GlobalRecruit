import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.deps import get_db, require_roles
from app.db.models.projeto_parceiro import ProjetoParceiro
from app.db.models.user import Role, User
from app.schemas.importacao import ErroLinhaOut, ItemImportacaoOut, ResultadoImportacaoOut
from app.services.importacao_vagas import PlanilhaInvalidaError, ResultadoImportacao, importar_vagas, ler_planilha
from app.services.traducao.agendamento import (
    FabricaSessao,
    get_fabrica_sessao,
    get_tradutor,
    traduzir_vagas_em_segundo_plano,
)
from app.services.traducao.tradutor import Tradutor

router = APIRouter(prefix="/vagas", tags=["vagas"])

TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024  # 10 MB (spec importacao-vagas)
_EXTENSAO_ACEITA = ".xlsx"


@router.post("/importar", response_model=ResultadoImportacaoOut)
async def importar_planilha(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    projeto_id: uuid.UUID = Form(...),
    dry_run: bool = Form(False),
    user: User = Depends(require_roles(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
    fabrica_sessao: FabricaSessao = Depends(get_fabrica_sessao),
    tradutor: Tradutor = Depends(get_tradutor),
) -> ResultadoImportacaoOut:
    """Cria/atualiza vagas do projeto a partir do .xlsx do cliente.

    Com dry_run=true devolve o mesmo resumo sem gravar nada (rollback).
    Nunca apaga vagas que não estão na planilha.
    """
    conteudo = await _ler_upload(file)
    if await db.get(ProjetoParceiro, projeto_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projeto não encontrado")

    try:
        # openpyxl é síncrono e CPU-bound: fora do event loop
        planilha = await run_in_threadpool(ler_planilha, conteudo)
    except PlanilhaInvalidaError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    resultado = await importar_vagas(db, projeto_id, planilha)
    if dry_run:
        await db.rollback()
    else:
        await db.commit()
        # tradução depois da resposta; prévia nunca traduz (nada foi gravado)
        background_tasks.add_task(traduzir_vagas_em_segundo_plano, resultado.vaga_ids, fabrica_sessao, tradutor)
    return _para_resposta(resultado, aba=planilha.aba, dry_run=dry_run)


async def _ler_upload(file: UploadFile) -> bytes:
    nome = file.filename or ""
    if not nome.lower().endswith(_EXTENSAO_ACEITA):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Só arquivos .xlsx são aceitos (recebido: "{nome}").',
        )
    conteudo = await file.read(TAMANHO_MAXIMO_BYTES + 1)
    if len(conteudo) > TAMANHO_MAXIMO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Arquivo maior que o limite de 10 MB.",
        )
    return conteudo


def _para_resposta(resultado: ResultadoImportacao, *, aba: str, dry_run: bool) -> ResultadoImportacaoOut:
    return ResultadoImportacaoOut(
        dry_run=dry_run,
        aba=aba,
        criadas=resultado.criadas,
        atualizadas=resultado.atualizadas,
        ignoradas=resultado.ignoradas,
        erros=[ErroLinhaOut(linha=erro.linha, motivo=erro.motivo) for erro in resultado.erros],
        itens=[
            ItemImportacaoOut(
                linha=item.linha, codigo=item.codigo, cargo=item.cargo, cliente=item.cliente, acao=item.acao.value
            )
            for item in resultado.itens
        ],
    )

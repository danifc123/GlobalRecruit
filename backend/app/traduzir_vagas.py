"""Traduz para PT-BR os textos de todas as vagas que ainda não têm tradução.

Rodar dentro de backend/: python -m app.traduzir_vagas

Idempotente: texto já traduzido (e não alterado) não é enviado de novo, então
pode ser executado quantas vezes for preciso — ex.: depois do deploy desta
funcionalidade ou depois de uma falha/cota esgotada do serviço.
"""

import asyncio

from app.services.traducao.agendamento import FabricaSessao, get_fabrica_sessao, get_tradutor
from app.services.traducao.pendencias import ResumoTraducao, traduzir_pendentes
from app.services.traducao.tradutor import Tradutor


async def executar(fabrica_sessao: FabricaSessao, tradutor: Tradutor) -> ResumoTraducao:
    async with fabrica_sessao() as db:
        resumo = await traduzir_pendentes(db, tradutor, vaga_ids=None)
        await db.commit()
    _imprimir(resumo)
    return resumo


def _imprimir(resumo: ResumoTraducao) -> None:
    if resumo.desativado:
        print("Tradução desativada: configure DEEPL_API_KEY no .env para traduzir.")
    print(
        f"traduzidos: {resumo.traduzidos} | falhas: {resumo.falhas} | "
        f"traduções removidas: {resumo.removidos} | caracteres enviados: {resumo.caracteres}"
    )
    if resumo.falhas:
        print("Há campos que falharam — rode o comando de novo mais tarde (detalhes no log).")


if __name__ == "__main__":
    asyncio.run(executar(get_fabrica_sessao(), get_tradutor()))

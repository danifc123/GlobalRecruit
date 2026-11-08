"""Provedores de tradução automática EN → PT-BR (fronteira de I/O).

`Tradutor` é a interface usada pela regra de negócio; trocar DeepL por outro
serviço é escrever outra implementação, sem mexer em quem chama.
"""

import json
import logging
from collections.abc import Iterator
from typing import Protocol

import httpx

logger = logging.getLogger(__name__)

# limites da DeepL /v2/translate (developers.deepl.com, verificado em 2026-11-07)
MAX_TEXTOS_POR_REQUISICAO = 50
MAX_BYTES_POR_REQUISICAO = 128 * 1024
# folga para o resto do corpo JSON (chaves, idiomas, aspas e vírgulas)
_FOLGA_BYTES_CORPO = 1024
TEMPO_LIMITE_SEGUNDOS = 15.0  # decisão P8
IDIOMA_ORIGEM = "EN"
IDIOMA_DESTINO = "PT-BR"

_MOTIVO_POR_STATUS: dict[int, str] = {
    403: "falha de autorização (chave inválida ou sem permissão)",
    413: "requisição maior que o limite",
    429: "excesso de requisições",
    456: "cota de caracteres esgotada",
    529: "excesso de requisições",
}


class FalhaTraducao(Exception):
    """O serviço não traduziu; quem chama deixa o campo pendente para depois."""


class Tradutor(Protocol):
    async def traduzir(self, textos: list[str]) -> list[str] | None:
        """Traduz na mesma ordem; None = tradução desativada (nada a fazer).

        Levanta FalhaTraducao quando o serviço falha.
        """
        ...


class TradutorDesativado:
    """Usado quando não há chave configurada: o sistema segue sem traduzir."""

    def __init__(self) -> None:
        self._avisado = False

    async def traduzir(self, textos: list[str]) -> list[str] | None:
        if not self._avisado:
            logger.warning("tradução automática desativada: DEEPL_API_KEY não configurada")
            self._avisado = True
        return None


class DeepLTradutor:
    def __init__(
        self,
        chave: str,
        url_base: str,
        transporte: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._chave = chave
        self._url = f"{url_base.rstrip('/')}/v2/translate"
        self._transporte = transporte

    async def traduzir(self, textos: list[str]) -> list[str] | None:
        if not textos:
            return []
        traduzidos: list[str] = []
        async with httpx.AsyncClient(transport=self._transporte, timeout=TEMPO_LIMITE_SEGUNDOS) as cliente:
            for lote in _lotes(textos):
                traduzidos.extend(await self._traduzir_lote(cliente, lote))
        return traduzidos

    async def _traduzir_lote(self, cliente: httpx.AsyncClient, lote: list[str]) -> list[str]:
        caracteres = sum(len(texto) for texto in lote)
        try:
            resposta = await cliente.post(
                self._url,
                headers={"Authorization": f"DeepL-Auth-Key {self._chave}"},
                json={"text": lote, "source_lang": IDIOMA_ORIGEM, "target_lang": IDIOMA_DESTINO},
            )
        except httpx.TimeoutException as exc:
            logger.warning("tradução falhou: tempo limite (%s textos, %s caracteres)", len(lote), caracteres)
            raise FalhaTraducao(f"tempo limite de {TEMPO_LIMITE_SEGUNDOS:.0f}s excedido") from exc
        except httpx.HTTPError as exc:
            logger.warning("tradução falhou: erro de rede %s (%s textos)", type(exc).__name__, len(lote))
            raise FalhaTraducao(f"erro de rede: {type(exc).__name__}") from exc

        if resposta.status_code != 200:
            motivo = _MOTIVO_POR_STATUS.get(resposta.status_code, "erro temporário do serviço")
            # nunca logar o texto das vagas nem a chave
            logger.warning(
                "tradução falhou: HTTP %s %s (%s textos, %s caracteres)",
                resposta.status_code,
                motivo,
                len(lote),
                caracteres,
            )
            raise FalhaTraducao(f"HTTP {resposta.status_code}: {motivo}")

        return [item["text"] for item in resposta.json()["translations"]]


def _lotes(textos: list[str]) -> Iterator[list[str]]:
    """Agrupa respeitando 50 textos e ~128 KiB por requisição, sem mudar a ordem."""
    limite = MAX_BYTES_POR_REQUISICAO - _FOLGA_BYTES_CORPO
    lote: list[str] = []
    bytes_lote = 0
    for texto in textos:
        tamanho = len(json.dumps(texto, ensure_ascii=False).encode("utf-8")) + 1
        if lote and (len(lote) == MAX_TEXTOS_POR_REQUISICAO or bytes_lote + tamanho > limite):
            yield lote
            lote, bytes_lote = [], 0
        lote.append(texto)
        bytes_lote += tamanho
    if lote:
        yield lote

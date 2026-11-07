"""Unitários do provedor de tradução (sem rede) — spec traducao-vagas."""

import json
import logging

import httpx
import pytest

from app.services.traducao.tradutor import (
    MAX_TEXTOS_POR_REQUISICAO,
    DeepLTradutor,
    FalhaTraducao,
    TradutorDesativado,
)

_CHAVE = "chave-de-teste-nao-real"


def _tradutor(handler) -> DeepLTradutor:
    return DeepLTradutor(
        chave=_CHAVE,
        url_base="https://api-free.deepl.com",
        transporte=httpx.MockTransport(handler),
    )


def _resposta_eco(request: httpx.Request) -> httpx.Response:
    corpo = json.loads(request.content)
    return httpx.Response(200, json={"translations": [{"text": f"PT:{t}"} for t in corpo["text"]]})


async def test_traduz_para_portugues_do_brasil_com_a_chave_no_header() -> None:
    pedidos: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        pedidos.append(request)
        return _resposta_eco(request)

    traduzidos = await _tradutor(handler).traduzir(["Fluent German", "Meal card"])

    assert traduzidos == ["PT:Fluent German", "PT:Meal card"]
    corpo = json.loads(pedidos[0].content)
    assert corpo["target_lang"] == "PT-BR"
    assert corpo["source_lang"] == "EN"
    assert pedidos[0].url == "https://api-free.deepl.com/v2/translate"
    assert pedidos[0].headers["Authorization"] == f"DeepL-Auth-Key {_CHAVE}"


async def test_divide_em_lotes_de_no_maximo_50_textos_e_mantem_a_ordem() -> None:
    tamanhos: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        tamanhos.append(len(json.loads(request.content)["text"]))
        return _resposta_eco(request)

    textos = [f"texto {i}" for i in range(120)]

    traduzidos = await _tradutor(handler).traduzir(textos)

    assert tamanhos == [MAX_TEXTOS_POR_REQUISICAO, MAX_TEXTOS_POR_REQUISICAO, 20]
    assert traduzidos == [f"PT:texto {i}" for i in range(120)]


async def test_divide_lote_que_passaria_do_limite_de_bytes() -> None:
    tamanhos: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert len(request.content) <= 128 * 1024
        tamanhos.append(len(json.loads(request.content)["text"]))
        return _resposta_eco(request)

    textos = ["x" * 40_000 for _ in range(5)]

    traduzidos = await _tradutor(handler).traduzir(textos)

    assert sum(tamanhos) == 5
    assert len(tamanhos) > 1
    assert len(traduzidos) == 5


async def test_lista_vazia_nao_chama_o_servico() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("não deveria chamar")

    assert await _tradutor(handler).traduzir([]) == []


@pytest.mark.parametrize(
    ("status", "motivo"),
    [(456, "cota"), (429, "requisições"), (529, "requisições"), (503, "temporário"), (403, "autorização")],
)
async def test_erro_http_vira_falha_com_motivo(status: int, motivo: str) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json={"message": "erro"})

    with pytest.raises(FalhaTraducao, match=motivo):
        await _tradutor(handler).traduzir(["Fluent German"])


async def test_timeout_vira_falha() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("demorou", request=request)

    with pytest.raises(FalhaTraducao, match="tempo limite"):
        await _tradutor(handler).traduzir(["Fluent German"])


async def test_falha_nao_loga_texto_nem_chave(caplog: pytest.LogCaptureFixture) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(456, json={"message": "Quota exceeded"})

    with caplog.at_level(logging.WARNING), pytest.raises(FalhaTraducao):
        await _tradutor(handler).traduzir(["Texto confidencial da vaga"])

    assert "Texto confidencial" not in caplog.text
    assert _CHAVE not in caplog.text
    assert "456" in caplog.text


async def test_tradutor_desativado_nao_traduz_e_avisa_uma_unica_vez(caplog: pytest.LogCaptureFixture) -> None:
    tradutor = TradutorDesativado()

    with caplog.at_level(logging.WARNING):
        primeira = await tradutor.traduzir(["Fluent German"])
        segunda = await tradutor.traduzir(["Meal card"])

    assert primeira is None
    assert segunda is None
    assert caplog.text.count("tradução automática desativada") == 1

"""Unitários (sem banco): leitura e normalização da planilha — spec importacao-vagas."""

from datetime import datetime

import pytest

from app.db.models.vaga import Prioridade, StatusVaga
from app.services.importacao_vagas.leitura import (
    LINHAS_VARRIDAS_PARA_CABECALHO,
    Coluna,
    PlanilhaInvalidaError,
    identificar_coluna,
    ler_planilha,
)
from app.services.importacao_vagas.normalizacao import (
    ErroLinha,
    LinhaIgnorada,
    VagaDaPlanilha,
    normalizar_linha,
    texto,
)
from tests.planilhas import (
    ABA_LIVE,
    ABA_MAIN,
    CABECALHO_LIVE,
    CABECALHO_MAIN,
    Aba,
    Link,
    linha_vaga,
    montar_xlsx,
    planilha_live,
)


def _normalizar_unica(linha: dict[str, object]) -> VagaDaPlanilha | LinhaIgnorada | ErroLinha:
    planilha = ler_planilha(planilha_live(linha))
    return normalizar_linha(planilha.linhas[0])


def _vaga(linha: dict[str, object]) -> VagaDaPlanilha:
    resultado = _normalizar_unica(linha)
    assert isinstance(resultado, VagaDaPlanilha), resultado
    return resultado


# --- Requirement: Localização da aba e do cabeçalho ---


def test_planilha_com_abas_main_e_live_le_a_aba_live_data_feed() -> None:
    conteudo = montar_xlsx(
        Aba(ABA_MAIN, CABECALHO_MAIN, [linha_vaga(ROLE="Do MAIN")], linha_cabecalho=5),
        Aba(ABA_LIVE, CABECALHO_LIVE, [linha_vaga(ROLE="Do Live")]),
    )

    planilha = ler_planilha(conteudo)

    assert planilha.aba == ABA_LIVE
    assert planilha.linhas[0].valores[Coluna.ROLE] == "Do Live"


def test_cabecalho_na_linha_5_e_encontrado_e_numero_da_linha_e_o_do_excel() -> None:
    conteudo = montar_xlsx(Aba(ABA_MAIN, CABECALHO_MAIN, [linha_vaga()], linha_cabecalho=5))

    planilha = ler_planilha(conteudo)

    assert planilha.aba == ABA_MAIN
    assert planilha.linhas[0].numero == 6


def test_cabecalho_com_grafia_diferente_e_reconhecido() -> None:
    assert identificar_coluna(" role ") == Coluna.ROLE
    assert identificar_coluna("Client") == Coluna.CLIENT
    assert identificar_coluna("Role ID") == Coluna.ID
    assert identificar_coluna("KEY   REQUIREMENTS") == Coluna.KEY_REQUIREMENTS
    assert identificar_coluna("JD PDF URL (sync helper)") == Coluna.JD_PDF_URL


def test_planilha_sem_role_e_client_nas_primeiras_linhas_e_recusada() -> None:
    conteudo = montar_xlsx(
        Aba("Outra", ("NOME", "EMAIL"), [{"NOME": "x"}]),
        Aba("Tardia", CABECALHO_LIVE, [], linha_cabecalho=LINHAS_VARRIDAS_PARA_CABECALHO + 1),
    )

    with pytest.raises(PlanilhaInvalidaError, match="ROLE e CLIENT"):
        ler_planilha(conteudo)


def test_arquivo_que_nao_e_planilha_e_recusado() -> None:
    with pytest.raises(PlanilhaInvalidaError, match="não pôde ser lido"):
        ler_planilha(b"isto nao e um xlsx")


def test_linhas_totalmente_vazias_nao_sao_lidas() -> None:
    planilha = ler_planilha(planilha_live(linha_vaga(), {}, linha_vaga(ROLE="Outro")))

    assert [linha.numero for linha in planilha.linhas] == [2, 4]


# --- Requirements: colunas de identificação, detalhe e JD ---


def test_linha_completa_preenche_identificacao_e_detalhes() -> None:
    vaga = _vaga(
        linha_vaga(
            ID="DSR-001",
            CLIENT="Acme",
            ROLE="Customer Support",
            Priority="Urgent",
            COUNTRY="Portugal",
            LOCATION="Lisbon",
            HEADCOUNT=3,
            **{"SALARY BUDGET": "1,250EUR per month (x14 salaries)", "KEY REQUIREMENTS": "A\nB\nC"},
        )
    )

    assert vaga.campos["codigo"] == "DSR-001"
    assert vaga.campos["cliente"] == "Acme"
    assert vaga.campos["cargo"] == "Customer Support"
    assert vaga.status == StatusVaga.ABERTA
    assert vaga.prioridade == Prioridade.ALTA
    assert vaga.campos["pais"] == "Portugal"
    assert vaga.campos["localizacao"] == "Lisbon"
    assert vaga.campos["headcount"] == "3"
    assert vaga.campos["faixa_salarial"] == "1,250EUR per month (x14 salaries)"
    assert vaga.campos["requisitos"] == "A\nB\nC"


def test_link_da_jd_vem_da_coluna_jd_pdf_url() -> None:
    vaga = _vaga(linha_vaga(JD="jd_support.pdf", **{"JD PDF URL (sync helper)": "https://exemplo.com/a.pdf"}))

    assert vaga.campos["jd_nome"] == "jd_support.pdf"
    assert vaga.campos["jd_url"] == "https://exemplo.com/a.pdf"


def test_link_da_jd_vem_do_hyperlink_da_celula_quando_coluna_url_vazia() -> None:
    vaga = _vaga(linha_vaga(JD=Link("jd_support.pdf", "https://exemplo.com/jd.pdf")))

    assert vaga.campos["jd_nome"] == "jd_support.pdf"
    assert vaga.campos["jd_url"] == "https://exemplo.com/jd.pdf"


def test_coluna_ausente_na_planilha_nao_entra_nos_campos() -> None:
    cabecalho_sem_beneficios = tuple(titulo for titulo in CABECALHO_LIVE if titulo != "Other benefits")
    planilha = ler_planilha(montar_xlsx(Aba(ABA_LIVE, cabecalho_sem_beneficios, [linha_vaga()])))

    vaga = normalizar_linha(planilha.linhas[0])

    assert isinstance(vaga, VagaDaPlanilha)
    assert "beneficios" not in vaga.campos
    assert vaga.campos["cargo"] == "Support Agent"


# --- Requirement: Normalização de valores ---


def test_espacos_na_maiusculas_e_na_sao_normalizados() -> None:
    vaga = _vaga(linha_vaga(CURRENCY="eur ", **{"Salary Type": "gross", "Other benefits": "N/A"}))

    assert vaga.campos["moeda"] == "EUR"
    assert vaga.campos["tipo_salario"] == "GROSS"
    assert vaga.campos["beneficios"] is None


@pytest.mark.parametrize("valor", ["", "  ", "NA", "na", "N/A", " n/a "])
def test_valores_vazios_viram_none(valor: str) -> None:
    assert texto(valor) is None


def test_data_real_vira_dd_mm_aaaa_e_texto_fica_como_esta() -> None:
    com_data = _vaga(linha_vaga(**{"START DATE": datetime(2026, 11, 16)}))
    com_texto = _vaga(linha_vaga(**{"START DATE": "ASAP (2 HC)"}))

    assert com_data.campos["data_inicio"] == "16/11/2026"
    assert com_texto.campos["data_inicio"] == "ASAP (2 HC)"


def test_moeda_euro_vira_eur_e_headcount_numerico_vira_texto_sem_ponto_zero() -> None:
    vaga = _vaga(linha_vaga(CURRENCY="Euro", HEADCOUNT=5.0))

    assert vaga.campos["moeda"] == "EUR"
    assert vaga.campos["headcount"] == "5"


def test_headcount_em_texto_livre_e_mantido() -> None:
    assert _vaga(linha_vaga(HEADCOUNT="30 per mo")).campos["headcount"] == "30 per mo"


# --- Requirements: mapeamento de status e prioridade ---


@pytest.mark.parametrize(
    ("valor", "esperado"),
    [
        ("OPEN", StatusVaga.ABERTA),
        ("CLOSE", StatusVaga.FECHADA),
        ("Closed", StatusVaga.FECHADA),
        ("on hold", StatusVaga.PAUSADA),
        ("ON-HOLD", StatusVaga.PAUSADA),
        ("Hold", StatusVaga.PAUSADA),
        (" paused ", StatusVaga.PAUSADA),
    ],
)
def test_status_reconhecidos(valor: str, esperado: StatusVaga) -> None:
    assert _vaga(linha_vaga(STATUS=valor)).status == esperado


def test_status_vazio_fica_none_para_a_aplicacao_decidir() -> None:
    assert _vaga(linha_vaga(STATUS=None)).status is None


def test_status_desconhecido_vira_erro_na_linha() -> None:
    resultado = _normalizar_unica(linha_vaga(STATUS="FILLED"))

    assert isinstance(resultado, ErroLinha)
    assert resultado.linha == 2
    assert "FILLED" in resultado.motivo


@pytest.mark.parametrize(
    ("valor", "esperado"),
    [
        ("Urgent ", Prioridade.ALTA),
        ("Active", Prioridade.MEDIA),
        ("Low priority", Prioridade.BAIXA),
        ("LOW  PRIORITY", Prioridade.BAIXA),
        (None, None),
        ("Someday", None),
    ],
)
def test_prioridades(valor: str | None, esperado: Prioridade | None) -> None:
    assert _vaga(linha_vaga(Priority=valor)).prioridade == esperado


# --- Requirement: Linhas ignoradas e linhas com erro ---


def test_linha_sem_role_e_ignorada_sem_erro() -> None:
    resultado = _normalizar_unica(linha_vaga(ROLE=None, ID="DSR-040"))

    assert isinstance(resultado, LinhaIgnorada)
    assert resultado.codigo == "DSR-040"


def test_linha_com_cliente_vazio_e_erro() -> None:
    resultado = _normalizar_unica(linha_vaga(CLIENT="  "))

    assert isinstance(resultado, ErroLinha)
    assert "cliente é obrigatório" in resultado.motivo


def test_valor_acima_do_limite_vira_erro_com_campo_tamanho_e_limite() -> None:
    resultado = _normalizar_unica(linha_vaga(LANGUAGE="x" * 250))

    assert isinstance(resultado, ErroLinha)
    assert resultado.motivo == "idioma com 250 caracteres (limite 200)"

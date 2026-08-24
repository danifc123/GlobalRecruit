# -*- coding: utf-8 -*-
"""Gera os SVGs de arvore de diretorios (backend/frontend, tema claro e
escuro), reaproveitando a linguagem visual do diagrama de arquitetura
(fontes, cores, grade de fundo). Roda com `python docs/gerar_arvore.py`
(ou de dentro de docs/, `python gerar_arvore.py`) -- sem dependencia
externa, so Python 3. Escreve sempre ao lado deste arquivo.

Pra atualizar depois de mudar a estrutura de pastas: edite BACKEND_RESUMO/
FRONTEND_RESUMO abaixo (mesma forma de tupla, ver exemplos) e rode de novo
-- os 4 arquivos (dark/light x backend/frontend) sao sobrescritos.
"""

import os

CANVAS_W = 1500
MARGIN_L = 40
MARGIN_R = 40
ROW_H = 26
INDENT = 22
COMENTARIO_X = 430  # coluna fixa (nao relativa a indentacao) -- evita nome
                     # de arquivo comprido em pasta funda colidir com o comentario
HEADER_H = 100
FOOTER_H = 40

DARK = {
    "bg": "#070b14", "bg_grid": "rgba(79,141,255,0.05)",
    "text": "#eaf1ff", "text_dim": "#8291b3", "icone_arquivo": "#64748b",
    "linha": "#1e2a45", "guia": "#2a3a5c",
    "root": "#4f8dff", "api": "#35ffa6", "core": "#b48bff", "db": "#ffa63d",
    "middleware": "#35e7ff", "schemas": "#4f8dff",
    "app_core": "#b48bff", "features": "#35ffa6", "layout": "#35e7ff", "shared": "#ffa63d",
}
LIGHT = {
    "bg": "#f7f9fc", "bg_grid": "rgba(37,99,235,0.06)",
    "text": "#16202e", "text_dim": "#5b6b82", "icone_arquivo": "#64748b",
    "linha": "#dbe3ee", "guia": "#c3cedd",
    "root": "#2563eb", "api": "#059669", "core": "#7c3aed", "db": "#c2670a",
    "middleware": "#0891b2", "schemas": "#2563eb",
    "app_core": "#7c3aed", "features": "#059669", "layout": "#0891b2", "shared": "#c2670a",
}

# formato de cada no: (nome, comentario, eh_dir, grupo, filhos)

BACKEND_RESUMO = ("backend/app/", None, True, "root", [
    ("main.py", "monta o FastAPI: CORS, rate limit, security headers e o api_router", False, "root", []),
    ("api/", "rotas REST — auth, vagas, candidatos, projetos_parceiros, dashboard, users", True, "api", []),
    ("core/", "config (.env), security (JWT + bcrypt), deps (guards de rota por papel)", True, "core", []),
    ("db/", "models SQLAlchemy — User, Vaga, Candidato, PipelineStage, ProjetoParceiro", True, "db", []),
    ("middleware/", "rate limit (slowapi) e headers de segurança", True, "middleware", []),
    ("schemas/", "contratos Pydantic de request/response", True, "schemas", []),
    ("seed_admin.py", "cria o primeiro usuário admin (script de terminal, sem cadastro público)", False, "root", []),
])

FRONTEND_RESUMO = ("globalRecruit/src/app/", None, True, "root", [
    ("core/", "AuthService, guard, interceptor, JWT — autenticação do lado do cliente", True, "app_core", []),
    ("features/", "dashboard, vagas-ativas/desativadas, pipeline-candidatos, banco-talentos, projetos-parceiros, admin, conta", True, "features", []),
    ("layout/", "shell, sidebar, bottom-nav — moldura da aplicação logada", True, "layout", []),
    ("shared/", "componentes de UI e utilitários reaproveitados entre features", True, "shared", []),
])


def coletar_linhas(children, depth, prefixo, linhas):
    for i, node in enumerate(children):
        nome, comentario, eh_dir, grupo, sub = node
        eh_ultimo = i == len(children) - 1
        linhas.append({
            "depth": depth, "nome": nome, "comentario": comentario,
            "eh_dir": eh_dir, "grupo": grupo, "prefixo": list(prefixo), "eh_ultimo": eh_ultimo,
        })
        if sub:
            coletar_linhas(sub, depth + 1, prefixo + [not eh_ultimo], linhas)


def escapar(texto):
    return (texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                 .replace('"', "&quot;"))


def gerar_svg(raiz, titulo_eyebrow, paleta):
    nome_raiz, _, _, _, filhos = raiz
    linhas = []
    coletar_linhas(filhos, 1, [], linhas)

    altura = HEADER_H + (len(linhas) + 1) * ROW_H + FOOTER_H
    partes = []
    partes.append(f'<svg viewBox="0 0 {CANVAS_W} {altura}" xmlns="http://www.w3.org/2000/svg">')
    partes.append(f"""  <style>
    <![CDATA[
    @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
    text {{ font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif; }}
    .eyebrow {{ font-family: 'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; letter-spacing: 0.24em; fill: {paleta["root"]}; opacity: 0.85; }}
    .raiz {{ font-family: 'Chakra Petch', 'Segoe UI', sans-serif; font-weight: 700; font-size: 22px; fill: {paleta["text"]}; }}
    .pasta {{ font-family: 'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace; font-weight: 600; font-size: 13px; }}
    .arquivo {{ font-family: 'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace; font-size: 13px; fill: {paleta["text"]}; }}
    .comentario {{ font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif; font-size: 12.5px; fill: {paleta["text_dim"]}; }}
    .guia {{ stroke: {paleta["guia"]}; stroke-width: 1.2; }}
    ]]>
  </style>
  <defs>
    <g id="ic-pasta"><path d="M2 5.5a1.5 1.5 0 0 1 1.5-1.5h3.4l1.3 1.6h6.3A1.5 1.5 0 0 1 16 7.1v6.4A1.5 1.5 0 0 1 14.5 15h-11A1.5 1.5 0 0 1 2 13.5Z"/></g>
    <g id="ic-arquivo"><path d="M4 2.5h6l3.5 3.5v9A1.5 1.5 0 0 1 12 16.5H4A1.5 1.5 0 0 1 2.5 15V4A1.5 1.5 0 0 1 4 2.5Z"/><path d="M10 2.5V6h3.5"/></g>
    <pattern id="grade-fundo-arvore" width="34" height="34" patternUnits="userSpaceOnUse">
      <path d="M34 0H0V34" fill="none" stroke="{paleta["bg_grid"]}" stroke-width="1" />
    </pattern>
  </defs>
""")
    partes.append(f'  <rect x="0" y="0" width="{CANVAS_W}" height="{altura}" fill="{paleta["bg"]}" />')
    partes.append(f'  <rect x="0" y="0" width="{CANVAS_W}" height="{altura}" fill="url(#grade-fundo-arvore)" />')

    partes.append(f'  <text class="eyebrow" x="{MARGIN_L}" y="34">{escapar(titulo_eyebrow)}</text>')
    partes.append(f'  <use href="#ic-pasta" x="{MARGIN_L}" y="52" width="22" height="22" fill="none" stroke="{paleta["root"]}" stroke-width="1.4" />')
    partes.append(f'  <text class="raiz" x="{MARGIN_L + 30}" y="68">{escapar(nome_raiz)}</text>')
    partes.append(f'  <line x1="{MARGIN_L}" y1="{HEADER_H - 12}" x2="{CANVAS_W - MARGIN_R}" y2="{HEADER_H - 12}" stroke="{paleta["linha"]}" stroke-width="1" />')

    for idx, linha in enumerate(linhas):
        y = HEADER_H + idx * ROW_H
        y_meio = y + ROW_H / 2
        depth = linha["depth"]
        cor = paleta[linha["grupo"]]

        # linhas-guia dos ancestrais (continuam para baixo quando o ancestral ainda tem irmao depois)
        for col, continua in enumerate(linha["prefixo"]):
            if continua:
                x = MARGIN_L + col * INDENT + 8
                partes.append(f'    <line class="guia" x1="{x}" y1="{y}" x2="{x}" y2="{y + ROW_H}" />')

        # conector do proprio item (canto ou T)
        x_col = MARGIN_L + (depth - 1) * INDENT + 8
        partes.append(f'    <line class="guia" x1="{x_col}" y1="{y}" x2="{x_col}" y2="{y_meio if linha["eh_ultimo"] else y + ROW_H}" />')
        partes.append(f'    <line class="guia" x1="{x_col}" y1="{y_meio}" x2="{x_col + 14}" y2="{y_meio}" />')

        x_icone = x_col + 18
        x_nome = x_icone + 20
        if linha["eh_dir"]:
            partes.append(f'    <use href="#ic-pasta" x="{x_icone}" y="{y_meio - 8}" width="16" height="16" fill="none" stroke="{cor}" stroke-width="1.5" />')
            partes.append(f'    <text class="pasta" x="{x_nome}" y="{y_meio + 4}" fill="{cor}">{escapar(linha["nome"])}</text>')
        else:
            partes.append(f'    <use href="#ic-arquivo" x="{x_icone}" y="{y_meio - 8}" width="15" height="15" fill="none" stroke="{paleta["icone_arquivo"]}" stroke-width="1.3" />')
            partes.append(f'    <text class="arquivo" x="{x_nome}" y="{y_meio + 4}">{escapar(linha["nome"])}</text>')

        if linha["comentario"]:
            partes.append(f'    <text class="comentario" x="{COMENTARIO_X}" y="{y_meio + 4}"># {escapar(linha["comentario"])}</text>')

    partes.append("</svg>")
    return "\n".join(partes)


if __name__ == "__main__":
    pasta = os.path.dirname(os.path.abspath(__file__))
    arvores = [
        (BACKEND_RESUMO, "ESTRUTURA DO PROJETO — BACKEND", "arvore-backend-resumo"),
        (FRONTEND_RESUMO, "ESTRUTURA DO PROJETO — FRONTEND", "arvore-frontend-resumo"),
    ]
    for raiz, titulo, prefixo_arquivo in arvores:
        for sufixo, paleta in (("dark", DARK), ("light", LIGHT)):
            caminho = os.path.join(pasta, f"{prefixo_arquivo}-{sufixo}.svg")
            with open(caminho, "w", encoding="utf-8") as f:
                f.write(gerar_svg(raiz, titulo, paleta))
            print(f"escrito: {caminho}")
    print("OK")

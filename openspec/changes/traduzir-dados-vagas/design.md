# Design

## Context

- Ver proposal.md (Why). Depende da change `importar-vagas-planilha` (campos novos da vaga, `services/`, suíte pytest), ainda no PR #15 — esta change deve ser implementada em branch criada a partir daquela (ou depois do merge).
- O i18n do frontend é um dicionário estático (`en.dictionary.ts`) que traduz PT→EN; não serve para dados dinâmicos.
- Volume medido: ~200 mil caracteres traduzíveis nas 136 vagas reais (média 1.365 por vaga, contando requisitos/benefícios/realocação/notas). Sem notas internas o volume é menor.
- DeepL (verificado na doc oficial em 2026-11-07): `POST /v2/translate`, plano Free em `https://api-free.deepl.com`, `target_lang: "PT-BR"` suportado, até 500 mil caracteres/mês no Free segundo a doc (a conta real configurada em 2026-11-07 mostrou limite de 1.000.000 em `/v2/usage`), requisição até 128 KiB, `/v2/usage` informa o consumo. Tratamento de dados do Free "pode diferir" do Pro (P4).

## Goals / Non-Goals

**Goals:**
- Traduzir cada texto uma única vez (cache por hash do original) e nunca bloquear o cadastro/importação.
- Trocar de provedor (DeepL ↔ Azure) sem mexer em regra de negócio.
- Testes sem rede: provedor substituído por fake nomeado.

**Non-Goals:**
- Fila/worker dedicado (Celery/RQ): o volume não justifica.
- Tradução no navegador (Chrome Translator API): desktop-only e refeita a cada visita.

## Decisions

1. **Tabela `vagas_traducoes`** (`vaga_id` FK com `ON DELETE CASCADE`, `campo`, `idioma` = `pt-BR`, `hash_original` SHA-256 do texto original, `texto`, `updated_at`; único em `(vaga_id, campo, idioma)`).
   - Alternativa: colunas `requisitos_pt`, `beneficios_pt`… na própria `vagas`. Rejeitada: precisaria de uma coluna de hash por campo (12 colunas) e outra migration a cada campo novo.
   - O hash decide se re-traduz: original igual ao hash guardado → não chama o serviço (cenário "Reimportação sem mudança").
2. **Interface `Tradutor`** (`Protocol` com `async traduzir(textos: list[str]) -> list[str]`) em `app/services/traducao/`, com `DeepLTradutor` (httpx async, timeout P8, até 50 textos por chamada, agrupando por tamanho < 128 KiB) e `TradutorDesativado` (sem chave: não traduz, loga uma vez). Fronteira de I/O → encapsulada, conforme a convenção.
3. **Disparo em segundo plano**: depois do `commit` de criar/editar/importar, a rota agenda `BackgroundTasks` com os ids das vagas afetadas; a tarefa abre sessão própria, calcula os campos pendentes (sem tradução ou hash diferente) e grava. A resposta HTTP não espera (P9). Se o processo reiniciar antes, os campos ficam pendentes e são pegos na próxima edição/importação ou pelo comando.
   - Alternativa: traduzir dentro da requisição. Rejeitada: a importação de 136 vagas esperaria várias chamadas externas.
   - Alternativa: traduzir sob demanda no GET em PT. Rejeitada: o primeiro usuário esperaria e GET passaria a escrever no banco.
4. **Resposta da API**: `VagaOut` ganha `traducoes: dict[str, str]` (só campos com tradução, idioma pt-BR). O frontend escolhe original ou tradução pelo idioma ativo — trocar de idioma não chama a API de novo.
5. **Comando** `python -m app.traduzir_vagas` (mesmo padrão do `seed_admin`): traduz pendentes de todas as vagas, em lotes, e imprime traduzidos/falhas/caracteres enviados.
6. **Configuração**: `DEEPL_API_KEY` opcional (ausente = tradução desativada) e `DEEPL_API_URL` com padrão `https://api-free.deepl.com`. Documentadas no `.env.example` sem valor real.
7. **Dependência**: `httpx` (já em `requirements-dev.txt` na versão 0.28.1) passa para `requirements.txt` como dependência de runtime — pede aprovação.
8. **Logs**: falhas registram status HTTP, quantidade de textos e caracteres — nunca o conteúdo das vagas nem a chave.

## Risks / Trade-offs

- [Texto das vagas enviado a terceiro; Free pode reter/treinar] → não enviar notas internas (P2); decisão de provedor registrada (P4); trocar para Pro/Azure é só configuração + outra implementação de `Tradutor`.
- [Cota mensal esgotada] → falha tratada como "sem tradução"; `/v2/usage` pode ser exibido no comando.
- [Tradução automática errada em termo técnico] → aviso "Tradução automática" + "Ver original" (P5).
- [BackgroundTasks perdida em reinício] → pendentes recuperados pelo hash na próxima ação ou pelo comando.
- [Concorrência: duas edições seguidas da mesma vaga] → a última tarefa grava pelo hash do original atual; upsert por `(vaga_id, campo, idioma)`.

## Migration Plan

1. `alembic upgrade head` (cria `vagas_traducoes`, aditiva).
2. Configurar `DEEPL_API_KEY` no Railway.
3. Rodar `python -m app.traduzir_vagas` uma vez (P6).
4. Rollback: remover a chave (desativa) ou `alembic downgrade` (apaga traduções; originais intactos).

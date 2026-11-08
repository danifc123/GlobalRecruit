# Proposal

## Why

O cliente (DS Recruitment Solutions) mantém as vagas numa planilha Excel ("Active Roles - Live Data Feed", ~136 linhas) e hoje precisaria redigitar cada vaga no GlobalRecruit, que além disso não tem lugar para boa parte das informações da planilha (Role ID, localização, headcount, data de início, faixa salarial em texto, moeda, benefícios, requisitos, notas internas, JD). Sem importação e sem esses campos, o sistema não substitui a planilha.

## What Changes

- A vaga passa a guardar os dados da planilha que hoje não têm lugar: código da vaga (Role ID), localização, headcount, data de início, faixa salarial (texto livre), moeda, tipo de salário, benefícios, realocação, requisitos, notas internas, nome e link da JD. Idioma, país e modalidade passam a aceitar textos mais longos.
- O valor numérico de salário já cadastrado passa a aparecer como faixa salarial; o cadastro novo deixa de pedir salário numérico.
- Nova ação de **importar planilha** (.xlsx) para um projeto: pré-visualização sem gravar (quantas vagas serão criadas, atualizadas, ignoradas e quais linhas têm erro) e confirmação que grava. Reimportar a mesma planilha atualiza, não duplica. Vagas que não estão na planilha nunca são apagadas.
- Mapeamento fixo de status (OPEN → Aberta, CLOSE/CLOSED → Fechada, ON-HOLD/HOLD/PAUSED → Pausada) e de prioridade (Urgent → Alta, Active → Média, Low priority → Baixa).
- No site em inglês, o status "Pausada" passa a se chamar **On-Hold** (Open e Closed continuam).
- Listagem de vagas passa a trazer até 500 vagas por página (hoje corta em 100).
- Tela de vagas: coluna com o código da vaga, país com localização, faixa salarial, headcount; busca também por código; formulário de vaga com os campos novos em 4 etapas.
- Detalhe da vaga mostra todos os campos novos e troca o botão "Fechar vaga" por um seletor de status Open / On-Hold / Closed.

## Capabilities

### New Capabilities
- `importacao-vagas`: importação de vagas a partir da planilha .xlsx do cliente — leitura, normalização, mapeamento de status/prioridade, pré-visualização e gravação idempotente dentro de um projeto.
- `vagas`: cadastro, edição, listagem, detalhe e status das vagas. Esta change especifica só a fatia mexida (campos novos, limite de listagem, troca de status pelo detalhe, rótulo On-Hold); o restante do comportamento atual de vagas não é especificado aqui.

### Modified Capabilities
<!-- Nenhuma: o projeto não tinha specs antes desta change. -->

## Não inclui

- A aba "Submission Status - Live" (candidatos submetidos) da planilha.
- Importação de outros formatos (.xls, .csv) ou de outras planilhas que não tenham as colunas ROLE e CLIENT.
- Apagar ou fechar automaticamente vagas que sumiram da planilha.
- Upload ou armazenamento do PDF da JD (só nome e link).
- Sincronização automática/periódica com a planilha (a importação é manual).
- Remover a coluna de salário numérico do banco.

## Decisões (respondidas pelo Daniel em 2026-11-06: todas as recomendações aceitas)

Cada `[DECISÃO Pn]` nas specs aponta para cá.

- **P1** Mesma chave (código+cargo) repetida no arquivo: a primeira ocorrência vale; as seguintes viram erro "duplicada da linha N".
- **P2** STATUS vazio: vaga nova entra Aberta; vaga existente mantém o status atual.
- **P3** STATUS desconhecido (ex.: "FILLED"): a linha vira erro e não é gravada.
- **P4** Priority vazia ou desconhecida: vaga nova entra Média; vaga existente mantém a prioridade atual. (O prompt original diz só "default media".)
- **P5** CLIENT vazio: erro na linha, porque cliente é obrigatório no sistema.
- **P6** Célula vazia em vaga existente: apaga o valor do campo (a planilha é a fonte da verdade); comissão, que não existe na planilha, nunca é alterada.
- **P7** Exigir pré-visualização antes de confirmar: sim; trocar projeto ou arquivo depois da prévia desabilita "Confirmar importação" até uma nova prévia.
- **P8** Limite dos textos longos (data de início, faixa salarial, benefícios, realocação, requisitos, notas internas): 10.000 caracteres cada.
- **P9** Hoje o botão "Fechar vaga" aparece também para o recrutador, que recebe 403 ao clicar: o seletor de status só aparece para admin/developer.

## Impact

- Backend: model/schemas/rotas de vaga, nova migration `0007`, novo endpoint de importação, nova dependência `openpyxl` (leitura de .xlsx), nova suíte de testes `pytest` (dependências de desenvolvimento `pytest`, `pytest-asyncio`, `httpx`).
- Frontend: model e serviço de vaga, telas Vagas Ativas, Detalhe da Vaga, Vagas Desativadas, dicionário EN.
- API: `GET /api/vagas` aceita `page_size` até 500; `VagaOut`/`VagaCreate`/`VagaUpdate` ganham campos (aditivo, sem quebra); novo `POST /api/vagas/importar`.
- Banco: colunas novas nullable em `vagas`; `idioma`, `pais`, `modalidade` aumentam de tamanho (compatível).
- Docs: README (domínio e rotas REST).

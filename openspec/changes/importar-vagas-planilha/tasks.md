# Tasks

## 1. Base de testes do backend

- [x] 1.1 Criar `backend/requirements-dev.txt` (pytest, pytest-asyncio, httpx, versões fixas) e instalar na `.venv`; verificar com `pip check`
- [x] 1.2 Criar `backend/tests/conftest.py` que cria/migra o banco `globalrecruit_test` no Postgres do Docker, sessão por teste com rollback, cliente HTTP e fábricas de usuário (admin, developer, recrutador) e projeto; verificar com um teste de fumaça de `GET /api/vagas` (401 sem token, 200 com admin)
- [x] 1.3 Registrar o comando único da suíte (`cd backend && .venv/Scripts/python -m pytest`) no README; verificar rodando o comando exatamente como documentado

## 2. Extrair regra de reabertura (refactor, commit separado)

- [x] 2.1 Teste de caracterização de `PATCH /vagas/{id}/status`: reabrir vaga fechada encerra candidato em entrevista e preserva contratado; verificar que passa antes do refactor
- [x] 2.2 Mover a regra para `encerrar_candidatos_em_andamento` em `backend/app/services/vagas.py` e usá-la em `update_status`; verificar que o teste 2.1 continua verde

## 3. Campos novos da vaga (backend)

- [x] 3.1 Testes de integração dos cenários de "Campos da vaga", "Salário numérico existente vira faixa salarial" e "Listagem de até 500" (falhando pelo motivo certo)
- [x] 3.2 Migration `0007` (colunas novas, tamanhos maiores, índice em `codigo`, cópia de `salario` para `faixa_salarial`, downgrade); verificar `alembic upgrade head`, `downgrade 0006` e `upgrade head` de novo no banco local
- [x] 3.3 Atualizar model, schemas (`VagaCreate`/`VagaUpdate`/`VagaOut`), `_LIST_COLUMNS`, retorno do `create_vaga` e `page_size le=500`; verificar testes 3.1 verdes

## 4. Importação (backend)

- [x] 4.1 Adicionar `openpyxl` (versão fixa) ao `requirements.txt` e instalar; verificar import na `.venv`
- [x] 4.2 Fixtures que geram .xlsx em memória (abas MAIN e Live Data Feed, cabeçalho em linhas diferentes, hyperlink na célula JD, datas reais e texto, "Urgent ", "NA", "eur ", ID duplicado com cargos diferentes, linha sem ROLE)
- [x] 4.3 Testes unitários de leitura e normalização (aba/cabeçalho, correspondência de colunas, normalização, status, prioridade, tamanho, linha ignorada) e implementação em `backend/app/services/importacao_vagas.py`; verificar testes verdes
- [x] 4.4 Testes de integração do endpoint (permissão, arquivo aceito, criar/atualizar sem duplicar, outro projeto, vaga fora da planilha, reabertura encerra candidatos, dry-run não grava, resumo) e implementação de `POST /api/vagas/importar`; verificar testes verdes
- [x] 4.5 Documentar no README a importação, o mapeamento de status/prioridade e as rotas REST novas/alteradas; verificar que as rotas citadas existem em `/docs`

## 5. Frontend: modelo, serviço e tela de vagas

- [x] 5.1 Atualizar `core/models/vaga.ts` e `core/data/vagas.service.ts` (campos novos, `importar(file, projetoId, dryRun)` com FormData) com teste Vitest do mapeamento snake_case ↔ camelCase e do FormData; verificar `ng test`
- [x] 5.2 `loadVagas` com `list(0, 500, 'aberta')` e vagas desativadas com `list(0, 500)`; tabela com código, "país · localização", faixa salarial, headcount e busca por código; verificar `ng build`, `npm run lint` e na tela com dados importados
- [x] 5.3 Wizard em 4 etapas (STEP_FIELDS, openEditForm, reset, payload sem salário numérico, modalidade com texto livre); verificar criando e editando uma vaga na tela
- [x] 5.4 Componente `importar-planilha` (projeto, arquivo, Pré-visualizar, Confirmar habilitado só após prévia, resumo, erros, recarregar lista), botão só para staff; teste Vitest do estado do botão Confirmar; verificar `ng test` e o fluxo completo na tela

## 6. Frontend: detalhe e tradução

- [x] 6.1 Detalhe (mobile e painel ≥1024px) com todos os campos novos, `white-space: pre-line`, link "Ver JD"; verificar na tela com vaga importada
- [x] 6.2 Seletor de status Aberta/Pausada/Fechada no lugar de "Fechar vaga", só para staff, usando `PATCH /vagas/{id}/status`; verificar pausando e reabrindo uma vaga na tela
  - Na tela (2026-11-06) só foi verificado pausar (PATCH 200, vaga saiu das ativas). Reabrir foi coberto pelos testes de integração do backend, não pela tela.
- [x] 6.3 Strings novas em `en.dictionary.ts` e "Pausada"/"pausada" → "On-Hold"/"on-hold"; verificar com o site em inglês que "Paused" não aparece em vagas desativadas

## 7. Verificação integrada

- [x] 7.1 Rodar suíte do backend, `ng test`, `ng build` e `npm run lint`; todos verdes
- [x] 7.2 Com a planilha real do cliente: dry-run (~136 linhas lidas, conferir erros), importação real, reimportação mostrando 0 criadas
  - Planilha real (2026-11-06, banco local, projeto separado): aba lida = Active Roles - Live Data Feed; prévia 136 novas / 0 ignoradas / 0 erros; importação real 136 (117 abertas, 19 fechadas; 41 alta, 90 média, 5 baixa; 131 com link da JD); reimportação 0 novas / 136 atualizadas; banco sem duplicatas; 146 vagas abertas listadas numa página. Antes, testado também com planilha sintética (casos de erro, que a real não tem).
- [ ] 7.3 Texto em linguagem simples para o cliente explicando as mudanças e o uso do botão de importar

## Workflow follow-up

- Revisão do Daniel e commits locais (português, Conventional Commits); push e PR só com autorização.
- Arquivar a change (`/opsx:archive`) depois do merge.

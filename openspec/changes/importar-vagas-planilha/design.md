# Design

## Context

- Backend FastAPI + SQLAlchemy async + Alembic + Postgres 16. As rotas de vaga (`backend/app/api/routes/vagas.py`) acessam o banco direto, sem camada de service/repository — diverge da convenção "Repository separado do service", mas é o padrão vigente do projeto.
- A regra "reabrir vaga encerra candidatos em andamento" está inline em `update_status` e precisa ser reaproveitada pela importação.
- Não existe suíte de testes no backend. O frontend tem Vitest (`@angular/build:unit-test` + jsdom) com só `app.spec.ts`.
- Banco local: Postgres do `backend/docker-compose.yml` em `localhost:5434`.
- A planilha real (`DS_Recruitment_Solutions___Recruiter_View_.xlsx`) não está no repositório nem nesta máquina; os testes não podem depender dela.

## Goals / Non-Goals

**Goals:**
- Parser/normalizador da planilha como funções puras, testáveis sem banco e sem HTTP.
- Importação idempotente e transacional: ou a planilha inteira (linhas válidas) é gravada, ou nada.
- Pré-visualização e importação real pelo mesmo código, diferindo só no commit.

**Non-Goals:**
- Introduzir camada repository em todas as rotas de vaga (refactor fora do escopo; sinalizado abaixo).
- Processamento assíncrono/fila: 136 linhas cabem numa requisição.

## Decisions

1. **Pacote novo `backend/app/services/importacao_vagas/`** com três módulos: `leitura.py` (`openpyxl`, `data_only=True`, `read_only=False` para ter acesso a hyperlinks; roda em threadpool por ser síncrono), `normalizacao.py` (linha → dados da vaga, linha ignorada ou erro; funções puras) e `aplicacao.py` (cruza com as vagas existentes do projeto e cria/atualiza). A rota fica em `api/routes/importacao_vagas.py` (router separado, mesmo prefixo `/vagas`), só valida o upload, chama o service e faz `commit` ou `rollback` conforme `dry_run`.
   - Na implementação virou pacote em vez de arquivo único para manter cada módulo abaixo de ~200 linhas.
   - Coluna ausente na planilha não altera o campo da vaga existente (só célula vazia apaga, P6) — decisão de implementação conservadora, coberta por teste.
   - Alternativa: tudo na rota, como as outras rotas de vaga. Rejeitada: a rota ficaria com centenas de linhas e sem teste unitário possível.
   - Alternativa: pandas. Rejeitada: dependência pesada (numpy) para ler ~136 linhas; openpyxl é o leitor padrão de .xlsx e já é o que o pandas usaria por baixo.
2. **Regra de reabertura extraída** para uma função `encerrar_candidatos_em_andamento(db, vaga_id)` em `backend/app/services/vagas.py`, usada por `update_status` e pela importação. Refactor em commit separado, coberto por teste de integração antes de mover.
3. **Dry-run = mesma transação com rollback.** O service executa tudo na sessão; com `dry_run=true` a rota faz `rollback` em vez de `commit`. Garante que prévia e importação real dão o mesmo resumo. Alternativa (só calcular sem tocar a sessão) rejeitada por duplicar caminhos.
4. **Chave de identificação** calculada em Python: carrega as vagas do projeto (`codigo`, `cargo`, `cliente`, `id`) uma vez e monta um dicionário com chave em `casefold()`. Evita N+1 (uma consulta por linha). Índice em `vagas.codigo` conforme o prompt.
5. **Validação de tamanho** pelos mesmos limites do schema `VagaCreate`; o service reusa os schemas Pydantic para validar cada linha e converte `ValidationError` em erro por linha (campo, tamanho recebido, limite).
6. **Upload**: lê no máximo 10 MB + 1 byte do `UploadFile`; acima disso devolve 413. Valida extensão `.xlsx` e abre com openpyxl dentro de `try`, convertendo erro de leitura (`InvalidFileException`, `BadZipFile`, `KeyError`) em 400.
7. **Migration `0007`**: `add_column` nullable para os campos novos, `alter_column` aumentando `idioma`/`pais`/`modalidade`, índice em `codigo`, `UPDATE vagas SET faixa_salarial = salario::text WHERE salario IS NOT NULL`. Downgrade remove colunas/índice e volta os tamanhos (falha se houver valor maior que o tamanho antigo — aceitável e documentado).
8. **Testes do backend**: `pytest` + `pytest-asyncio` + `httpx.AsyncClient` com `ASGITransport`. Banco de teste `globalrecruit_test` no mesmo Postgres do Docker, criado automaticamente pelo `conftest.py` e migrado com Alembic; cada teste roda numa transação revertida. Planilhas de teste geradas em memória com openpyxl (fixtures), cobrindo as variações observadas na planilha real. Dependências de teste em `backend/requirements-dev.txt`.
9. **Frontend**: `VagasService.importar(file, projetoId, dryRun)` com `FormData`; o painel de importação é um componente próprio em `features/vagas-ativas/importar-planilha/` (evita inchar `vagas-ativas.ts`, já com 346 linhas). Testes Vitest para o mapeamento do serviço e para o estado do painel (confirmar desabilitado sem prévia).
   - Detalhe da vaga: os dois layouts (mobile e painel ≥1024px) usam os mesmos componentes novos `vaga-info` (campos da planilha) e `vaga-status-select` (Aberta/Pausada/Fechada), em vez de duplicar marcação — e o `vaga-detalhe.scss`, já acima do orçamento, não cresce.
   - Troca de status no detalhe avisa a lista pelo `QuickCreateService.notificarStatusAlterado()` (mesmo canal pai↔filho já usado por "Editar vaga"), para a vaga pausada/fechada sair das ativas.
   - Novo `app-textarea` em `shared/ui` (mesmo contrato do `app-input`, reaproveita o `input.scss`) e ícone `upload`.
   - O PATCH de edição substitui todos os campos: `jd_nome`, que não aparece no formulário, é carregado da vaga e reenviado para não ser apagado.
   - Link da JD só vira link clicável se for `http(s)://` (vem da planilha; além da sanitização de `[href]` do Angular).

## Risks / Trade-offs

- [Planilha real difere das variações descritas no prompt] → testes usam fixtures sintéticas; validação final manual com a planilha real em dry-run antes de gravar (depende do Daniel enviar o arquivo).
- [openpyxl lendo arquivo malicioso (zip bomb / XML)] → limite de 10 MB, só admin/developer; openpyxl usa `defusedxml` se instalado — avaliar adicionar `defusedxml` (decisão pendente, ver Open Questions).
- [Upload grande consome memória/disco antes do limite de 10 MB: o FastAPI/python-multipart recebe o corpo inteiro antes de a rota checar o tamanho] → o endpoint só é acessível a admin/developer autenticado; limite de corpo no proxy/servidor (Railway/uvicorn) fica como melhoria separada.
- [Orçamento de SCSS do `vaga-detalhe` já estourado (10.9 kB vs 8 kB) e vai crescer] → hoje é só aviso; não altero o budget sem decisão.
- [Downgrade da 0007 falha se idioma/país/modalidade tiverem valores longos] → documentado na migration.
- [Rotas de vaga sem camada repository] → divergência existente da convenção; não corrigida aqui (refactor separado, se aprovado).

## Migration Plan

1. `alembic upgrade head` (0007) — aditiva, sem downtime.
2. Deploy do backend antes do frontend (frontend novo depende dos campos novos; backend novo é compatível com o frontend antigo).
3. Rollback: `alembic downgrade 0006` + deploy anterior.

## Open Questions

- Adicionar `defusedxml` como proteção extra na leitura de XML do .xlsx? (dependência nova, pede aprovação; não muda spec nem tarefas além de uma linha em requirements).

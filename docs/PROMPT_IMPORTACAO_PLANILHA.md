# Prompt — Importação da planilha do cliente (DS Recruitment Solutions)

> Cole o conteúdo abaixo (a partir de "Preciso de ajustes...") num novo chat do Claude
> e **anexe de novo a planilha** `DS_Recruitment_Solutions___Recruiter_View_.xlsx`.
> Nada foi alterado no código ainda — este arquivo é só o planejamento.

---

Preciso de ajustes no meu projeto GlobalRecruit (repo danifc123/GlobalRecruit). Backend em FastAPI + SQLAlchemy async + Alembic + Postgres (backend/), frontend em Angular 21 com componentes standalone e signals (globalRecruit/). Trabalhe na branch claude/beautiful-volta-ykoohd, faça commit e push no fim. Anexei a planilha do meu cliente (DS_Recruitment_Solutions___Recruiter_View_.xlsx).

## CONTEXTO JÁ LEVANTADO (não precisa investigar de novo)

1. NÃO existe hoje nenhuma funcionalidade de importar planilha no código (procurei em todas as branches: main, DEV, backup). Ela precisa ser criada do zero.

2. Model atual de Vaga (backend/app/db/models/vaga.py): id, projeto_id (FK projetos_parceiros, obrigatório), cliente String(200), cargo String(200), idioma String(50), pais String(100), modalidade String(50), salario Numeric, comissao Numeric, prioridade enum (baixa/media/alta), status enum (aberta/pausada/fechada), created_at.
   Arquivos envolvidos: backend/app/schemas/vaga.py (VagaCreate/VagaUpdate/VagaOut), backend/app/api/routes/vagas.py (_LIST_COLUMNS, create/update/status/prioridade; criar/editar é require_roles(Role.ADMIN), developer passa em tudo), última migration = backend/alembic/versions/0006_create_app_settings.py (revision "0006").
   Frontend: globalRecruit/src/app/core/models/vaga.ts, core/data/vagas.service.ts (converte snake_case <-> camelCase), features/vagas-ativas/vagas-ativas.ts/.html (tabela + wizard de 3 etapas no app-sheet), features/vagas-ativas/vaga-detalhe/ (painel de detalhe, só tem botão "Fechar vaga"), features/vagas-desativadas/ (lista pausada/fechada, botão reativar), core/i18n/en.dictionary.ts (tradução PT -> EN; o site roda em inglês pro cliente).

3. A planilha: usar a aba "Active Roles - Live Data Feed" (cabeçalho na linha 1, ~136 vagas). A aba "Active Roles - MAIN" tem o mesmo conteúdo via fórmulas, cabeçalho na linha 5. Colunas:
   STATUS | ID (Role ID, ex: DSR-001) | CLIENT | ROLE | Priority | LANGUAGE | JD (nome do PDF) | COUNTRY | LOCATION | ONSITE/REMOTE | HEADCOUNT | START DATE | SALARY BUDGET | CURRENCY | Salary Type | Other benefits | RELOCATION DETAILS | KEY REQUIREMENTS | INTERNAL NOTES | JD PDF URL (sync helper)
   Valores reais observados:
   - STATUS: "OPEN", "CLOSE"
   - Priority: "Active", "Urgent " (com espaço), "Low priority"
   - ID: tem duplicados com cargos diferentes (ex: DSR-002 aparece 2x) e algumas linhas sem ID
   - HEADCOUNT: majoritariamente número, mas tem "30 per mo", "multiple "
   - START DATE: mistura datas reais e texto ("ASAP", "16 Nov", várias linhas com "(2 HC)")
   - SALARY BUDGET: texto livre ("€1,700–€1,900/ month", "1,250EUR per month (x14 salaries)")
   - LANGUAGE pode passar de 50 chars; KEY REQUIREMENTS / INTERNAL NOTES são textos longos multilinha
   - Valores com espaço sobrando / maiúscula diferente ("EUR ", "gross"/"GROSS")
   - A aba "Submission Status - Live" (candidatos submetidos) NÃO faz parte deste escopo.

## O QUE O CLIENTE PEDIU
- "Cliente vou precisar sim" -> manter o campo Cliente (já existe).
- "Status só com Open, On-Hold, Closed" -> mapear para aberta/pausada/fechada. Na tradução EN trocar "Paused"/"paused" por "On-Hold"/"on-hold" (manter Open/Closed).
- "Priority fica a sua opção" -> manter as 3 prioridades (Alta/Média/Baixa = High/Medium/Low) e no import mapear: Urgent -> alta, Active -> media, Low priority -> baixa (default media).
- Trazer da planilha os dados que já existem no sistema + os novos.

## O QUE IMPLEMENTAR

### Backend
1. Migration 0007 adicionando em vagas (todos nullable):
   codigo String(50) (Role ID, com índice), localizacao String(200), headcount String(50), data_inicio Text, faixa_salarial Text, moeda String(30), tipo_salario String(50), beneficios Text, realocacao Text, requisitos Text, notas_internas Text, jd_nome String(300), jd_url String(1000).
   Aumentar idioma -> String(200), pais -> String(200), modalidade -> String(100).
   Copiar salario existente pra faixa_salarial (UPDATE vagas SET faixa_salarial = salario::text WHERE salario IS NOT NULL). Não apagar a coluna salario. Fazer downgrade.
2. Atualizar model, schemas (Create/Update/Out com os campos novos e max_length coerentes) e _LIST_COLUMNS / retornos em vagas.py.
3. Aumentar o limite do page_size do GET /vagas de le=100 para le=500 (com 136+ vagas a tela corta).
4. Adicionar openpyxl ao requirements.txt.
5. Novo endpoint POST /api/vagas/importar (admin; multipart: file .xlsx, projeto_id, dry_run bool):
   - Ler com openpyxl (data_only=True). Detectar automaticamente a aba e a linha de cabeçalho: varrer as 10 primeiras linhas de cada aba procurando uma linha que tenha ROLE e CLIENT; escolher a aba que casar mais colunas (a "Live Data Feed" ganha por ter "JD PDF URL").
   - Casar cabeçalhos de forma tolerante (strip, case-insensitive, espaços duplos; "ID" ou "Role ID").
   - Normalizar: strip em tudo, "NA"/"N/A"/"" -> None, datas datetime -> "dd/mm/yyyy", números -> string sem ".0". STATUS: OPEN->aberta, CLOSE/CLOSED->fechada, ON-HOLD/ON HOLD/HOLD/PAUSED->pausada. Moeda em maiúsculas, "EURO"->"EUR". Tipo salário em maiúsculas.
   - JD: jd_nome = coluna JD; jd_url = coluna "JD PDF URL" ou o hyperlink da célula JD se houver.
   - Ignorar linhas sem ROLE. Validar tamanhos (cortar ou reportar erro por linha).
   - Upsert dentro do projeto escolhido: chave = (codigo, cargo) case-insensitive; se não tiver codigo, (cliente, cargo). Existe -> atualiza; não existe -> cria. Nunca apagar vagas que não estão na planilha. Se a vaga mudar para aberta vindo de outro status, reaproveitar a mesma regra do update_status (candidatos em andamento viram "concluido") — extrair essa lógica para uma função.
   - Resposta: { criadas, atualizadas, ignoradas, erros: [{linha, motivo}], itens: [{linha, codigo, cargo, cliente, acao: "criar"|"atualizar"|"ignorar"}] }. Com dry_run=true não grava nada (só pré-visualização).
   - Limitar tamanho do arquivo (ex: 10 MB) e aceitar só .xlsx.

### Frontend
1. Atualizar model/serviço de Vaga com os campos novos e adicionar importar(file, projetoId, dryRun) no VagasService (FormData).
2. Vagas ativas: botão "Importar planilha" (ao lado de "Nova Vaga", só admin/developer — ver core/auth/is-staff.ts). Abre um app-sheet com: select de Projeto, input de arquivo .xlsx, botão "Pré-visualizar" (dry_run) mostrando resumo (X novas, Y atualizadas, Z ignoradas, lista de erros por linha), e botão "Confirmar importação". Depois recarrega a lista.
3. Mudar loadVagas para list(0, 500, 'aberta') e vagas-desativadas para list(0, 500).
4. Tabela: coluna "ID Vaga" mostra codigo (fallback id.slice(0,8)); País mostra "pais · localizacao"; Salário mostra faixa_salarial (fallback salario); adicionar coluna Headcount. Busca também por codigo.
5. Wizard de vaga em 4 etapas: (1) Projeto, Código, Cargo, Cliente; (2) País, Localização, Idioma, Modalidade (deixar texto livre além dos botões, porque a planilha tem "Hybrid after training/probation"), Headcount, Data de início; (3) Faixa salarial, Moeda, Tipo de salário (Bruto/Líquido), Comissão, Prioridade; (4) Requisitos, Benefícios, Realocação, Notas internas, Link da JD (textareas). Atualizar STEP_FIELDS, openEditForm, reset e payload. Parar de mandar o salario numérico.
6. Detalhe da vaga (os dois layouts, mobile e painel ≥1024px): mostrar todos os campos novos (código, localização, headcount, início, faixa salarial + moeda + tipo, benefícios, realocação, requisitos, notas internas com white-space: pre-line, link "Ver JD" se jd_url). Trocar o botão "Fechar vaga" por um seletor de status Open / On-Hold / Closed (usa PATCH /vagas/{id}/status).
7. Adicionar todas as strings novas no en.dictionary.ts (e "Pausada"->"On-Hold" etc.).

### Docs e verificação
- Atualizar README (seção Domínio + rotas REST) explicando a importação e o mapeamento de status/prioridade.
- Rodar `ng build` e `npm run lint` no globalRecruit/ e corrigir erros.
- Se der, subir Postgres (docker compose em backend/ ou o Postgres 16 local), rodar `alembic upgrade head` e testar o endpoint com a planilha anexada em dry_run e depois real, conferindo que ~136 linhas são lidas e que reimportar não duplica nada (só atualiza).
- Commits claros em português, push para claude/beautiful-volta-ykoohd. Não abrir PR sem eu pedir.

No final, me explique em linguagem simples o que mudou, pra eu repassar ao cliente (que não é da área de TI), incluindo como ele usa o botão de importar.

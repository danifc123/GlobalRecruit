# Spec Delta

## Purpose

Permite que o admin traga para o GlobalRecruit as vagas mantidas na planilha Excel do cliente, sem redigitar, podendo conferir o resultado antes de gravar e reimportar a planilha atualizada sem duplicar vagas.

## ADDED Requirements

### Requirement: Somente admin e developer importam
O sistema SHALL permitir a importação apenas a usuários com papel admin ou developer. Recrutador e usuário não autenticado MUST ser recusados sem que nada seja lido ou gravado.

#### Scenario: Recrutador tenta importar
- **GIVEN** um usuário autenticado com papel recrutador
- **WHEN** ele envia uma planilha para importação
- **THEN** o sistema recusa com "sem permissão" (HTTP 403) e nenhuma vaga é criada ou alterada

#### Scenario: Usuário não autenticado tenta importar
- **WHEN** uma importação é enviada sem token válido
- **THEN** o sistema recusa com "não autenticado" (HTTP 401)

#### Scenario: Admin importa
- **GIVEN** um usuário autenticado com papel admin
- **WHEN** ele envia uma planilha válida para um projeto existente
- **THEN** o sistema processa a planilha e devolve o resumo da importação

### Requirement: Arquivo aceito
O sistema SHALL aceitar somente arquivo .xlsx de até 10 MB, associado a um projeto parceiro existente. Fora disso, MUST recusar a requisição inteira com mensagem que diga o motivo, sem gravar nada.

#### Scenario: Arquivo com extensão diferente de .xlsx
- **WHEN** o admin envia um arquivo .csv ou .xls
- **THEN** o sistema recusa (HTTP 400) com mensagem informando que só .xlsx é aceito

#### Scenario: Arquivo acima de 10 MB
- **WHEN** o admin envia um .xlsx com mais de 10 MB
- **THEN** o sistema recusa (HTTP 413) com mensagem informando o limite de 10 MB

#### Scenario: Arquivo .xlsx corrompido ou que não é planilha
- **WHEN** o admin envia um arquivo com extensão .xlsx que não abre como planilha
- **THEN** o sistema recusa (HTTP 400) com mensagem informando que o arquivo não pôde ser lido

#### Scenario: Projeto inexistente
- **WHEN** o admin envia uma planilha válida indicando um projeto que não existe
- **THEN** o sistema recusa (HTTP 404) com "Projeto não encontrado" e nada é gravado

### Requirement: Localização da aba e do cabeçalho
O sistema SHALL procurar, nas 10 primeiras linhas de cada aba, uma linha de cabeçalho que contenha as colunas ROLE e CLIENT, e usar a aba cujo cabeçalho reconhece mais colunas conhecidas. Nomes de coluna MUST ser comparados ignorando maiúsculas/minúsculas, espaços nas pontas e espaços repetidos; "ID" e "Role ID" são a mesma coluna.

#### Scenario: Planilha do cliente com duas abas de vagas
- **GIVEN** a planilha tem a aba "Active Roles - MAIN" (cabeçalho na linha 5) e a aba "Active Roles - Live Data Feed" (cabeçalho na linha 1, com a coluna "JD PDF URL")
- **WHEN** ela é importada
- **THEN** o sistema lê a aba "Active Roles - Live Data Feed"

#### Scenario: Cabeçalho com grafia diferente
- **GIVEN** uma aba cujo cabeçalho tem " role ", "Client" e "Role ID"
- **WHEN** ela é importada
- **THEN** as três colunas são reconhecidas como ROLE, CLIENT e ID

#### Scenario: Nenhuma aba com ROLE e CLIENT
- **WHEN** o admin envia um .xlsx sem nenhuma aba que tenha ROLE e CLIENT nas 10 primeiras linhas
- **THEN** o sistema recusa (HTTP 400) com mensagem informando que as colunas ROLE e CLIENT não foram encontradas

### Requirement: Colunas de identificação da vaga
O sistema SHALL preencher a vaga a partir das colunas: ID → código; CLIENT → cliente; ROLE → cargo; STATUS → status; Priority → prioridade.

#### Scenario: Identificação completa
- **GIVEN** uma linha com ID "DSR-001", CLIENT "Acme", ROLE "Customer Support", STATUS "OPEN" e Priority "Urgent"
- **WHEN** a planilha é importada
- **THEN** existe uma vaga com código "DSR-001", cliente "Acme", cargo "Customer Support", status Aberta e prioridade Alta

### Requirement: Colunas de detalhe da vaga
O sistema SHALL preencher a vaga a partir das colunas: LANGUAGE → idioma; COUNTRY → país; LOCATION → localização; ONSITE/REMOTE → modalidade; HEADCOUNT → headcount; START DATE → data de início; SALARY BUDGET → faixa salarial; CURRENCY → moeda; Salary Type → tipo de salário; Other benefits → benefícios; RELOCATION DETAILS → realocação; KEY REQUIREMENTS → requisitos; INTERNAL NOTES → notas internas.

#### Scenario: Detalhes completos
- **GIVEN** uma linha com COUNTRY "Portugal", LOCATION "Lisbon", HEADCOUNT 3, SALARY BUDGET "1,250EUR per month (x14 salaries)" e KEY REQUIREMENTS com 3 linhas de texto
- **WHEN** a planilha é importada
- **THEN** a vaga tem país "Portugal", localização "Lisbon", headcount "3", faixa salarial "1,250EUR per month (x14 salaries)" e requisitos com as mesmas 3 linhas

### Requirement: Nome e link da JD
O sistema SHALL usar a coluna JD como nome da JD. O link da JD MUST vir da coluna "JD PDF URL"; se ela estiver vazia, do hyperlink da célula JD, se houver.

#### Scenario: Link na coluna JD PDF URL
- **GIVEN** uma linha com JD "jd_support.pdf" e JD PDF URL "https://exemplo.com/a.pdf"
- **WHEN** a planilha é importada
- **THEN** a vaga tem nome da JD "jd_support.pdf" e link da JD "https://exemplo.com/a.pdf"

#### Scenario: Link da JD vindo do hyperlink da célula
- **GIVEN** uma linha sem valor em "JD PDF URL" cuja célula JD tem o texto "jd_support.pdf" e um hyperlink para "https://exemplo.com/jd.pdf"
- **WHEN** a planilha é importada
- **THEN** a vaga tem nome da JD "jd_support.pdf" e link da JD "https://exemplo.com/jd.pdf"

#### Scenario: Coluna ausente na planilha
- **GIVEN** uma planilha sem a coluna "Other benefits"
- **WHEN** ela é importada
- **THEN** as vagas são criadas com os demais campos preenchidos e o campo benefícios vazio

### Requirement: Normalização de valores
O sistema SHALL remover espaços nas pontas de todo valor e tratar "", "NA" e "N/A" (sem diferenciar maiúsculas) como vazio. Data MUST virar texto "dd/mm/aaaa"; número inteiro MUST virar texto sem ".0"; moeda e tipo de salário MUST ficar em maiúsculas, com "EURO" virando "EUR". Texto livre (ex.: "ASAP", "30 per mo") MUST ser mantido como está.

#### Scenario: Espaços, NA e maiúsculas
- **GIVEN** uma linha com CURRENCY "eur ", Salary Type "gross" e Other benefits "N/A"
- **WHEN** a planilha é importada
- **THEN** a vaga tem moeda "EUR", tipo de salário "GROSS" e benefícios vazio

#### Scenario: Data real e texto na data de início
- **GIVEN** uma linha com START DATE igual à data 16/11/2026 e outra com START DATE "ASAP (2 HC)"
- **WHEN** a planilha é importada
- **THEN** as vagas têm data de início "16/11/2026" e "ASAP (2 HC)", respectivamente

#### Scenario: Moeda escrita por extenso e headcount numérico
- **GIVEN** uma linha com CURRENCY "Euro" e HEADCOUNT 5 (número)
- **WHEN** a planilha é importada
- **THEN** a vaga tem moeda "EUR" e headcount "5"

### Requirement: Mapeamento de status
O sistema SHALL mapear STATUS (sem diferenciar maiúsculas, ignorando espaços nas pontas): OPEN → Aberta; CLOSE ou CLOSED → Fechada; ON-HOLD, ON HOLD, HOLD ou PAUSED → Pausada. [DECISÃO P2] [DECISÃO P3]

#### Scenario: Status reconhecidos
- **GIVEN** três linhas com STATUS "OPEN", "CLOSE" e "on hold"
- **WHEN** a planilha é importada
- **THEN** as vagas ficam Aberta, Fechada e Pausada, respectivamente

#### Scenario: Status vazio em vaga nova
- **GIVEN** uma linha sem STATUS que não corresponde a nenhuma vaga existente
- **WHEN** a planilha é importada
- **THEN** a vaga é criada com status Aberta

#### Scenario: Status desconhecido
- **GIVEN** a linha 12 com STATUS "FILLED"
- **WHEN** a planilha é importada
- **THEN** a linha 12 aparece nos erros com motivo informando o status não reconhecido e nenhuma vaga é criada ou alterada por ela

### Requirement: Mapeamento de prioridade
O sistema SHALL mapear Priority (sem diferenciar maiúsculas, ignorando espaços nas pontas): Urgent → Alta; Active → Média; Low priority → Baixa. [DECISÃO P4]

#### Scenario: Prioridades reconhecidas
- **GIVEN** três linhas com Priority "Urgent " (com espaço), "Active" e "Low priority"
- **WHEN** a planilha é importada
- **THEN** as vagas ficam com prioridade Alta, Média e Baixa, respectivamente

#### Scenario: Prioridade vazia em vaga nova
- **GIVEN** uma linha sem Priority que não corresponde a nenhuma vaga existente
- **WHEN** a planilha é importada
- **THEN** a vaga é criada com prioridade Média

### Requirement: Linhas ignoradas e linhas com erro
O sistema SHALL ignorar (sem erro) linhas sem ROLE. Linha com CLIENT vazio [DECISÃO P5] ou com valor maior que o limite do campo MUST ser reportada como erro com o número da linha na planilha e o motivo, e não MUST ser gravada; as demais linhas seguem sendo processadas.

#### Scenario: Linha sem ROLE
- **GIVEN** a linha 40 tem CLIENT preenchido e ROLE vazio
- **WHEN** a planilha é importada
- **THEN** a linha 40 é contada como ignorada e não aparece nos erros

#### Scenario: Valor acima do limite
- **GIVEN** a linha 15 tem LANGUAGE com 250 caracteres e o limite de idioma é 200
- **WHEN** a planilha é importada
- **THEN** a linha 15 aparece nos erros com motivo citando o campo idioma, o tamanho recebido (250) e o limite (200), e as outras linhas válidas são gravadas

#### Scenario: Cliente vazio
- **GIVEN** a linha 20 tem ROLE preenchido e CLIENT vazio
- **WHEN** a planilha é importada
- **THEN** a linha 20 aparece nos erros com motivo informando que cliente é obrigatório

### Requirement: Criar ou atualizar sem duplicar
Dentro do projeto escolhido, o sistema SHALL identificar a vaga pelo par (código, cargo), sem diferenciar maiúsculas; sem código, pelo par (cliente, cargo). Se a vaga existe, MUST ser atualizada; senão, MUST ser criada. [DECISÃO P1] [DECISÃO P6]

#### Scenario: Chave repetida na mesma planilha
- **GIVEN** as linhas 8 e 30 têm ID "DSR-003" e ROLE "Sales Agent"
- **WHEN** a planilha é importada
- **THEN** a linha 8 é gravada e a linha 30 aparece nos erros com motivo "duplicada da linha 8"

#### Scenario: Célula vazia em vaga existente
- **GIVEN** a vaga "DSR-004" tem benefícios "Meal card" e comissão 300
- **WHEN** é importada uma linha "DSR-004" com Other benefits vazio
- **THEN** a vaga fica com benefícios vazio e comissão 300

#### Scenario: Reimportar a mesma planilha
- **GIVEN** a planilha já foi importada uma vez no projeto P
- **WHEN** a mesma planilha é importada de novo no projeto P
- **THEN** o resumo mostra 0 criadas, o número de vagas do projeto P não muda e as linhas aparecem como atualizadas

#### Scenario: Mesmo código com cargos diferentes
- **GIVEN** duas linhas com ID "DSR-002", uma com ROLE "Support Agent" e outra com ROLE "Team Lead"
- **WHEN** a planilha é importada num projeto sem vagas
- **THEN** duas vagas são criadas

#### Scenario: Vaga sem código já existente
- **GIVEN** o projeto P tem a vaga de cliente "Acme" e cargo "Support Agent" sem código
- **WHEN** é importada uma linha sem ID com CLIENT "ACME" e ROLE "support agent"
- **THEN** essa vaga é atualizada e nenhuma vaga nova é criada

### Requirement: Vagas fora da planilha não mudam
A importação SHALL alterar somente vagas do projeto escolhido que correspondam a uma linha da planilha. Vagas do projeto ausentes da planilha e vagas de outros projetos MUST permanecer inalteradas.

#### Scenario: Vaga fora da planilha
- **GIVEN** o projeto P tem a vaga "DSR-999" que não está na planilha
- **WHEN** a planilha é importada no projeto P
- **THEN** a vaga "DSR-999" continua existindo com os mesmos dados e status

#### Scenario: Mesma vaga em outro projeto
- **GIVEN** o projeto Q tem a vaga "DSR-001" / "Customer Support"
- **WHEN** a planilha com essa vaga é importada no projeto P
- **THEN** uma vaga nova é criada no projeto P e a vaga do projeto Q fica inalterada

### Requirement: Reabertura pela importação encerra candidatos em andamento
Quando a importação muda uma vaga existente de Pausada ou Fechada para Aberta, o sistema SHALL aplicar a mesma regra da reativação manual: candidatos dessa vaga cujo estágio atual é triagem, entrevista ou proposta passam para "concluído"; contratados e rejeitados não mudam.

#### Scenario: Vaga fechada reaberta pela planilha
- **GIVEN** a vaga "DSR-010" está Fechada e tem um candidato em entrevista e um contratado
- **WHEN** é importada uma linha "DSR-010" com STATUS "OPEN"
- **THEN** a vaga fica Aberta, o candidato que estava em entrevista fica com estágio "concluído" e o contratado continua contratado

#### Scenario: Vaga já aberta continua aberta
- **GIVEN** a vaga "DSR-011" está Aberta e tem um candidato em triagem
- **WHEN** é importada uma linha "DSR-011" com STATUS "OPEN"
- **THEN** o candidato continua em triagem

### Requirement: Pré-visualização sem gravar
O sistema SHALL oferecer a importação em modo pré-visualização, que devolve exatamente o mesmo resumo da importação real sem criar, alterar ou encerrar nada.

#### Scenario: Pré-visualização seguida de importação real
- **GIVEN** um projeto P com 0 vagas e uma planilha com 136 linhas de vaga válidas e únicas
- **WHEN** o admin pede a pré-visualização
- **THEN** o resumo mostra 136 a criar e o projeto P continua com 0 vagas
- **AND WHEN** o admin confirma a importação
- **THEN** o projeto P passa a ter 136 vagas

### Requirement: Resumo da importação
O sistema SHALL devolver, na pré-visualização e na importação real: quantidade de vagas criadas, atualizadas e linhas ignoradas; a lista de erros (número da linha na planilha e motivo); e, para cada linha processada, o número da linha, código, cargo, cliente e a ação (criar, atualizar ou ignorar).

#### Scenario: Resumo com mistura de resultados
- **GIVEN** uma planilha com 2 vagas novas, 1 vaga já existente, 1 linha sem ROLE e 1 linha com STATUS desconhecido
- **WHEN** ela é importada
- **THEN** o resumo mostra 2 criadas, 1 atualizada, 1 ignorada e 1 erro com o número da linha e o motivo

### Requirement: Tela de importação
Na tela de vagas ativas, admin e developer SHALL ver o botão "Importar planilha", que abre um painel com escolha de projeto, escolha de arquivo .xlsx, botão "Pré-visualizar" e botão "Confirmar importação". O recrutador MUST não ver o botão.

#### Scenario: Recrutador na tela de vagas
- **GIVEN** um recrutador logado
- **WHEN** ele abre a tela de vagas ativas
- **THEN** o botão "Importar planilha" não aparece

[DECISÃO P7]

#### Scenario: Confirmar só depois de pré-visualizar
- **GIVEN** o admin escolheu projeto e arquivo e ainda não pré-visualizou
- **WHEN** ele olha o painel de importação
- **THEN** o botão "Confirmar importação" está desabilitado

#### Scenario: Pré-visualizar e confirmar
- **GIVEN** o admin escolheu projeto e arquivo
- **WHEN** ele clica em "Pré-visualizar"
- **THEN** o painel mostra quantas vagas serão criadas, atualizadas e ignoradas e a lista de erros por linha
- **AND WHEN** ele clica em "Confirmar importação"
- **THEN** a importação é gravada, o painel mostra o resultado e a lista de vagas ativas é recarregada

#### Scenario: Falha na importação
- **WHEN** o servidor recusa a planilha (ex.: arquivo não é .xlsx)
- **THEN** o painel mostra a mensagem de erro devolvida e nada é recarregado

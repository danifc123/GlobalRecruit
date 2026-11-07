# Spec Delta

## Purpose

Cadastro, edição, listagem, detalhe e status das vagas de cada projeto parceiro. Nesta change só está especificada a fatia alterada: os campos vindos da planilha do cliente, o limite da listagem, a troca de status pelo detalhe e o rótulo On-Hold.

## ADDED Requirements

### Requirement: Campos da vaga
A vaga SHALL ter, além dos campos atuais, os campos opcionais de texto: código, localização, headcount, data de início, faixa salarial, moeda, tipo de salário, benefícios, realocação, requisitos, notas internas, nome da JD e link da JD.

#### Scenario: Cadastro sem os campos opcionais
- **WHEN** um admin cadastra uma vaga só com projeto, cliente, cargo e prioridade
- **THEN** a vaga é criada com os campos novos vazios

### Requirement: Limites de tamanho dos campos de texto
O sistema SHALL recusar valores acima dos limites: código 50; localização 200; headcount 50; moeda 30; tipo de salário 50; nome da JD 300; link da JD 1000; idioma 200; país 200; modalidade 100. [DECISÃO P8]

#### Scenario: Cadastro com campos novos
- **GIVEN** um admin
- **WHEN** ele cadastra uma vaga com código "DSR-050", localização "Porto", headcount "multiple", faixa salarial "€1,700–€1,900/ month", moeda "EUR" e requisitos em várias linhas
- **THEN** ao abrir a vaga, todos esses valores aparecem exatamente como foram enviados, incluindo as quebras de linha dos requisitos

#### Scenario: Valor acima do limite no cadastro
- **WHEN** um admin cadastra uma vaga com código de 51 caracteres
- **THEN** o sistema recusa (HTTP 422) indicando o campo código e nada é gravado

#### Scenario: Vaga antiga sem campos novos
- **GIVEN** uma vaga cadastrada antes desta mudança
- **WHEN** ela é listada ou aberta
- **THEN** os campos novos aparecem vazios e os campos antigos não mudam

### Requirement: Salário numérico existente vira faixa salarial
Ao aplicar a mudança, toda vaga com salário numérico preenchido SHALL passar a ter esse valor como faixa salarial. O salário numérico MUST continuar guardado e não MUST mais ser pedido no formulário.

#### Scenario: Vaga com salário 2500
- **GIVEN** uma vaga com salário 2500 antes da mudança
- **WHEN** a mudança é aplicada
- **THEN** a vaga mostra faixa salarial "2500.00" e o salário numérico continua 2500

#### Scenario: Formulário sem salário numérico
- **WHEN** o admin abre o formulário de nova vaga
- **THEN** não há campo de salário numérico, e sim faixa salarial, moeda e tipo de salário

### Requirement: Listagem de até 500 vagas por página
A listagem de vagas SHALL aceitar até 500 vagas por página. As telas de vagas ativas e vagas desativadas MUST pedir 500 por página.

#### Scenario: Projeto com 136 vagas abertas
- **GIVEN** 136 vagas abertas visíveis para o usuário
- **WHEN** ele abre a tela de vagas ativas
- **THEN** as 136 vagas aparecem

#### Scenario: Pedido acima do limite
- **WHEN** a listagem é pedida com 501 vagas por página
- **THEN** o sistema recusa (HTTP 422)

### Requirement: Tabela de vagas mostra dados da planilha
A tabela de vagas ativas SHALL mostrar: na coluna de identificação, o código (sem código, os 8 primeiros caracteres do id); no país, "país · localização" (só o que existir); no salário, a faixa salarial (sem ela, o salário numérico); e uma coluna Headcount. A busca MUST encontrar vagas também pelo código.

#### Scenario: Vaga importada na tabela
- **GIVEN** uma vaga com código "DSR-001", país "Portugal", localização "Lisbon", faixa salarial "1,250EUR per month" e headcount "3"
- **WHEN** a tabela de vagas ativas é exibida
- **THEN** a linha mostra "DSR-001", "Portugal · Lisbon", "1,250EUR per month" e "3"

#### Scenario: Busca por código
- **WHEN** o usuário digita "dsr-001" na busca
- **THEN** a vaga de código "DSR-001" aparece no resultado

### Requirement: Formulário de vaga em 4 etapas
O formulário de criar/editar vaga SHALL ter 4 etapas: (1) projeto, código, cargo, cliente; (2) país, localização, idioma, modalidade, headcount, data de início; (3) faixa salarial, moeda, tipo de salário (Bruto/Líquido), comissão, prioridade; (4) requisitos, benefícios, realocação, notas internas, link da JD. Modalidade MUST aceitar texto livre além das opções prontas.

#### Scenario: Modalidade fora das opções
- **WHEN** o admin cadastra uma vaga com modalidade "Hybrid after training/probation"
- **THEN** a vaga é salva com essa modalidade

#### Scenario: Editar vaga importada
- **GIVEN** uma vaga importada com requisitos e notas internas
- **WHEN** o admin abre a edição
- **THEN** a etapa 4 vem preenchida com os requisitos e as notas internas atuais

### Requirement: Detalhe da vaga mostra todos os campos
O detalhe da vaga (celular e painel em telas a partir de 1024px) SHALL mostrar código, localização, headcount, data de início, faixa salarial com moeda e tipo, benefícios, realocação, requisitos e notas internas, preservando quebras de linha, e um link "Ver JD" quando houver link da JD.

#### Scenario: Vaga com link da JD
- **GIVEN** uma vaga com link da JD "https://exemplo.com/jd.pdf"
- **WHEN** o detalhe é aberto
- **THEN** aparece o link "Ver JD" apontando para esse endereço, abrindo em nova aba

#### Scenario: Vaga sem link da JD
- **WHEN** o detalhe de uma vaga sem link da JD é aberto
- **THEN** o link "Ver JD" não aparece

### Requirement: Troca de status pelo detalhe
O detalhe da vaga SHALL ter um seletor de status com Aberta, Pausada e Fechada no lugar do botão "Fechar vaga", visível para admin e developer. Trocar o status MUST seguir a mesma regra já existente de status, inclusive encerrar candidatos em andamento ao reabrir. [DECISÃO P9]

#### Scenario: Pausar pelo detalhe
- **GIVEN** um admin no detalhe de uma vaga Aberta
- **WHEN** ele escolhe Pausada no seletor
- **THEN** a vaga passa a Pausada e sai da lista de vagas ativas

#### Scenario: Recrutador no detalhe
- **GIVEN** um recrutador no detalhe de uma vaga
- **WHEN** a tela é exibida
- **THEN** o seletor de status não aparece

### Requirement: Rótulo On-Hold no site em inglês
Com o site em inglês, o status Pausada SHALL aparecer como "On-Hold" (e "on-hold" em minúsculas); Aberta e Fechada continuam "Open" e "Closed". Em português, os rótulos não mudam.

#### Scenario: Vaga pausada em inglês
- **GIVEN** o site em inglês e uma vaga Pausada
- **WHEN** a lista de vagas desativadas é exibida
- **THEN** o status aparece como "On-Hold" e a palavra "Paused" não aparece

#### Scenario: Vaga pausada em português
- **GIVEN** o site em português e uma vaga Pausada
- **WHEN** a lista de vagas desativadas é exibida
- **THEN** o status aparece como "Pausada"

# Spec Delta

## Purpose

Mostra em português do Brasil os textos das vagas que vêm em inglês da planilha do cliente, quando o site está em português, sem que a tradução automática atrapalhe o cadastro e a importação de vagas.

## ADDED Requirements

### Requirement: Campos traduzidos
O sistema SHALL manter uma versão em português do Brasil dos campos requisitos, benefícios, realocação, modalidade, data de início e faixa salarial de cada vaga. Os demais campos MUST NOT ser traduzidos. [DECISÃO P1] [DECISÃO P2] [DECISÃO P3]

#### Scenario: Vaga com requisitos em inglês
- **GIVEN** uma vaga com requisitos "Fluent German (C1)" e benefícios "Meal card"
- **WHEN** a tradução da vaga é gerada
- **THEN** a vaga tem requisitos em português e benefícios em português guardados no sistema

#### Scenario: Campos que não são traduzidos
- **GIVEN** uma vaga com cargo "Customer Support Agent", país "Portugal" e notas internas "Client prefers Lisbon"
- **WHEN** a tradução da vaga é gerada
- **THEN** nenhuma versão em português é guardada para cargo, país e notas internas

### Requirement: Momento da tradução
O sistema SHALL gerar a tradução de um campo quando a vaga é criada, editada ou importada e o texto original daquele campo é novo ou mudou. Campo cujo texto original não mudou MUST NOT ser traduzido de novo. Campo vazio MUST NOT ser enviado para tradução. Salvar ou importar MUST NOT esperar a tradução terminar. [DECISÃO P7] [DECISÃO P9]

#### Scenario: Reimportação sem mudança de texto
- **GIVEN** uma vaga importada cujos requisitos já têm tradução
- **WHEN** a mesma planilha é importada de novo sem alteração nos requisitos
- **THEN** nenhum texto é enviado ao serviço de tradução

#### Scenario: Requisitos alterados na edição
- **GIVEN** uma vaga com requisitos traduzidos
- **WHEN** um admin edita os requisitos para "English B2"
- **THEN** a tradução dos requisitos passa a corresponder a "English B2" e a dos outros campos não é refeita

#### Scenario: Campo esvaziado
- **GIVEN** uma vaga com benefícios traduzidos
- **WHEN** a vaga é atualizada com benefícios vazios
- **THEN** a vaga deixa de ter tradução de benefícios

### Requirement: Exibição conforme o idioma do site
Com o site em português, o sistema SHALL exibir a versão traduzida dos campos traduzíveis que tiverem tradução; campo sem tradução MUST aparecer no original. Com o site em inglês, todos os campos MUST aparecer no original.

#### Scenario: Site em português
- **GIVEN** uma vaga com requisitos traduzidos para "Alemão fluente (C1)"
- **WHEN** o usuário abre o detalhe da vaga com o site em português
- **THEN** os requisitos aparecem como "Alemão fluente (C1)"

#### Scenario: Site em inglês
- **GIVEN** a mesma vaga
- **WHEN** o usuário abre o detalhe com o site em inglês
- **THEN** os requisitos aparecem como "Fluent German (C1)"

#### Scenario: Trocar idioma com a vaga aberta
- **GIVEN** o detalhe da vaga aberto com o site em inglês
- **WHEN** o usuário clica no botão de idioma para português
- **THEN** os campos traduzíveis passam a aparecer traduzidos sem recarregar a página

### Requirement: Indicação de tradução automática
Com o site em português e ao menos um campo exibido traduzido, o detalhe da vaga SHALL mostrar o aviso "Tradução automática" e um link "Ver original" que mostra os textos originais daquela vaga. [DECISÃO P5]

#### Scenario: Ver original
- **GIVEN** o detalhe de uma vaga com requisitos traduzidos, site em português
- **WHEN** o usuário clica em "Ver original"
- **THEN** os requisitos aparecem em inglês e o link passa a se chamar "Ver tradução"

#### Scenario: Vaga sem nenhuma tradução
- **GIVEN** uma vaga sem nenhuma tradução guardada, site em português
- **WHEN** o usuário abre o detalhe
- **THEN** o aviso "Tradução automática" e o link "Ver original" não aparecem

### Requirement: Falha do serviço de tradução não bloqueia
Se o serviço de tradução falhar, não responder dentro do tempo limite [DECISÃO P8] ou estiver com a cota esgotada, criar, editar e importar vagas SHALL concluir com o mesmo resultado e a mesma resposta que teriam sem tradução, ficando sem tradução apenas os campos afetados, e a falha MUST ficar registrada no log do servidor sem o conteúdo das vagas. A próxima criação/edição/importação ou o comando de tradução pendente MUST tentar de novo os campos sem tradução.

#### Scenario: Serviço indisponível na importação
- **GIVEN** o serviço de tradução indisponível
- **WHEN** um admin importa uma planilha com 10 vagas novas
- **THEN** as 10 vagas são criadas, o resumo da importação é o mesmo que sem tradução e as vagas aparecem no original com o site em português

#### Scenario: Cota esgotada
- **GIVEN** a cota mensal do serviço de tradução esgotada
- **WHEN** um admin edita os requisitos de uma vaga
- **THEN** a edição é salva e os requisitos aparecem no original com o site em português

#### Scenario: Chave do serviço não configurada
- **GIVEN** o servidor sem a chave do serviço de tradução configurada
- **WHEN** o servidor inicia e vagas são criadas
- **THEN** o servidor inicia sem erro, registra uma única vez no log que a tradução está desativada, e nenhuma tradução é gerada

### Requirement: Edição sempre do original
O formulário de edição SHALL carregar e salvar sempre os textos originais, independentemente do idioma do site.

#### Scenario: Editar com o site em português
- **GIVEN** uma vaga com requisitos originais "Fluent German (C1)" e tradução "Alemão fluente (C1)", site em português
- **WHEN** o admin abre "Editar vaga"
- **THEN** o campo requisitos mostra "Fluent German (C1)"

### Requirement: Traduzir vagas já cadastradas
O sistema SHALL oferecer um comando, executado por quem administra o servidor, que gera a tradução dos campos traduzíveis ainda sem tradução de todas as vagas e informa quantos campos traduziu, quantos falharam e quantos caracteres enviou. [DECISÃO P6]

#### Scenario: Primeira execução
- **GIVEN** 136 vagas importadas antes desta mudança, sem tradução
- **WHEN** o comando é executado com o serviço disponível
- **THEN** os campos traduzíveis não vazios das 136 vagas ficam com tradução e o comando informa o total traduzido e os caracteres enviados

#### Scenario: Segunda execução
- **GIVEN** o comando já executado com sucesso
- **WHEN** ele é executado de novo sem nenhuma vaga alterada
- **THEN** nenhum texto é enviado ao serviço e o comando informa 0 traduzidos

### Requirement: Português do Brasil
As traduções SHALL ser geradas para português do Brasil (não português europeu). [DECISÃO P4]

#### Scenario: Variante brasileira
- **GIVEN** uma vaga com benefícios "Your invoice is ready to view."
- **WHEN** a tradução é gerada
- **THEN** o pedido ao serviço de tradução indica português do Brasil como idioma de destino

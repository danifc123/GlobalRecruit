# Proposal

## Why

O botão PT/EN traduz só os textos fixos do site. Os dados das vagas (requisitos, benefícios, realocação etc.) vêm da planilha do cliente em inglês e continuam em inglês com o site em português, o que obriga a equipe brasileira a traduzir por fora. As 136 vagas reais somam ~200 mil caracteres de texto traduzível (medido em 2026-11-07), volume que cabe em planos gratuitos de tradução automática se cada texto for traduzido uma vez e guardado.

## What Changes

- Os textos das vagas passam a ter uma versão em português do Brasil, gerada por tradução automática e guardada no sistema.
- Com o site em PT, os campos traduzíveis da vaga aparecem traduzidos, com indicação de que são tradução automática; com o site em EN, aparecem como vieram da planilha/cadastro.
- A tradução é gerada quando a vaga é criada, editada ou importada, e refeita só quando o texto original muda.
- Falha ou cota esgotada no serviço de tradução nunca impede criar, editar ou importar vagas: o texto original é exibido até a tradução existir.
- Edição continua sendo sempre do texto original.

## Capabilities

### New Capabilities
- `traducao-vagas`: versão em português do Brasil dos textos das vagas — quando é gerada, como é exibida e como se comporta quando o serviço de tradução falha.

### Modified Capabilities
<!-- Nenhuma: a capability `vagas` ainda está na change importar-vagas-planilha (não arquivada); esta change só acrescenta comportamento novo. -->

## Não inclui

- Traduzir de português para inglês (o original é sempre o texto cadastrado/importado).
- Traduzir os textos fixos do site (já existe o dicionário PT/EN).
- Traduzir dados de candidatos, projetos ou usuários.
- Editar a tradução à mão.
- Outros idiomas além de português do Brasil.
- Traduzir a planilha antes de importar.

## Decisões (respondidas pelo Daniel em 2026-11-07: todas as recomendações aceitas)

Cada `[DECISÃO Pn]` nas specs aponta para cá. Também aceitos: `httpx` como dependência de runtime e implementação numa branch nova criada a partir da branch do PR #15.

- **P1 — Quais campos traduzir.** requisitos, benefícios, realocação, modalidade e data de início. Não traduzir código, cliente, país, localização, moeda, tipo de salário e headcount (nomes próprios/códigos) nem cargo (cargos costumam ficar em inglês no mercado; ex.: "Customer Support Agent").
- **P2 — Notas internas.** Podem conter informação sensível do cliente e iriam para um serviço externo: **não traduzir** notas internas.
- **P3 — Faixa salarial.** É texto livre ("negotiable, preferably within AUD 140,000…"): traduzir.
- **P4 — Serviço de tradução e privacidade.** A DeepL informa que o tratamento de dados *pode diferir* entre os planos Free e Pro; só o Pro declara que os textos não são guardados nem usados para treino: DeepL **API Free** (500 mil caracteres/mês, PT-BR suportado), aceitando o risco para os campos de P1 (sem notas internas). Alternativa se o risco não for aceitável: DeepL Pro (pago) ou Azure Translator F0 (2 milhões/mês).
- **P5 — Indicação visual.** um aviso curto "Tradução automática" no bloco de informações da vaga, e um link "Ver original" que mostra o texto em inglês naquela vaga.
- **P6 — Vagas já existentes.** traduzir as vagas já cadastradas uma vez, por um comando executado pelo admin/desenvolvedor (não automático no deploy).
- **P7 — Quem dispara.** tradução automática ao criar/editar/importar, sem botão; nenhum papel novo.
- **P8 — Tempo limite do serviço de tradução.** 15 segundos por chamada; acima disso, conta como falha (o campo fica sem tradução e é tentado de novo depois).
- **P9 — Quando a tradução aparece.** gerada logo depois de salvar/importar, sem fazer o usuário esperar; enquanto a tradução não existe, a tela de detalhe mostra o original (sem atualização automática — aparece ao reabrir a vaga).

## Impact

- Backend: armazenamento das traduções (migration nova), cliente HTTP para o serviço de tradução, geração após criar/editar/importar, comando para traduzir vagas existentes, campos traduzidos na resposta de vaga.
- Configuração: nova variável de ambiente com a chave do serviço (no `.env` local e nas variáveis do Railway), documentada no `.env.example` sem valor real.
- Frontend: exibição dos campos traduzidos quando o idioma é PT, aviso "Tradução automática" e "Ver original".
- Dependência externa: serviço de tradução (rede, cota mensal). Possivelmente nenhuma biblioteca nova (`httpx` já é usado nos testes; avaliar se entra como dependência de runtime).
- Privacidade: textos das vagas enviados a terceiro (ver P2 e P4).

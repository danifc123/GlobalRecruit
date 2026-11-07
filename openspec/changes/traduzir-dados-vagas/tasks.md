# Tasks

## 1. Base

- [x] 1.1 Criar branch a partir de `claude/globalrecruit-project-setup-bb36a0` (ou da `main` depois do merge do PR #15); verificar `git log` com os commits da importação
- [x] 1.2 Mover `httpx` (versão fixa) para `requirements.txt` e adicionar `DEEPL_API_KEY`/`DEEPL_API_URL` ao `Settings` e ao `.env.example` sem valor real; verificar `pip check` e o servidor subindo sem a chave

## 2. Provedor de tradução

- [x] 2.1 `Tradutor` (Protocol), `TradutorDesativado` e `FakeTradutor` nos testes; teste de que sem chave nada é traduzido e o aviso é logado uma vez
- [x] 2.2 `DeepLTradutor` com timeout (P8), lotes de até 50 textos e < 128 KiB, `target_lang=PT-BR`; testes com transporte HTTP falso (httpx `MockTransport`) cobrindo sucesso, excesso de requisições e cota esgotada (códigos HTTP conferidos na doc da DeepL antes de implementar), timeout e 5xx, e que o log não contém texto nem chave

## 3. Armazenamento e regra de pendência

- [x] 3.1 Migration `0008` criando `vagas_traducoes` (FK cascade, único `(vaga_id, campo, idioma)`); verificar upgrade, downgrade e upgrade no banco local
- [x] 3.2 Service que calcula campos pendentes por hash e grava/apaga traduções; testes dos cenários "Campos traduzidos", "Reimportação sem mudança", "Requisitos alterados", "Campo esvaziado" com `FakeTradutor`

## 4. Disparo e API

- [x] 4.1 Agendar a tradução em segundo plano após criar, editar e importar; testes de integração de que a resposta não espera o tradutor e de que falha/cota não altera o resultado da operação
- [x] 4.2 `VagaOut.traducoes` nas rotas de vaga; teste de que só campos traduzidos aparecem
- [x] 4.3 Comando `python -m app.traduzir_vagas` com resumo (traduzidos, falhas, caracteres); testes "Primeira execução" e "Segunda execução"
- [x] 4.4 Documentar no README (variáveis, comando, provedor, privacidade); verificar o comando como documentado

## 5. Frontend

- [x] 5.1 Model/serviço com `traducoes`; teste Vitest do mapeamento
- [x] 5.2 Detalhe da vaga (mobile e painel): texto traduzido com site em PT, original em EN, troca sem recarregar, aviso "Tradução automática" e "Ver original"/"Ver tradução"; testes Vitest dos cenários de exibição e strings no `en.dictionary.ts`
- [x] 5.3 Formulário de edição sempre com o original; teste do cenário "Editar com o site em português"

## 6. Verificação integrada

- [x] 6.1 Suítes, build e lint verdes
- [ ] 6.2 Com chave real do Daniel no `.env` local: rodar o comando nas 136 vagas reais, conferir caracteres enviados vs cota, ver o detalhe em PT e EN na tela

## Workflow follow-up

- Commits locais e PR só com autorização; arquivar a change depois do merge.

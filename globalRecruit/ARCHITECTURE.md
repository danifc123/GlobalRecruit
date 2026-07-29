# Arquitetura do frontend — GlobalRecruit

Sistema de gestão de vagas para recrutadores. Angular 21, standalone components,
SSR habilitado (Express). Este documento descreve a organização de pastas e as
convenções adotadas para manter o projeto escalável conforme novas telas forem
sendo adicionadas.

## Estrutura de pastas

```
src/
  app/
    core/          Serviços singleton, guards, interceptors, modelos de domínio
                    compartilhados por toda a aplicação (ex.: autenticação,
                    cliente HTTP, tipos de Vaga/Candidato). Nada de UI aqui.
    shared/
      ui/          Design system: componentes "burros", sem conhecimento de
                    domínio ou de rotas (Button, Input, Badge, Card, Icon,
                    Spinner...). Reutilizáveis em qualquer feature.
      directives/  Diretivas reutilizáveis (criar quando surgir a necessidade)
      pipes/       Pipes reutilizáveis (criar quando surgir a necessidade)
    layout/        Shell da aplicação: header, sidebar, layout autenticado
                    (criar quando as telas internas começarem)
    features/      Uma pasta por área de negócio (ex.: vagas, candidatos,
                    dashboard, auth). Cada feature é lazy-loaded via
                    `loadComponent`/`loadChildren` e só importa de `core` e
                    `shared` — nunca de outra feature diretamente.
  styles/          Tokens de design, reset e tipografia globais (SCSS)
  styles.scss      Ponto de entrada dos estilos globais
```

## Convenções

- **Standalone by default**: nenhum `NgModule`. Componentes são importados
  diretamente onde são usados.
- **Nomenclatura de classes**: sem sufixo `Component`/`Service` (`Button`, não
  `ButtonComponent`), seguindo o style guide atual do Angular. O sufixo
  continua nos arquivos (`button.ts`, `button.html`, `button.scss`).
- **Signals em vez de `@Input`/`@Output`**: use `input()`, `input.required()`
  e `output()`. Estado interno do componente também deve usar `signal()`.
- **`ChangeDetectionStrategy.OnPush`** em todo componente novo.
- **Componentes de formulário** (`Input` e futuros `Select`, `Checkbox`...)
  implementam `ControlValueAccessor` para funcionar com Reactive Forms.
- **Estilos**: cada componente tem seu próprio `.scss` com estilos apenas
  daquele componente. Tokens de cor/espaçamento/tipografia vêm sempre de
  `src/styles/_tokens.scss` (custom properties `--gr-*`), nunca valores soltos.
- **Import alias**: use `@app/...` para importar de `src/app/...` em vez de
  caminhos relativos longos (configurado em `tsconfig.json`). O UI kit tem um
  barrel em `shared/ui/index.ts` — ao criar um componente novo, exporte-o lá.
- **Rotas**: cada feature expõe suas rotas via `loadComponent`
  (ou `loadChildren` quando a feature crescer o suficiente para ter rotas
  próprias) a partir de `app.routes.ts`, mantendo o bundle inicial pequeno.

## UI Kit atual

`src/app/shared/ui/`: `Button`, `Input`, `Badge`, `Card`, `Icon`, `Spinner`.
Visualização de todos os componentes e variantes em `src/app/features/ui-showcase`,
servida na rota raiz (`/`) enquanto não houver uma tela inicial definitiva.

## Próximos passos sugeridos

- Definir telas reais (dashboard, listagem de vagas, detalhe de vaga, pipeline
  de candidatos) e criar as respectivas pastas em `features/`.
- Criar `layout/` com o shell autenticado (header, navegação) assim que a
  primeira tela interna for definida.
- Criar `core/` com serviços de autenticação e cliente HTTP quando a API for
  integrada.
- Expandir o UI kit sob demanda (Select, Checkbox, Modal, Table, Toast...)
  conforme as telas exigirem — evitar criar componentes especulativos.

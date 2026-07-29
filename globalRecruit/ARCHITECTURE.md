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
    layout/        Shell da aplicação: sidebar de navegação + topbar (ver
                    seção "Layout (shell)" abaixo)
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

## Paleta

Marca em verde musgo (`--gr-color-primary-*`) com dourado como cor de destaque
(`--gr-color-accent-*`), definidos em `src/styles/_tokens.scss`. Cores
semânticas (success/warning/danger/info) são independentes da marca — não
reutilize `primary` para status. Como os componentes só consomem as custom
properties (nunca hex direto), trocar a paleta inteira é uma mudança só em
`_tokens.scss`.

## Layout (shell)

`src/app/layout/shell/` é o shell persistente: `Sidebar` lateral (navegação
por rota, ícone+label) + uma topbar fina (só o título contextual da rota,
por enquanto) acima do `<router-outlet>`. `App` (`app.ts`/`app.html`) só
renderiza `<app-shell />`, então toda `features/` nova aparece
automaticamente dentro do mesmo chrome.

`src/app/layout/sidebar/` é só a navegação lateral em si — recebe a lista de
rotas (`TabItem[]`, mesmo tipo usado por `Tabs`) via input. Recolhida
(só ícone) abaixo de 1024px, expandida (ícone+label) a partir daí.

## Responsividade e motion

Design mobile-first a partir de tablet retrato (o dispositivo principal de
uso é iPad), com uma única quebra em **`1024px`** (tablet paisagem/desktop) —
ver `Sidebar`, `Table` e os grids de `features/dashboard` como referência do
padrão (estilos base = tablet, `@media (min-width: 1024px)` = expansão).

Sistema de motion em `src/styles/_motion.scss`: guard global de
`prefers-reduced-motion` (não precisa repetir em componentes) e o keyframe
`page-enter`, aplicado no `:host` de cada componente de `features/*`
(`animation: page-enter var(--gr-transition-base);`). Feedback de toque
(`:active { transform: scale(...) }`) fica só em elementos realmente
interativos (Button, Sidebar) — nunca em cards/containers não clicáveis.

## UI Kit atual

`src/app/shared/ui/`: `Button` (variante `iconOnly`, alvo de toque ≥44px em
`md`/`lg`), `Input`, `Badge`, `Card`, `Icon` (biblioteca própria de ícones
SVG inline, sem dependência externa), `Spinner`, `StatCard` (tile de KPI),
`Banner` (aviso/contexto — tons `info`/`success`/`warning`/`danger`,
`layout: 'bar'|'boxed'`, barra de destaque lateral, `dismissible`), `Table`
(header vira cada linha em card abaixo de 1024px — quem projeta `<tr>`
precisa repetir `data-label="Coluna"` em cada `<td>`, ver seção Table do
`ui-showcase`), `Tabs` e `SegmentedControl` (navegação por rota e toggle de
2+ opções, respectivamente — hoje sem uso no shell, disponíveis no kit para
quando surgir a necessidade) e `EmptyState` (placeholder para listas/
gráficos sem dado ainda, com animação de entrada).

Cards, stat-cards e tabelas usam só `box-shadow` (sem borda) — a cor de
marca nunca aparece como bloco de fundo grande, só como destaque pontual
(logo, item ativo, botão primário).

Visualização de todos os componentes e variantes em
`src/app/features/ui-showcase`, servida em `/ui-kit` (rota de apoio ao
desenvolvimento, fora da navegação principal).

## Rotas atuais

`dashboard`, `vagas-ativas`, `pipeline-candidatos` e `projetos-parceiros` já
têm conteúdo real (grid de `StatCard`, `Table`, `Banner`). `projetos-parceiros`
é a visão restrita — hoje pensada para o acesso de parceiros em geral
(controlado pelo administrador), não vinculada a uma pessoa específica.
`banco-talentos` continua como placeholder (`Card` + `EmptyState`) — ainda
sem tela de referência definida.

## Próximos passos sugeridos

- Definir e construir a tela de `banco-talentos`.
- Criar `core/` com serviços de autenticação e cliente HTTP quando a API/
  integração com Google Sheets for implementada (hoje o shell só tem estado
  local de UI, sem dados reais — as `Table` das telas reais ficam sempre
  `isEmpty` até existir uma fonte de dados).
- Expandir o UI kit sob demanda (Select, Checkbox, Modal, Toast...) conforme
  as telas exigirem — evitar criar componentes especulativos.

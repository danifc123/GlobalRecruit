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

`src/app/layout/shell/` é o shell persistente: navegação (`Sidebar` ou
`BottomNav`, conforme o tier de tela — ver seção abaixo) + uma topbar fina
(só o título contextual da rota, por enquanto) acima do `<router-outlet>`.
`App` (`app.ts`/`app.html`) só renderiza `<app-shell />`, então toda
`features/` nova aparece automaticamente dentro do mesmo chrome.

`src/app/layout/sidebar/` é a navegação lateral (celular não a usa — ver
abaixo). Recebe a lista de rotas (`TabItem[]`, mesmo tipo usado por `Tabs`)
via input. Recolhida (só ícone) de `640px` a `1024px`, expandida
(ícone+label) a partir daí.

`src/app/layout/bottom-nav/` é a navegação do celular — barra fixa inferior,
ícone+label sempre visíveis (padrão de app nativo). Recebe `leftItems`/
`rightItems` (`TabItem[]`, mesmo tipo da `Sidebar`) e `showFab`: staff
(admin/developer) tem `Início · Vagas · [FAB] · Pipeline · Conta`, o FAB
sempre abre o wizard de Nova Vaga (`core/ui/quick-create.service.ts`, um
sinal que `VagasAtivas` consome — se o FAB for tocado fora de
`/vagas-ativas`, o `Shell` navega pra lá primeiro); recrutador tem só
`Minhas vagas · Talentos · Conta`, sem FAB (não cria nada). `/conta`
(`features/conta/`) é o hub que substitui a antiga aba "Mais" — perfil,
atalhos de administração (só staff) e "Sair", com conteúdo condicional por
papel.

## Responsividade e motion

Três tiers formalizados, mobile-first (o público real é iPad e celular, nunca
desktop): **`<640px`** celular, **`640–1023px`** tablet retrato, **`1024px+`**
tablet paisagem/desktop. `Sidebar`/`BottomNav` (navegação), `Sheet`
(formulário inline vs. modal de tela cheia), `Table` e o grid de
`features/dashboard` são a referência do padrão — estilos base = celular,
`@media (min-width: 640px)` = tablet retrato, `@media (min-width: 1024px)` =
expansão desktop/tablet paisagem.

**Identidade visual do celular ("GlobalRecruit Mobile B")**: abaixo de
`640px`, toda tela com dado real abre com um header cheio em
`--gr-color-primary-900` (classe `.mobile-header`, repetida — sem estilo
compartilhado global — em cada `.scss` que precisa dela, mesma filosofia de
"cada componente com seu próprio scss"). Isso é uma exceção deliberada à
regra abaixo, que vale só a partir de `640px`. Padrões que se repetem nessa
identidade: linha densa de 2 andares com barra de prioridade à esquerda
(`vagas-ativas`), `ChipFilter` como filtro rápido com contagem, `SwipeRow`
pra ações reveladas por gesto (arrastar pra esquerda), avatar-iniciais via
`shared/utils/initials.ts`, e sheets de ação (não só formulário) como o
"mover etapa" de `candidato-detalhe`. Cada tela existente ganhou uma árvore
de markup nova só pra esse tier, paralela à árvore `≥640px` de sempre — as
duas coexistem no DOM, uma escondida via CSS conforme o `min-width` (mesma
técnica do par `Sidebar`/`BottomNav`), porque a estrutura difere demais pra
reaproveitar o truque de "duas apresentações de CSS" que o `Sheet` usa.

Sistema de motion em `src/styles/_motion.scss`: guard global de
`prefers-reduced-motion` (não precisa repetir em componentes) e o keyframe
`page-enter`, aplicado no `:host` de cada componente de `features/*`
(`animation: page-enter var(--gr-transition-base);`). Feedback de toque
(`:active { transform: scale(...) }`) fica só em elementos realmente
interativos (Button, Sidebar) — nunca em cards/containers não clicáveis.

## UI Kit atual

`src/app/shared/ui/`: `Button` (variante `iconOnly`, alvo de toque ≥44px em
`md`/`lg` — `Input`/`Select` seguem o mesmo alvo de 44px), `Input`, `Select`,
`Badge`, `Card`, `Sheet` (container dos formulários de criação — abaixo de
`640px` vira modal de tela cheia deslizando de baixo pra cima, com backdrop e
foco preso; de `640px` pra cima renderiza como bloco inline, visual igual ao
`Card`), `Icon` (biblioteca própria de ícones SVG inline, sem dependência
externa), `Spinner`, `Skeleton` (bloco cinza com pulso — cada tela compõe seu
próprio esqueleto de loading empilhando instâncias, sem um "layout de
skeleton" pronto), `StatCard` (tile de KPI), `Banner` (aviso/contexto — tons
`info`/`success`/`warning`/`danger`, `layout: 'bar'|'boxed'`, barra de
destaque lateral, `dismissible`), `ChipFilter` (fileira de chips com
contagem e scroll horizontal, usada como filtro rápido — dentro de um
`.mobile-header` os chips viram translúcidos via `:host-context`), `SwipeRow`
(linha com ações reveladas ao arrastar — só intercepta o gesto depois que o
arrasto horizontal supera o vertical, pra não travar o scroll da lista),
`Table` (header vira cada linha em card abaixo de 1024px — quem projeta
`<tr>` precisa repetir `data-label="Coluna"` em cada `<td>`, ver seção Table
do `ui-showcase`), `Tabs` e `SegmentedControl` (navegação por rota e toggle
de 2+ opções, respectivamente — hoje sem uso no shell, disponíveis no kit
para quando surgir a necessidade) e `EmptyState` (placeholder para listas/
gráficos sem dado ainda, com animação de entrada — também cobre os estados
de erro/vazio reais de cada tela, com botão de retry via `ng-content`).

Cards, stat-cards e tabelas usam só `box-shadow` (sem borda) — a partir de
`640px` a cor de marca nunca aparece como bloco de fundo grande, só como
destaque pontual (logo, item ativo, botão primário). Abaixo de `640px` isso
não vale pro `.mobile-header` (ver "Responsividade e motion" acima) — é a
única exceção intencional à regra.

Visualização de todos os componentes e variantes em
`src/app/features/ui-showcase`, servida em `/ui-kit` (rota de apoio ao
desenvolvimento, fora da navegação principal).

## Papéis

`admin` (e `developer`, com acesso irrestrito) fazem toda a escrita — criar
vaga, candidato, mover pipeline, cadastrar projeto parceiro, criar usuário.
`recruiter` é só leitura, vinculado a N projetos parceiros ao mesmo tempo
(gerenciado em `admin/usuarios`) e só enxerga dados desses projetos — tanto
no backend (toda query filtra pelos projetos do usuário autenticado) quanto
no front (`roleGuard` bloqueia `vagas-ativas`/`pipeline-candidatos`, que
mostram cliente/comissão e ações de escrita).

## Rotas atuais

`dashboard`, `vagas-ativas`, `pipeline-candidatos` e `projetos-parceiros` já
têm conteúdo real (grid de `StatCard`, `Table`, `Banner` no tier `≥640px`;
header escuro + linhas densas no celular). `projetos-parceiros` é a "Visão
do Recrutador" — tela restrita (some com colunas confidenciais) que qualquer
papel autenticado acessa, mas que na prática é a home do `recruiter` (única
área de vagas que ele enxerga). `admin/projetos` é o cadastro de projeto
parceiro (nome/cliente), separado dessa visão e restrito a
`admin`/`developer`. `vagas-ativas/:id` e `pipeline-candidatos/:id` são as
telas de detalhe (vaga e candidato) — sem guia de papel além do `authGuard`
pra vaga (o backend já escopa por projeto), restrita a `admin`/`developer`
pra candidato (mesma regra de escrita do pipeline). `conta` é o hub do
celular (ver "Layout (shell)"). `banco-talentos` mostra o `EmptyState` real
(`3o` do design mobile) — a lista populada exigiria um conceito de "banco de
talentos" que ainda não existe no backend (arquivamento de candidato, tags,
importação — desenho separado).

## Próximos passos sugeridos

- Desenhar o backend de "banco de talentos" (arquivamento de candidato ao
  ser rejeitado, tags de habilidade, importação) pra sair do `EmptyState`.
- Adicionar o campo "Vínculo" ao schema de `Vaga` se o wizard de Nova Vaga
  precisar dele de verdade (hoje omitido — não existe no backend).
- Tela de iPad (`640–1024px`) dedicada, se a identidade visual do celular
  precisar se estender pra esse tier — hoje `≥640px` só herda o layout
  anterior (Sidebar + Table + Card), sem o header escuro.
- Expandir o UI kit sob demanda (Checkbox, Modal genérico, Toast...) conforme
  as telas exigirem — evitar criar componentes especulativos.

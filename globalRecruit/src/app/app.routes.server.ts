import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // rotas com :id são renderizadas sob demanda (SSR) — os ids são dinâmicos,
  // não dá pra prerenderizar um conjunto fixo de páginas pra elas
  { path: 'vagas-ativas/:id', renderMode: RenderMode.Server },
  { path: 'pipeline-candidatos/:id', renderMode: RenderMode.Server },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];

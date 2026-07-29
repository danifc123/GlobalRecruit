import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
    title: 'Dashboard — GlobalRecruit Ops',
  },
  {
    path: 'vagas-ativas',
    loadComponent: () =>
      import('./features/vagas-ativas/vagas-ativas').then((m) => m.VagasAtivas),
    title: 'Vagas Ativas — GlobalRecruit Ops',
  },
  {
    path: 'projetos-parceiros',
    loadComponent: () =>
      import('./features/projetos-parceiros/projetos-parceiros').then(
        (m) => m.ProjetosParceiros,
      ),
    title: 'Projetos de Parceiros — GlobalRecruit Ops',
  },
  {
    path: 'pipeline-candidatos',
    loadComponent: () =>
      import('./features/pipeline-candidatos/pipeline-candidatos').then(
        (m) => m.PipelineCandidatos,
      ),
    title: 'Pipeline Candidatos — GlobalRecruit Ops',
  },
  {
    path: 'banco-talentos',
    loadComponent: () =>
      import('./features/banco-talentos/banco-talentos').then((m) => m.BancoTalentos),
    title: 'Banco de Talentos — GlobalRecruit Ops',
  },
  {
    path: 'ui-kit',
    loadComponent: () =>
      import('./features/ui-showcase/ui-showcase').then((m) => m.UiShowcase),
    title: 'UI Kit — GlobalRecruit Ops',
  },
  { path: '**', redirectTo: 'dashboard' },
];

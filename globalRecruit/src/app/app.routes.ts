import { Routes } from '@angular/router';

import { authGuard } from '@app/core/auth/auth.guard';
import { roleGuard } from '@app/core/auth/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    title: 'Entrar — GlobalRecruit Ops',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
    title: 'Dashboard — GlobalRecruit Ops',
    canActivate: [authGuard],
  },
  {
    path: 'vagas-ativas',
    loadComponent: () =>
      import('./features/vagas-ativas/vagas-ativas').then((m) => m.VagasAtivas),
    title: 'Vagas Ativas — GlobalRecruit Ops',
    canActivate: [authGuard],
  },
  {
    path: 'projetos-parceiros',
    loadComponent: () =>
      import('./features/projetos-parceiros/projetos-parceiros').then(
        (m) => m.ProjetosParceiros,
      ),
    title: 'Projetos de Parceiros — GlobalRecruit Ops',
    canActivate: [authGuard],
  },
  {
    path: 'pipeline-candidatos',
    loadComponent: () =>
      import('./features/pipeline-candidatos/pipeline-candidatos').then(
        (m) => m.PipelineCandidatos,
      ),
    title: 'Pipeline Candidatos — GlobalRecruit Ops',
    canActivate: [authGuard],
  },
  {
    path: 'banco-talentos',
    loadComponent: () =>
      import('./features/banco-talentos/banco-talentos').then((m) => m.BancoTalentos),
    title: 'Banco de Talentos — GlobalRecruit Ops',
    canActivate: [authGuard],
  },
  {
    path: 'admin/usuarios',
    loadComponent: () => import('./features/admin/usuarios/usuarios').then((m) => m.Usuarios),
    title: 'Usuários — GlobalRecruit Ops',
    canActivate: [authGuard, roleGuard(['admin', 'developer'])],
  },
  {
    path: 'ui-kit',
    loadComponent: () =>
      import('./features/ui-showcase/ui-showcase').then((m) => m.UiShowcase),
    title: 'UI Kit — GlobalRecruit Ops',
  },
  { path: '**', redirectTo: 'dashboard' },
];

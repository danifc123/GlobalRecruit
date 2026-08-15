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
    canActivate: [authGuard, roleGuard(['admin', 'developer'])],
    children: [
      {
        path: ':id',
        loadComponent: () =>
          import('./features/vagas-ativas/vaga-detalhe/vaga-detalhe').then((m) => m.VagaDetalhe),
        title: 'Detalhe da vaga — GlobalRecruit Ops',
        // ≥1024px: renderizado dentro do próprio VagasAtivas como painel
        // lateral (master-detail); <1024px, VagasAtivas esconde a lista e
        // deixa só esse outlet visível, em tela cheia (ver vagas-ativas.ts)
        data: { panelMode: true },
      },
    ],
  },
  {
    path: 'vagas-desativadas',
    loadComponent: () =>
      import('./features/vagas-desativadas/vagas-desativadas').then((m) => m.VagasDesativadas),
    title: 'Vagas Desativadas — GlobalRecruit Ops',
    canActivate: [authGuard, roleGuard(['admin', 'developer'])],
  },
  {
    path: 'projetos-parceiros',
    loadComponent: () =>
      import('./features/projetos-parceiros/projetos-parceiros').then(
        (m) => m.ProjetosParceiros,
      ),
    title: 'Visão do Recrutador — GlobalRecruit Ops',
    canActivate: [authGuard],
  },
  {
    path: 'pipeline-candidatos',
    loadComponent: () =>
      import('./features/pipeline-candidatos/pipeline-candidatos').then(
        (m) => m.PipelineCandidatos,
      ),
    title: 'Pipeline Candidatos — GlobalRecruit Ops',
    canActivate: [authGuard, roleGuard(['admin', 'developer'])],
  },
  {
    path: 'pipeline-candidatos/:id',
    loadComponent: () =>
      import('./features/pipeline-candidatos/candidato-detalhe/candidato-detalhe').then(
        (m) => m.CandidatoDetalhe,
      ),
    title: 'Candidato — GlobalRecruit Ops',
    canActivate: [authGuard, roleGuard(['admin', 'developer'])],
  },
  {
    path: 'conta',
    loadComponent: () => import('./features/conta/conta').then((m) => m.Conta),
    title: 'Conta — GlobalRecruit Ops',
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
    path: 'admin/projetos',
    loadComponent: () =>
      import('./features/admin/projetos/projetos-admin').then((m) => m.ProjetosAdmin),
    title: 'Projetos Parceiros — GlobalRecruit Ops',
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

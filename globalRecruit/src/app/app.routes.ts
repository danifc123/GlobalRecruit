import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/ui-showcase/ui-showcase').then((m) => m.UiShowcase),
    title: 'GlobalRecruit — UI Kit',
  },
];

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import type { TabItem } from '@app/shared/ui';
import { Button } from '@app/shared/ui';
import { AuthService } from '@app/core/auth/auth.service';

import { Sidebar } from '../sidebar/sidebar';

const BASE_NAV_ITEMS: TabItem[] = [
  { path: 'dashboard', label: 'Dashboard', icon: 'clock' },
  { path: 'vagas-ativas', label: 'Vagas Ativas', icon: 'briefcase' },
  { path: 'projetos-parceiros', label: 'Projetos de Parceiros', icon: 'users' },
  { path: 'pipeline-candidatos', label: 'Pipeline Candidatos', icon: 'filter' },
  { path: 'banco-talentos', label: 'Banco de Talentos', icon: 'users' },
];

const ADMIN_NAV_ITEM: TabItem = { path: 'admin/usuarios', label: 'Usuários', icon: 'shield' };

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Button],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly navItems = computed<TabItem[]>(() => {
    const role = this.auth.session()?.role;
    return role === 'admin' || role === 'developer'
      ? [...BASE_NAV_ITEMS, ADMIN_NAV_ITEM]
      : BASE_NAV_ITEMS;
  });

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  // tela de login não usa o chrome interno (sidebar/topbar) — ninguém não
  // autenticado deveria ver a navegação da ferramenta
  protected readonly isAuthRoute = () => this.url().startsWith('/login');

  protected readonly pageTitle = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.resolveTitle()),
    ),
    { initialValue: this.resolveTitle() },
  );

  protected logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  private resolveTitle(): string {
    const match = this.navItems().find((item) => this.router.url.startsWith(`/${item.path}`));
    return match?.label ?? 'GlobalRecruit Ops';
  }
}

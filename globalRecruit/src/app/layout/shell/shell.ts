import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import type { TabItem } from '@app/shared/ui';
import { Button } from '@app/shared/ui';
import { AuthService } from '@app/core/auth/auth.service';
import { QuickCreateService } from '@app/core/ui/quick-create.service';

import { BottomNav } from '../bottom-nav/bottom-nav';
import { Sidebar } from '../sidebar/sidebar';

// visível pra qualquer papel autenticado
const BASE_NAV_ITEMS: TabItem[] = [
  { path: 'dashboard', label: 'Dashboard', icon: 'clock' },
  { path: 'projetos-parceiros', label: 'Visão do Recrutador', icon: 'users' },
  { path: 'banco-talentos', label: 'Banco de Talentos', icon: 'users' },
];

// só admin/developer — recrutador é bloqueado nessas rotas pelo roleGuard
// (mostram cliente/comissão e ações de escrita que ele não pode usar)
const STAFF_NAV_ITEMS: TabItem[] = [
  { path: 'vagas-ativas', label: 'Vagas Ativas', icon: 'briefcase' },
  { path: 'pipeline-candidatos', label: 'Pipeline Candidatos', icon: 'filter' },
];

const ADMIN_NAV_ITEMS: TabItem[] = [
  { path: 'admin/usuarios', label: 'Usuários', icon: 'shield' },
  { path: 'admin/projetos', label: 'Projetos Parceiros', icon: 'briefcase' },
];

// bottom nav (celular) do staff: Início · Vagas · [FAB] · Pipeline · Conta
const STAFF_PHONE_LEFT: TabItem[] = [
  { path: 'dashboard', label: 'Início', icon: 'home' },
  { path: 'vagas-ativas', label: 'Vagas', icon: 'briefcase' },
];
const STAFF_PHONE_RIGHT: TabItem[] = [
  { path: 'pipeline-candidatos', label: 'Pipeline', icon: 'filter' },
  { path: 'conta', label: 'Conta', icon: 'user' },
];

// bottom nav do recrutador: Minhas vagas · Talentos · Conta — sem FAB, ele
// não cria nada
const RECRUTADOR_PHONE_ITEMS: TabItem[] = [
  { path: 'projetos-parceiros', label: 'Minhas vagas', icon: 'briefcase' },
  { path: 'banco-talentos', label: 'Talentos', icon: 'database' },
  { path: 'conta', label: 'Conta', icon: 'user' },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, Sidebar, BottomNav, Button],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  private readonly quickCreate = inject(QuickCreateService);

  private readonly isStaff = computed(() => {
    const role = this.auth.session()?.role;
    return role === 'admin' || role === 'developer';
  });

  protected readonly navItems = computed<TabItem[]>(() => [
    ...BASE_NAV_ITEMS,
    ...(this.isStaff() ? STAFF_NAV_ITEMS : []),
    ...(this.isStaff() ? ADMIN_NAV_ITEMS : []),
  ]);

  protected readonly phoneNav = computed<{ left: TabItem[]; right: TabItem[]; showFab: boolean }>(
    () =>
      this.isStaff()
        ? { left: STAFF_PHONE_LEFT, right: STAFF_PHONE_RIGHT, showFab: true }
        : { left: RECRUTADOR_PHONE_ITEMS, right: [], showFab: false },
  );

  protected handleFab(): void {
    this.quickCreate.openNovaVaga();
    if (!this.router.url.startsWith('/vagas-ativas')) {
      this.router.navigateByUrl('/vagas-ativas');
    }
  }

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

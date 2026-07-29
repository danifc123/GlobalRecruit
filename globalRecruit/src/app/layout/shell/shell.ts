import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import type { TabItem } from '@app/shared/ui';

import { Sidebar } from '../sidebar/sidebar';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly router = inject(Router);

  protected readonly navItems: TabItem[] = [
    { path: 'dashboard', label: 'Dashboard', icon: 'clock' },
    { path: 'vagas-ativas', label: 'Vagas Ativas', icon: 'briefcase' },
    { path: 'projetos-parceiros', label: 'Projetos de Parceiros', icon: 'users' },
    { path: 'pipeline-candidatos', label: 'Pipeline Candidatos', icon: 'filter' },
    { path: 'banco-talentos', label: 'Banco de Talentos', icon: 'users' },
  ];

  protected readonly pageTitle = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.resolveTitle()),
    ),
    { initialValue: this.resolveTitle() },
  );

  private resolveTitle(): string {
    const match = this.navItems.find((item) => this.router.url.startsWith(`/${item.path}`));
    return match?.label ?? 'GlobalRecruit Ops';
  }
}

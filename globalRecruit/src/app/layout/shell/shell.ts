import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { Badge, Banner, Button, Icon, SegmentedControl, type TabItem } from '@app/shared/ui';
import type { SegmentedOption } from '@app/shared/ui/segmented-control/segmented-control';

import { Sidebar } from '../sidebar/sidebar';

type ViewMode = 'admin' | 'estela';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Badge, Banner, Button, Icon, SegmentedControl, Sidebar],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly router = inject(Router);

  protected readonly viewMode = signal<ViewMode>('admin');

  protected readonly viewOptions: SegmentedOption<ViewMode>[] = [
    { value: 'admin', label: 'Minha Visão (Admin)', icon: 'user' },
    { value: 'estela', label: 'Visão da Estela', icon: 'users' },
  ];

  protected readonly navItems: TabItem[] = [
    { path: 'dashboard', label: 'Dashboard', icon: 'clock' },
    { path: 'vagas-ativas', label: 'Vagas Ativas', icon: 'briefcase' },
    { path: 'projetos-estela', label: 'Projetos da Estela', icon: 'users' },
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

  protected refresh(): void {
    // Placeholder para a futura sincronização com o Google Sheets.
  }
}

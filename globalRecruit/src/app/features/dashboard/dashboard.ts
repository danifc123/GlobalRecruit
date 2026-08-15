import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { Card, EmptyState, Icon, Skeleton, StatCard } from '@app/shared/ui';
import { AuthService } from '@app/core/auth/auth.service';
import { DashboardService } from '@app/core/data/dashboard.service';
import { DashboardStats } from '@app/core/models/dashboard';

@Component({
  selector: 'app-dashboard',
  imports: [Card, EmptyState, Icon, Skeleton, StatCard, RouterLink, DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly dashboardService = inject(DashboardService);
  private readonly auth = inject(AuthService);

  protected readonly stats = signal<DashboardStats | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly today = new Date();

  protected readonly primeiroNome = computed(() => {
    const email = this.auth.session()?.email ?? '';
    const local = email.split('@')[0] ?? '';
    const primeiro = local.split(/[._-]+/)[0] ?? local;
    return primeiro ? primeiro[0].toUpperCase() + primeiro.slice(1) : '';
  });

  protected readonly maiorIdioma = computed(() => {
    const lista = this.stats()?.vagasPorIdioma ?? [];
    return lista.length ? Math.max(...lista.map((l) => l.count)) : 0;
  });

  constructor() {
    this.dashboardService
      .stats()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (stats) => {
          this.stats.set(stats);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { Card, EmptyState, Icon, StatCard } from '@app/shared/ui';
import { DashboardService } from '@app/core/data/dashboard.service';
import { DashboardStats } from '@app/core/models/dashboard';

@Component({
  selector: 'app-dashboard',
  imports: [Card, EmptyState, Icon, StatCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly dashboardService = inject(DashboardService);

  protected readonly stats = signal<DashboardStats | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  constructor() {
    this.dashboardService.stats().subscribe({
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

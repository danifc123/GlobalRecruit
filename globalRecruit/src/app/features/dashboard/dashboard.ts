import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { Card, EmptyState, Icon, Skeleton, StatCard } from '@app/shared/ui';
import { AuthService } from '@app/core/auth/auth.service';
import { DashboardService } from '@app/core/data/dashboard.service';
import { DashboardStats } from '@app/core/models/dashboard';
import { ESTAGIO_LABELS } from '@app/core/models/candidato';
import { QuickCreateService } from '@app/core/ui/quick-create.service';
import { TopbarActionsService } from '@app/core/ui/topbar-actions.service';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';

@Component({
  selector: 'app-dashboard',
  imports: [Card, EmptyState, Icon, Skeleton, StatCard, RouterLink, DatePipe, TranslatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly dashboardService = inject(DashboardService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly quickCreate = inject(QuickCreateService);
  private readonly topbarActions = inject(TopbarActionsService);

  protected readonly stats = signal<DashboardStats | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly today = new Date();

  // "Estado da conexão" é informação de diagnóstico — só faz sentido pra
  // quem desenvolve/mantém o sistema, não pros demais papéis
  protected readonly isDeveloper = computed(() => this.auth.session()?.role === 'developer');

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

  protected readonly estagioLabels: Record<string, string> = ESTAGIO_LABELS;

  protected readonly maiorEtapa = computed(() => {
    const lista = this.stats()?.funilPorEtapa ?? [];
    return lista.length ? Math.max(...lista.map((e) => e.count)) : 0;
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

    this.topbarActions.setAction({
      label: 'Nova vaga',
      icon: 'plus',
      onClick: () => {
        this.quickCreate.openNovaVaga();
        if (!this.router.url.startsWith('/vagas-ativas')) this.router.navigateByUrl('/vagas-ativas');
      },
    });
    inject(DestroyRef).onDestroy(() => this.topbarActions.clearAction());
  }
}

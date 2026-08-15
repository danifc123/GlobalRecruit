import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Banner, EmptyState, Icon, Input, Page, Skeleton, Table } from '@app/shared/ui';
import { VagasService } from '@app/core/data/vagas.service';
import { Vaga } from '@app/core/models/vaga';

const STATUS_LABELS: Record<string, string> = {
  pausada: 'Pausada',
  fechada: 'Fechada',
};

@Component({
  selector: 'app-vagas-desativadas',
  imports: [Banner, EmptyState, FormsModule, Icon, Input, Page, RouterLink, Skeleton, Table],
  templateUrl: './vagas-desativadas.html',
  styleUrl: './vagas-desativadas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VagasDesativadas {
  private readonly vagasService = inject(VagasService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns = ['ID Vaga', 'Cliente', 'Cargo', 'País', 'Status', 'Ações'];
  protected readonly statusLabels = STATUS_LABELS;

  protected readonly vagas = signal<Vaga[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly search = signal('');

  // "desativada" = qualquer vaga que não está aberta (pausada ou fechada) —
  // não existe endpoint separado pra isso, filtra client-side sobre a
  // mesma listagem de sempre (GET /vagas sem filtro de status)
  protected readonly desativadas = computed(() => this.vagas().filter((v) => v.status !== 'aberta'));

  protected readonly desativadasFiltradas = computed(() => {
    const termo = this.search().trim().toLowerCase();
    const lista = this.desativadas();
    if (!termo) return lista;
    return lista.filter(
      (v) =>
        v.cliente.toLowerCase().includes(termo) ||
        v.cargo.toLowerCase().includes(termo) ||
        (v.pais?.toLowerCase().includes(termo) ?? false),
    );
  });

  protected readonly isEmpty = computed(() => !this.loading() && !this.error() && this.desativadasFiltradas().length === 0);

  constructor() {
    this.vagasService
      .list(0, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.vagas.set(page.items);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}

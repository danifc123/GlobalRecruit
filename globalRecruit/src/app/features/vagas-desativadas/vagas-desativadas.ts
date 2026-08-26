import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ActionsMenu, Banner, EmptyState, Icon, Input, Page, Skeleton, Table } from '@app/shared/ui';
import { VagasService } from '@app/core/data/vagas.service';
import { QuickCreateService } from '@app/core/ui/quick-create.service';
import { Vaga } from '@app/core/models/vaga';

const STATUS_LABELS: Record<string, string> = {
  pausada: 'Pausada',
  fechada: 'Fechada',
};

@Component({
  selector: 'app-vagas-desativadas',
  imports: [ActionsMenu, Banner, EmptyState, FormsModule, Icon, Input, Page, RouterLink, Skeleton, Table],
  templateUrl: './vagas-desativadas.html',
  styleUrl: './vagas-desativadas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VagasDesativadas {
  private readonly vagasService = inject(VagasService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly quickCreate = inject(QuickCreateService);
  private readonly router = inject(Router);

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

  protected readonly ativandoId = signal<string | null>(null);

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

  // abre o wizard de "Editar vaga" em /vagas-ativas — mesmo mecanismo que
  // VagaDetalhe já usa (QuickCreateService), só que com navegação de
  // verdade já que aqui não somos rota filha de VagasAtivas
  protected editar(vaga: Vaga): void {
    this.quickCreate.editVaga(vaga);
    this.router.navigateByUrl('/vagas-ativas');
  }

  // reabre a vaga; candidatos ainda em processo viram "concluído" no
  // backend (histórico preservado, comissão intocada) — ver update_status
  // em vagas.py. Some da lista local assim que confirma.
  protected ativar(vaga: Vaga): void {
    if (this.ativandoId()) return;
    this.ativandoId.set(vaga.id);
    this.vagasService
      .updateStatus(vaga.id, 'aberta')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.vagas.update((lista) => lista.filter((v) => v.id !== vaga.id));
          this.ativandoId.set(null);
        },
        error: () => this.ativandoId.set(null),
      });
  }
}

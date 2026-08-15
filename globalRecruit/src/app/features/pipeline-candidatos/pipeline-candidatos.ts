import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { Banner, Button, ChipFilter, type ChipOption, EmptyState, Icon, Input, Page, Select, Sheet, Skeleton, Table, type SelectOption } from '@app/shared/ui';
import { VagasService } from '@app/core/data/vagas.service';
import { CandidatosService } from '@app/core/data/candidatos.service';
import { TopbarActionsService } from '@app/core/ui/topbar-actions.service';
import { Candidato, ESTAGIO_LABELS, ESTAGIO_ORDEM, Estagio } from '@app/core/models/candidato';
import { Vaga } from '@app/core/models/vaga';
import { getInitials } from '@app/shared/utils/initials';
import { diasDesde } from '@app/shared/utils/relative-time';

interface CandidatoRow extends Candidato {
  vagaCargo: string;
}

const DIAS_PARADO_ALERTA = 10;

@Component({
  selector: 'app-pipeline-candidatos',
  imports: [
    ReactiveFormsModule,
    Banner,
    Button,
    ChipFilter,
    DatePipe,
    EmptyState,
    Icon,
    Input,
    Page,
    RouterLink,
    Select,
    Sheet,
    Skeleton,
    Table,
  ],
  templateUrl: './pipeline-candidatos.html',
  styleUrl: './pipeline-candidatos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PipelineCandidatos {
  private readonly fb = inject(FormBuilder);
  private readonly vagasService = inject(VagasService);
  private readonly candidatosService = inject(CandidatosService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly topbarActions = inject(TopbarActionsService);

  protected readonly columns = ['Nome', 'Email', 'Vaga Alvo', 'Data', 'Status / Etapa', 'Ações'];
  protected readonly getInitials = getInitials;
  protected readonly estagioLabels = ESTAGIO_LABELS;

  protected readonly vagas = signal<Vaga[]>([]);
  protected readonly vagaOptions = computed<SelectOption[]>(() =>
    this.vagas().map((vaga) => ({ value: vaga.id, label: `${vaga.cargo} — ${vaga.cliente}` })),
  );

  protected readonly rows = signal<CandidatoRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  protected readonly estagioFiltro = signal<Estagio>('triagem');
  protected readonly estagioOptions = computed<ChipOption[]>(() => {
    const rows = this.rows();
    return ESTAGIO_ORDEM.filter((e) => e !== 'rejeitado').map((estagio) => ({
      value: estagio,
      label: ESTAGIO_LABELS[estagio],
      count: rows.filter((r) => r.estagioAtual === estagio).length,
    }));
  });

  // busca do topbar (≥1024px) — mesmo filtro client-side usado em Vagas
  // Ativas, aplicado tanto na tabela (640–1023px) quanto no Kanban (≥1024px)
  protected readonly search = signal('');

  private readonly rowsBuscadas = computed(() => {
    const termo = this.search().trim().toLowerCase();
    if (!termo) return this.rows();
    return this.rows().filter(
      (r) => r.nome.toLowerCase().includes(termo) || r.email.toLowerCase().includes(termo),
    );
  });

  protected readonly rowsFiltradas = computed(() =>
    this.rowsBuscadas()
      .filter((r) => r.estagioAtual === this.estagioFiltro())
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );

  // Kanban (≥1024px) — todas as 5 etapas, incluindo rejeitado (os chips
  // acima excluem ele de propósito, o quadro mostra tudo)
  protected readonly kanbanColunas = computed(() =>
    ESTAGIO_ORDEM.map((estagio) => ({
      estagio,
      label: ESTAGIO_LABELS[estagio],
      rows: this.rowsBuscadas()
        .filter((r) => r.estagioAtual === estagio)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    })),
  );

  protected readonly draggingId = signal<string | null>(null);
  protected readonly dragOverEstagio = signal<Estagio | null>(null);
  protected readonly kanbanError = signal<string | null>(null);

  protected readonly showForm = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    vagaId: ['', [Validators.required]],
  });

  constructor() {
    this.loadRows();

    const params = this.route.snapshot.queryParamMap;
    if (params.get('novo') === '1') {
      this.showForm.set(true);
      const vagaId = params.get('vagaId');
      if (vagaId) this.form.controls.vagaId.setValue(vagaId);
    }

    this.topbarActions.setAction({
      label: 'Registrar candidato',
      icon: 'user-plus',
      onClick: () => this.toggleForm(),
    });
    this.topbarActions.setSearch({ placeholder: 'Nome ou e-mail do candidato', query: this.search });
    this.destroyRef.onDestroy(() => {
      this.topbarActions.clearAction();
      this.topbarActions.clearSearch();
    });
  }

  protected diasParado(row: CandidatoRow): number {
    return diasDesde(row.historico[0]?.updatedAt ?? row.createdAt);
  }

  protected estaParado(row: CandidatoRow): boolean {
    return this.diasParado(row) >= DIAS_PARADO_ALERTA;
  }

  // drag-and-drop nativo do Kanban (≥1024px) — sem lib. Move o cartão de
  // coluna de forma otimista e chama a API real; desfaz se ela falhar.
  protected onDragStart(event: DragEvent, id: string): void {
    this.draggingId.set(id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
    }
  }

  protected onDragEnd(): void {
    this.draggingId.set(null);
    this.dragOverEstagio.set(null);
  }

  protected onColunaDragOver(event: DragEvent, estagio: Estagio): void {
    event.preventDefault();
    this.dragOverEstagio.set(estagio);
  }

  protected onColunaDragLeave(estagio: Estagio): void {
    if (this.dragOverEstagio() === estagio) this.dragOverEstagio.set(null);
  }

  protected onColunaDrop(event: DragEvent, estagio: Estagio): void {
    event.preventDefault();
    this.dragOverEstagio.set(null);
    const id = this.draggingId();
    this.draggingId.set(null);
    if (!id) return;

    const anterior = this.rows().find((r) => r.id === id)?.estagioAtual ?? null;
    if (anterior === estagio) return;

    this.rows.update((lista) => lista.map((r) => (r.id === id ? { ...r, estagioAtual: estagio } : r)));

    this.candidatosService
      .updateStage(id, estagio)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (atualizado) => {
          this.rows.update((lista) => lista.map((r) => (r.id === id ? { ...r, ...atualizado } : r)));
        },
        error: () => {
          this.rows.update((lista) => lista.map((r) => (r.id === id ? { ...r, estagioAtual: anterior } : r)));
          this.kanbanError.set('Não foi possível mover o candidato — tente de novo.');
        },
      });
  }

  protected toggleForm(): void {
    this.showForm.update((value) => !value);
    this.errorMessage.set(null);
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const { nome, email, vagaId } = this.form.getRawValue();

    this.candidatosService
      .create({ nome, email, vagaId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.showForm.set(false);
          this.form.reset({ nome: '', email: '', vagaId: '' });
          this.loadRows();
        },
        error: () => {
          this.errorMessage.set('Não foi possível registrar o candidato.');
          this.submitting.set(false);
        },
      });
  }

  private loadRows(): void {
    this.loading.set(true);
    this.error.set(false);
    this.vagasService
      .list(0, 100, 'aberta')
      .pipe(
        switchMap((page) => {
          this.vagas.set(page.items);
          if (page.items.length === 0) return of([] as CandidatoRow[]);

          const porVaga = page.items.map((vaga) =>
            this.candidatosService
              .listByVaga(vaga.id)
              .pipe(
                map((candidatos) =>
                  candidatos.map((candidato): CandidatoRow => ({ ...candidato, vagaCargo: vaga.cargo })),
                ),
              ),
          );
          return forkJoin(porVaga).pipe(map((grupos) => grupos.flat()));
        }),
        catchError(() => {
          this.error.set(true);
          return of([] as CandidatoRow[]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      });
  }
}

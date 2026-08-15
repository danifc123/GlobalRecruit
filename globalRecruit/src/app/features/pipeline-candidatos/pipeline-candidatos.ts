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
import { Candidato, ESTAGIO_LABELS, ESTAGIO_ORDEM, Estagio } from '@app/core/models/candidato';
import { Vaga } from '@app/core/models/vaga';
import { getInitials } from '@app/shared/utils/initials';

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

  protected readonly rowsFiltradas = computed(() =>
    this.rows()
      .filter((r) => r.estagioAtual === this.estagioFiltro())
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );

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
  }

  protected diasParado(row: CandidatoRow): number {
    const ultima = row.historico[0]?.updatedAt ?? row.createdAt;
    const dias = Math.floor((Date.now() - new Date(ultima).getTime()) / (1000 * 60 * 60 * 24));
    return dias;
  }

  protected estaParado(row: CandidatoRow): boolean {
    return this.diasParado(row) >= DIAS_PARADO_ALERTA;
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

import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { Banner, Button, Card, Icon, Input, Page, Select, Table, type SelectOption } from '@app/shared/ui';
import { VagasService } from '@app/core/data/vagas.service';
import { CandidatosService } from '@app/core/data/candidatos.service';
import { Candidato } from '@app/core/models/candidato';
import { Vaga } from '@app/core/models/vaga';

interface CandidatoRow extends Candidato {
  vagaCargo: string;
}

@Component({
  selector: 'app-pipeline-candidatos',
  imports: [ReactiveFormsModule, Button, Icon, Table, DatePipe, Card, Input, Page, Select, Banner],
  templateUrl: './pipeline-candidatos.html',
  styleUrl: './pipeline-candidatos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PipelineCandidatos {
  private readonly fb = inject(FormBuilder);
  private readonly vagasService = inject(VagasService);
  private readonly candidatosService = inject(CandidatosService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns = ['Nome', 'Email', 'Vaga Alvo', 'Data', 'Status / Etapa'];

  protected readonly vagas = signal<Vaga[]>([]);
  protected readonly vagaOptions = computed<SelectOption[]>(() =>
    this.vagas().map((vaga) => ({ value: vaga.id, label: `${vaga.cargo} — ${vaga.cliente}` })),
  );

  protected readonly rows = signal<CandidatoRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly isEmpty = computed(() => !this.loading() && this.rows().length === 0);

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
        catchError(() => of([] as CandidatoRow[])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      });
  }
}

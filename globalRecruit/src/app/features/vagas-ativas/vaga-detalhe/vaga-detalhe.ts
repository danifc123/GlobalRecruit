import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { EmptyState, Icon, Skeleton } from '@app/shared/ui';
import { VagasService } from '@app/core/data/vagas.service';
import { CandidatosService } from '@app/core/data/candidatos.service';
import { ProjetosParceirosService } from '@app/core/data/projetos-parceiros.service';
import { Vaga } from '@app/core/models/vaga';
import { Candidato, ESTAGIO_LABELS, ESTAGIO_ORDEM, Estagio } from '@app/core/models/candidato';
import { getInitials } from '@app/shared/utils/initials';

@Component({
  selector: 'app-vaga-detalhe',
  imports: [EmptyState, Icon, Skeleton, RouterLink],
  templateUrl: './vaga-detalhe.html',
  styleUrl: './vaga-detalhe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VagaDetalhe {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly vagasService = inject(VagasService);
  private readonly candidatosService = inject(CandidatosService);
  private readonly projetosService = inject(ProjetosParceirosService);

  protected readonly getInitials = getInitials;
  protected readonly estagioLabels = ESTAGIO_LABELS;

  protected readonly vaga = signal<Vaga | null>(null);
  protected readonly projetoNome = signal<string | null>(null);
  protected readonly candidatos = signal<Candidato[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  protected readonly pipelineCounts = computed<{ estagio: Estagio; count: number }[]>(() => {
    const counts = new Map<Estagio, number>();
    for (const c of this.candidatos()) {
      if (c.estagioAtual) counts.set(c.estagioAtual, (counts.get(c.estagioAtual) ?? 0) + 1);
    }
    return ESTAGIO_ORDEM.filter((e) => e !== 'rejeitado').map((estagio) => ({
      estagio,
      count: counts.get(estagio) ?? 0,
    }));
  });

  protected readonly ultimosCandidatos = computed(() =>
    [...this.candidatos()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3),
  );

  constructor() {
    const id = this.route.snapshot.paramMap.get('id')!;

    forkJoin({
      vaga: this.vagasService.get(id),
      candidatos: this.candidatosService.listByVaga(id),
      projetos: this.projetosService.list(),
    })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ({ vaga, candidatos, projetos }) => {
          this.vaga.set(vaga);
          this.candidatos.set(candidatos);
          this.projetoNome.set(projetos.find((p) => p.id === vaga.projetoId)?.nome ?? null);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  protected goBack(): void {
    this.location.back();
  }
}

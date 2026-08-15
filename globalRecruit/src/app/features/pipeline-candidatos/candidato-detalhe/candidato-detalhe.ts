import { DatePipe, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { EmptyState, Icon, Sheet, Skeleton } from '@app/shared/ui';
import { CandidatosService } from '@app/core/data/candidatos.service';
import { VagasService } from '@app/core/data/vagas.service';
import { Candidato, ESTAGIO_LABELS, ESTAGIO_ORDEM, Estagio } from '@app/core/models/candidato';
import { Vaga } from '@app/core/models/vaga';
import { getInitials } from '@app/shared/utils/initials';

interface EstagioOpcao {
  estagio: Estagio;
  label: string;
  recomendado: boolean;
}

@Component({
  selector: 'app-candidato-detalhe',
  imports: [DatePipe, EmptyState, Icon, Sheet, Skeleton],
  templateUrl: './candidato-detalhe.html',
  styleUrl: './candidato-detalhe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidatoDetalhe {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly candidatosService = inject(CandidatosService);
  private readonly vagasService = inject(VagasService);

  protected readonly getInitials = getInitials;
  protected readonly estagioLabels = ESTAGIO_LABELS;

  protected readonly candidato = signal<Candidato | null>(null);
  protected readonly vaga = signal<Vaga | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly moverOpen = signal(false);
  protected readonly moving = signal(false);

  protected readonly opcoes = computed<EstagioOpcao[]>(() => {
    const atual = this.candidato()?.estagioAtual;
    const atualIdx = atual ? ESTAGIO_ORDEM.indexOf(atual) : -1;
    return ESTAGIO_ORDEM.filter((e) => e !== atual).map((estagio, i) => ({
      estagio,
      label: ESTAGIO_LABELS[estagio],
      recomendado: atualIdx >= 0 && ESTAGIO_ORDEM.indexOf(estagio) === atualIdx + 1 && i >= 0,
    }));
  });

  private readonly id = this.route.snapshot.paramMap.get('id')!;

  constructor() {
    this.load();
  }

  protected goBack(): void {
    this.location.back();
  }

  protected mover(estagio: Estagio): void {
    if (this.moving()) return;
    this.moving.set(true);
    this.candidatosService.updateStage(this.id, estagio).subscribe({
      next: (candidato) => {
        this.candidato.set(candidato);
        this.moverOpen.set(false);
        this.moving.set(false);
      },
      error: () => this.moving.set(false),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.candidatosService.get(this.id).subscribe({
      next: (candidato) => {
        this.candidato.set(candidato);
        this.vagasService.get(candidato.vagaId).subscribe({
          next: (vaga) => {
            this.vaga.set(vaga);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}

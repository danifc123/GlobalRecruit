import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Banner, EmptyState, Icon, Page, Skeleton, Table } from '@app/shared/ui';
import { AuthService } from '@app/core/auth/auth.service';
import { VagasService } from '@app/core/data/vagas.service';
import { ProjetosParceirosService } from '@app/core/data/projetos-parceiros.service';
import { Vaga } from '@app/core/models/vaga';
import { ProjetoParceiro } from '@app/core/models/projeto-parceiro';

interface GrupoProjeto {
  projeto: ProjetoParceiro;
  vagas: Vaga[];
}

@Component({
  selector: 'app-projetos-parceiros',
  imports: [Banner, EmptyState, Icon, Page, RouterLink, Skeleton, Table],
  templateUrl: './projetos-parceiros.html',
  styleUrl: './projetos-parceiros.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjetosParceiros {
  private readonly vagasService = inject(VagasService);
  private readonly projetosService = inject(ProjetosParceirosService);
  private readonly auth = inject(AuthService);

  // API já restringe por papel no backend (recrutador só recebe vagas dos
  // projetos vinculados) — aqui só omitimos as colunas confidenciais na exibição
  protected readonly columns = ['Cargo', 'Idioma', 'País', 'Modalidade', 'Prioridade', 'Status'];

  protected readonly vagas = signal<Vaga[]>([]);
  protected readonly projetos = signal<ProjetoParceiro[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly isEmpty = computed(() => !this.loading() && this.vagas().length === 0);

  protected readonly totalVagas = computed(() => this.vagas().length);
  protected readonly totalProjetos = computed(() => this.grupos().length);

  protected readonly primeiroNome = computed(() => {
    const email = this.auth.session()?.email ?? '';
    const local = email.split('@')[0] ?? '';
    const primeiro = local.split(/[._-]+/)[0] ?? local;
    return primeiro ? primeiro[0].toUpperCase() + primeiro.slice(1) : '';
  });

  protected readonly grupos = computed<GrupoProjeto[]>(() => {
    const vagas = this.vagas();
    return this.projetos()
      .map((projeto) => ({ projeto, vagas: vagas.filter((v) => v.projetoId === projeto.id) }))
      .filter((grupo) => grupo.vagas.length > 0);
  });

  constructor() {
    forkJoin({
      vagas: this.vagasService.list(0, 100),
      projetos: this.projetosService.list(),
    })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ({ vagas, projetos }) => {
          this.vagas.set(vagas.items);
          this.projetos.set(projetos);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}

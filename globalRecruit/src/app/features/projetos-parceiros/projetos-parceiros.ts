import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { Banner, Table } from '@app/shared/ui';
import { VagasService } from '@app/core/data/vagas.service';
import { Vaga } from '@app/core/models/vaga';

@Component({
  selector: 'app-projetos-parceiros',
  imports: [Banner, Table],
  templateUrl: './projetos-parceiros.html',
  styleUrl: './projetos-parceiros.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjetosParceiros {
  private readonly vagasService = inject(VagasService);

  // API já restringe por role no backend (partner só recebe vagas do
  // próprio projeto) — aqui só omitimos as colunas confidenciais na exibição
  protected readonly columns = ['Cargo', 'Idioma', 'País', 'Modalidade', 'Prioridade', 'Status'];

  protected readonly vagas = signal<Vaga[]>([]);
  protected readonly loading = signal(true);
  protected readonly isEmpty = computed(() => !this.loading() && this.vagas().length === 0);

  constructor() {
    this.vagasService.list(0, 50).subscribe({
      next: (page) => {
        this.vagas.set(page.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}

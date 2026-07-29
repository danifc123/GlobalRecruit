import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Banner, Table } from '@app/shared/ui';

@Component({
  selector: 'app-projetos-parceiros',
  imports: [Banner, Table],
  templateUrl: './projetos-parceiros.html',
  styleUrl: './projetos-parceiros.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjetosParceiros {
  protected readonly columns = [
    'Cargo',
    'Idioma',
    'País',
    'Modalidade',
    'Prioridade',
    'Status',
    'Observações',
  ];
}

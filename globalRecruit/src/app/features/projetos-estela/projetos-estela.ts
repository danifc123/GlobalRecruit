import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Banner, Table } from '@app/shared/ui';

@Component({
  selector: 'app-projetos-estela',
  imports: [Banner, Table],
  templateUrl: './projetos-estela.html',
  styleUrl: './projetos-estela.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjetosEstela {
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

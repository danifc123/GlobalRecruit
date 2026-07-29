import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Button, Icon, Table } from '@app/shared/ui';

@Component({
  selector: 'app-vagas-ativas',
  imports: [Button, Icon, Table],
  templateUrl: './vagas-ativas.html',
  styleUrl: './vagas-ativas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VagasAtivas {
  protected readonly columns = [
    'ID Vaga',
    'Cliente',
    'Projeto',
    'Cargo',
    'Idioma',
    'País',
    'Modalidade',
    'Salário',
    'Comissão',
    'Prioridade',
  ];
}

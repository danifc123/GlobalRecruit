import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Button, Icon, Table } from '@app/shared/ui';

@Component({
  selector: 'app-pipeline-candidatos',
  imports: [Button, Icon, Table],
  templateUrl: './pipeline-candidatos.html',
  styleUrl: './pipeline-candidatos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PipelineCandidatos {
  protected readonly columns = [
    'Nome',
    'Idioma',
    'Vaga Alvo',
    'Origem',
    'Responsável',
    'Data',
    'Status / Etapa',
  ];
}

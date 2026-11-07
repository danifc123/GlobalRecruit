import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { IdGenerator } from '@app/shared/utils/id-generator';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';
import { StatusVaga } from '@app/core/models/vaga';

// rótulos em PT; o dicionário EN traduz "Pausada" como "On-Hold"
const STATUS_OPCOES: { value: StatusVaga; label: string }[] = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'pausada', label: 'Pausada' },
  { value: 'fechada', label: 'Fechada' },
];

/** Seletor Aberta / Pausada / Fechada do detalhe da vaga (substitui "Fechar vaga"). */
@Component({
  selector: 'app-vaga-status-select',
  imports: [TranslatePipe],
  templateUrl: './vaga-status-select.html',
  styleUrl: './vaga-status-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VagaStatusSelect {
  readonly status = input.required<StatusVaga>();
  readonly disabled = input(false);
  readonly alterar = output<StatusVaga>();

  protected readonly opcoes = STATUS_OPCOES;
  protected readonly selectId = inject(IdGenerator).next('vaga-status');

  protected escolher(event: Event): void {
    const novo = (event.target as HTMLSelectElement).value as StatusVaga;
    if (novo !== this.status()) this.alterar.emit(novo);
  }
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// Conjunto inicial de ícones do produto. Adicione novas entradas conforme
// telas forem sendo construídas — evite depender de uma lib de ícones
// externa até que o custo de manter este arquivo compense.
export type IconName =
  | 'search'
  | 'close'
  | 'check'
  | 'chevron-down'
  | 'briefcase'
  | 'user'
  | 'users'
  | 'home'
  | 'globe'
  | 'refresh'
  | 'shield'
  | 'database'
  | 'flame'
  | 'building'
  | 'signal'
  | 'pie-chart'
  | 'filter'
  | 'clock'
  | 'plus'
  | 'user-plus';

@Component({
  selector: 'app-icon',
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
}

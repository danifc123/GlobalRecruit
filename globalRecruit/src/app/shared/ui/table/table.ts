import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EmptyState } from '../empty-state/empty-state';
import type { IconName } from '../icon/icon';

// Abaixo de 1024px cada <tr> vira um card e cada <td> mostra o nome da
// coluna via `data-label` — por isso quem projeta linhas precisa repetir o
// rótulo em `<td data-label="Coluna">valor</td>` para cada célula.
@Component({
  selector: 'app-table',
  imports: [EmptyState],
  templateUrl: './table.html',
  styleUrl: './table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Table {
  readonly columns = input.required<string[]>();
  readonly isEmpty = input(false);
  readonly emptyIcon = input<IconName>();
  readonly emptyMessage = input('Nenhum registro encontrado ainda.');
}

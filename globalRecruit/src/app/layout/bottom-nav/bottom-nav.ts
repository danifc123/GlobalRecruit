import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { Icon } from '@app/shared/ui';
import type { TabItem } from '@app/shared/ui/tabs/tabs';

// Só visível abaixo de 640px (ver bottom-nav.scss) — substitui a Sidebar no
// celular. `leftItems`/`rightItems` ficam nas pontas; quando `showFab` é
// true, o botão + fica sempre no meio dos dois grupos (staff: 2+2 em volta
// do FAB; recrutador: só `leftItems`, sem FAB).
@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomNav {
  readonly leftItems = input.required<TabItem[]>();
  readonly rightItems = input<TabItem[]>([]);
  readonly showFab = input(false);
  readonly fab = output<void>();
}

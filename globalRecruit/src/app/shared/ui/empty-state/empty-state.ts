import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Icon, type IconName } from '../icon/icon';

@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly icon = input<IconName>();
  readonly title = input<string>();
  readonly description = input<string>();
}

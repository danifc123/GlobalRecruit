import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { Icon, type IconName } from '../icon/icon';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';

export interface TabItem {
  path: string;
  label: string;
  icon?: IconName;
  count?: number;
}

@Component({
  selector: 'app-tabs',
  imports: [RouterLink, RouterLinkActive, Icon, TranslatePipe],
  templateUrl: './tabs.html',
  styleUrl: './tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tabs {
  readonly items = input.required<TabItem[]>();
}

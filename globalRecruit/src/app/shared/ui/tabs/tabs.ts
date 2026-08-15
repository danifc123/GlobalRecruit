import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { Icon, type IconName } from '../icon/icon';

export interface TabItem {
  path: string;
  label: string;
  icon?: IconName;
  count?: number;
}

@Component({
  selector: 'app-tabs',
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './tabs.html',
  styleUrl: './tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tabs {
  readonly items = input.required<TabItem[]>();
}

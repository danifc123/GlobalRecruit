import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Card, EmptyState, Icon, StatCard } from '@app/shared/ui';

@Component({
  selector: 'app-dashboard',
  imports: [Card, EmptyState, Icon, StatCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {}

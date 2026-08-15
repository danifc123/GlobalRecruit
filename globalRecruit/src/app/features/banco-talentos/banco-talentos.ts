import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Card, EmptyState } from '@app/shared/ui';

@Component({
  selector: 'app-banco-talentos',
  imports: [Card, EmptyState],
  templateUrl: './banco-talentos.html',
  styleUrl: './banco-talentos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BancoTalentos {}

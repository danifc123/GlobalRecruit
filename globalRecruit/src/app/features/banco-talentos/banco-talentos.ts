import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Card, EmptyState } from '@app/shared/ui';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';

@Component({
  selector: 'app-banco-talentos',
  imports: [Card, EmptyState, TranslatePipe],
  templateUrl: './banco-talentos.html',
  styleUrl: './banco-talentos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BancoTalentos {}

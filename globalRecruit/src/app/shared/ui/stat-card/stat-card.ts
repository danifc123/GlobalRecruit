import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Icon, type IconName } from '../icon/icon';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';

export type StatTone = 'moss' | 'accent' | 'info' | 'success' | 'danger' | 'neutral';
export type StatStatusTone = 'neutral' | 'success';

@Component({
  selector: 'app-stat-card',
  imports: [Icon, TranslatePipe],
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCard {
  readonly label = input.required<string>();
  readonly icon = input<IconName>();
  readonly tone = input<StatTone>('neutral');
  readonly description = input<string>();
  readonly statusTone = input<StatStatusTone>('neutral');

  protected readonly iconClasses = computed(() => `stat-card__icon stat-card__icon--${this.tone()}`);
  protected readonly descriptionClasses = computed(
    () => `stat-card__description stat-card__description--${this.statusTone()}`,
  );
}

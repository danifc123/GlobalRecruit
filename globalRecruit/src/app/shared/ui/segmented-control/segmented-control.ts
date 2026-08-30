import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { Icon, type IconName } from '../icon/icon';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';

export interface SegmentedOption<T> {
  value: T;
  label: string;
  icon?: IconName;
}

@Component({
  selector: 'app-segmented-control',
  imports: [Icon, TranslatePipe],
  templateUrl: './segmented-control.html',
  styleUrl: './segmented-control.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentedControl<T> {
  readonly options = input.required<SegmentedOption<T>[]>();
  readonly value = model.required<T>();

  protected select(option: SegmentedOption<T>): void {
    this.value.set(option.value);
  }
}

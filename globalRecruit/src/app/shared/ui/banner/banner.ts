import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { Button } from '../button/button';
import { Icon, type IconName } from '../icon/icon';

export type BannerTone = 'admin' | 'info' | 'success' | 'warning' | 'danger';
export type BannerLayout = 'bar' | 'boxed';

@Component({
  selector: 'app-banner',
  imports: [Icon, Button],
  templateUrl: './banner.html',
  styleUrl: './banner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Banner {
  readonly tone = input<BannerTone>('info');
  readonly icon = input<IconName>();
  readonly layout = input<BannerLayout>('bar');
  readonly dismissible = input(false);

  protected readonly dismissed = signal(false);

  protected readonly classes = computed(
    () => `banner banner--${this.tone()} banner--${this.layout()}`,
  );

  protected dismiss(): void {
    this.dismissed.set(true);
  }
}

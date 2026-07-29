import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { Badge, Button, Card, Icon, Input, Spinner } from '@app/shared/ui';
import type { BadgeVariant } from '@app/shared/ui/badge/badge';
import type { ButtonVariant } from '@app/shared/ui/button/button';
import type { IconName } from '@app/shared/ui/icon/icon';

@Component({
  selector: 'app-ui-showcase',
  imports: [ReactiveFormsModule, Badge, Button, Card, Icon, Input, Spinner],
  templateUrl: './ui-showcase.html',
  styleUrl: './ui-showcase.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiShowcase {
  protected readonly buttonVariants: ButtonVariant[] = [
    'primary',
    'secondary',
    'outline',
    'ghost',
    'danger',
  ];

  protected readonly badgeVariants: BadgeVariant[] = [
    'neutral',
    'success',
    'warning',
    'danger',
    'info',
  ];

  protected readonly iconNames: IconName[] = [
    'search',
    'close',
    'check',
    'chevron-down',
    'briefcase',
    'user',
  ];

  protected readonly nameControl = new FormControl('', { nonNullable: true });
  protected readonly emailControl = new FormControl('', { nonNullable: true });

  protected readonly loadingDemo = signal(false);

  protected toggleLoadingDemo(): void {
    this.loadingDemo.set(true);
    setTimeout(() => this.loadingDemo.set(false), 1500);
  }
}

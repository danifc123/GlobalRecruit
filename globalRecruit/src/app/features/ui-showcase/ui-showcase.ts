import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  SegmentedControl,
  Spinner,
  StatCard,
  Table,
  Tabs,
} from '@app/shared/ui';
import type { BadgeVariant } from '@app/shared/ui/badge/badge';
import type { ButtonVariant } from '@app/shared/ui/button/button';
import type { IconName } from '@app/shared/ui/icon/icon';
import type { SegmentedOption } from '@app/shared/ui/segmented-control/segmented-control';
import type { TabItem } from '@app/shared/ui/tabs/tabs';

@Component({
  selector: 'app-ui-showcase',
  imports: [
    ReactiveFormsModule,
    Badge,
    Banner,
    Button,
    Card,
    EmptyState,
    Icon,
    Input,
    SegmentedControl,
    Spinner,
    StatCard,
    Table,
    Tabs,
  ],
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
    'users',
    'home',
    'globe',
    'refresh',
    'shield',
    'database',
    'flame',
    'building',
    'signal',
    'pie-chart',
    'filter',
    'clock',
    'plus',
    'user-plus',
  ];

  protected readonly nameControl = new FormControl('', { nonNullable: true });
  protected readonly emailControl = new FormControl('', { nonNullable: true });

  protected readonly loadingDemo = signal(false);

  protected toggleLoadingDemo(): void {
    this.loadingDemo.set(true);
    setTimeout(() => this.loadingDemo.set(false), 1500);
  }

  protected readonly segmentedValue = signal<'lista' | 'grade'>('lista');
  protected readonly segmentedOptions: SegmentedOption<'lista' | 'grade'>[] = [
    { value: 'lista', label: 'Lista', icon: 'filter' },
    { value: 'grade', label: 'Grade', icon: 'briefcase' },
  ];

  protected readonly tabItems: TabItem[] = [
    { path: 'dashboard', label: 'Dashboard', icon: 'clock' },
    { path: 'vagas-ativas', label: 'Vagas Ativas', icon: 'briefcase' },
  ];
}

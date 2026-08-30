import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { Icon } from '@app/shared/ui';
import type { TabItem } from '@app/shared/ui/tabs/tabs';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon, TranslatePipe],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  readonly items = input.required<TabItem[]>();
  // só usados no bloco de usuário que aparece ≥1024px — abaixo disso a
  // Sidebar não mostra usuário nenhum (fica no topbar/Conta)
  readonly userInitials = input<string>();
  readonly userEmail = input<string>();
  readonly userRoleLabel = input<string>();
}

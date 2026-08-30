import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { Sheet, SegmentedControl, type SegmentedOption } from '@app/shared/ui';
import { AuthService } from '@app/core/auth/auth.service';
import { isStaffRole } from '@app/core/auth/is-staff';

import { PerfilForm } from '@app/features/conta/perfil-form/perfil-form';
import { AparenciaForm } from '@app/features/conta/aparencia-form/aparencia-form';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';

type Aba = 'perfil' | 'aparencia';

const ABA_OPTIONS: SegmentedOption<Aba>[] = [
  { value: 'perfil', label: 'Perfil' },
  { value: 'aparencia', label: 'Aparência' },
];

// gatilho: avatar da topbar em ≥1024px (ver shell.html/shell.scss) — abaixo
// disso o avatar continua levando pra /conta, esse dialog nem monta.
@Component({
  selector: 'app-configuracoes-dialog',
  imports: [Sheet, SegmentedControl, PerfilForm, AparenciaForm, TranslatePipe],
  templateUrl: './configuracoes-dialog.html',
  styleUrl: './configuracoes-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfiguracoesDialog {
  private readonly auth = inject(AuthService);

  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly abaOptions = ABA_OPTIONS;
  protected readonly aba = signal<Aba>('perfil');
  protected readonly isStaff = computed(() => isStaffRole(this.auth.session()?.role));

  protected close(): void {
    this.closed.emit();
  }
}

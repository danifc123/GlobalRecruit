import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Banner, Button } from '@app/shared/ui';
import { ThemeColors, ThemeService } from '@app/core/ui/theme.service';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';

interface ColorField {
  key: keyof ThemeColors;
  label: string;
  default: string;
}

// tons padrão de _tokens.scss — só pra mostrar algo sensato no seletor
// quando ainda não há override (o valor salvo continua null até o admin
// clicar em Salvar, "Restaurar padrão" volta a null de verdade)
const FIELDS: ColorField[] = [
  { key: 'primaryColor', label: 'Primária', default: '#288048' },
  { key: 'accentColor', label: 'Destaque', default: '#e66233' },
  { key: 'successColor', label: 'Sucesso', default: '#1f9d55' },
  { key: 'warningColor', label: 'Aviso', default: '#d99a1b' },
  { key: 'dangerColor', label: 'Perigo', default: '#d1403a' },
];

// só admin/developer (checado pelo componente pai antes de renderizar) —
// personaliza os tons "sólidos" mais usados de cada paleta, aplicado pra
// todo mundo (não é preferência pessoal). Ver ThemeService pra qual
// variável CSS cada cor sobrescreve exatamente.
@Component({
  selector: 'app-aparencia-form',
  imports: [Banner, Button, TranslatePipe],
  templateUrl: './aparencia-form.html',
  styleUrl: './aparencia-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AparenciaForm {
  private readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly fields = FIELDS;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly sucesso = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly colors = signal<ThemeColors>({
    primaryColor: null,
    accentColor: null,
    successColor: null,
    warningColor: null,
    dangerColor: null,
  });

  constructor() {
    this.themeService
      .getTheme()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((theme) => {
        this.colors.set(theme);
        this.loading.set(false);
      });
  }

  protected valorAtual(field: ColorField): string {
    return this.colors()[field.key] ?? field.default;
  }

  protected alterar(field: ColorField, hex: string): void {
    this.colors.update((atual) => ({ ...atual, [field.key]: hex }));
  }

  protected restaurarPadrao(field: ColorField): void {
    this.colors.update((atual) => ({ ...atual, [field.key]: null }));
  }

  protected salvar(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.sucesso.set(false);
    this.erro.set(null);

    this.themeService
      .updateTheme(this.colors())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.sucesso.set(true);
        },
        error: () => {
          this.saving.set(false);
          this.erro.set('Não foi possível salvar o tema.');
        },
      });
  }
}

import { ChangeDetectionStrategy, Component, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { IdGenerator } from '../../utils/id-generator';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';

// Mesmo contrato e visual do app-input, para textos de várias linhas
// (requisitos, notas internas...). O estilo base vem do input.scss.
@Component({
  selector: 'app-textarea',
  imports: [TranslatePipe],
  templateUrl: './textarea.html',
  styleUrls: ['../input/input.scss', './textarea.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Textarea),
      multi: true,
    },
  ],
})
export class Textarea implements ControlValueAccessor {
  readonly label = input<string>();
  readonly placeholder = input('');
  readonly hint = input<string>();
  readonly rows = input(4);

  protected readonly textareaId = inject(IdGenerator).next('app-textarea');
  protected readonly messageId = `${this.textareaId}-message`;
  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected handleInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.value.set(value);
    this.onChange(value);
  }

  protected handleBlur(): void {
    this.onTouched();
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { IdGenerator } from '../../utils/id-generator';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-select',
  imports: [TranslatePipe],
  templateUrl: './select.html',
  styleUrl: './select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Select),
      multi: true,
    },
  ],
})
export class Select implements ControlValueAccessor {
  readonly label = input<string>();
  readonly options = input.required<SelectOption[]>();
  readonly placeholder = input('Selecione...');
  readonly hint = input<string>();
  readonly errorMessage = input<string>();
  readonly required = input(false);

  protected readonly selectId = inject(IdGenerator).next('app-select');
  protected readonly messageId = `${this.selectId}-message`;
  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly touched = signal(false);

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

  protected handleChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.value.set(value);
    this.onChange(value);
  }

  protected handleBlur(): void {
    this.touched.set(true);
    this.onTouched();
  }
}

import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface ChipOption {
  value: string;
  label: string;
  count?: number;
}

// fileira de chips com contagem e scroll horizontal, usada como filtro
// rápido (substitui o header escuro dos mockups: "Todas · 24", "Alta · 9"...)
@Component({
  selector: 'app-chip-filter',
  templateUrl: './chip-filter.html',
  styleUrl: './chip-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChipFilter {
  readonly options = input.required<ChipOption[]>();
  readonly selected = model.required<string>();
}

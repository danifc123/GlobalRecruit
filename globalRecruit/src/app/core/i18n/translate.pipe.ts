import { Pipe, PipeTransform, inject } from '@angular/core';

import { LanguageService } from './language.service';

// impure de propósito — precisa reagir na hora à troca de idioma, sem
// depender de nuance de memoização de pipe puro (ver plano da feature)
@Pipe({ name: 'translate', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  // duas assinaturas de propósito: texto literal sempre volta string; já
  // muitos @Input()/signal opcionais (errorMessage(), hint() etc.) chegam
  // como string | null | undefined antes de serem checados de novo dentro
  // do próprio template (cada chamada ao signal é uma invocação nova pro
  // TypeScript, a checagem do @if não "gruda" na interpolação seguinte)
  transform(text: string, ...params: (string | number)[]): string;
  transform(text: string | null | undefined, ...params: (string | number)[]): string | null | undefined;
  transform(text: string | null | undefined, ...params: (string | number)[]): string | null | undefined {
    if (text == null) return text;
    return this.language.t(text, params);
  }
}

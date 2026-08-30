import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

import { EN_DICTIONARY } from './en.dictionary';

export type Language = 'pt' | 'en';

const STORAGE_KEY = 'gr_language';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly languageSignal = signal<Language>(this.readStored());
  readonly language = this.languageSignal.asReadonly();

  private readStored(): Language {
    if (!this.isBrowser) return 'pt';
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'pt';
  }

  toggle(): void {
    this.set(this.languageSignal() === 'pt' ? 'en' : 'pt');
  }

  set(language: Language): void {
    this.languageSignal.set(language);
    if (this.isBrowser) localStorage.setItem(STORAGE_KEY, language);
  }

  // usável tanto pelo TranslatePipe quanto direto de código .ts (ex.:
  // montar uma mensagem de erro já traduzida antes de guardar num signal)
  t(text: string, params?: (string | number)[]): string {
    const translated = this.languageSignal() === 'en' ? (EN_DICTIONARY[text] ?? text) : text;
    if (!params?.length) return translated;
    return params.reduce<string>(
      (acc, param, index) => acc.replace(`{${index}}`, String(param)),
      translated,
    );
  }
}

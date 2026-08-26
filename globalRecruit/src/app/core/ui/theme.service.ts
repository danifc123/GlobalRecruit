import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

import { environment } from '@env';
import { shadeHex } from '@app/shared/utils/shade';

export interface ThemeColors {
  primaryColor: string | null;
  accentColor: string | null;
  successColor: string | null;
  warningColor: string | null;
  dangerColor: string | null;
}

interface ThemeApi {
  primary_color: string | null;
  accent_color: string | null;
  success_color: string | null;
  warning_color: string | null;
  danger_color: string | null;
}

function toTheme(api: ThemeApi): ThemeColors {
  return {
    primaryColor: api.primary_color,
    accentColor: api.accent_color,
    successColor: api.success_color,
    warningColor: api.warning_color,
    dangerColor: api.danger_color,
  };
}

// paleta curada — cada cor escolhida pelo admin sobrescreve só os tons
// "sólidos" já usados de verdade pelo app (confirmado grepando button.scss
// etc.), não a rampa de 10 degraus inteira. Os tons vizinhos (hover/ativo)
// são derivados por shadeHex, não escolhidos separadamente — ver decisão
// registrada no plano desta feature.
const OVERRIDE_MAP: Record<keyof ThemeColors, (hex: string) => Record<string, string>> = {
  primaryColor: (hex) => ({
    '--gr-color-primary-500': shadeHex(hex, 0.15),
    '--gr-color-primary-600': hex,
    '--gr-color-primary-700': shadeHex(hex, -0.15),
  }),
  accentColor: (hex) => ({
    '--gr-color-accent-500': hex,
    '--gr-color-accent-600': shadeHex(hex, -0.15),
  }),
  successColor: (hex) => ({
    '--gr-color-success-500': hex,
    '--gr-color-success-700': shadeHex(hex, -0.2),
  }),
  warningColor: (hex) => ({
    '--gr-color-warning-500': hex,
    '--gr-color-warning-700': shadeHex(hex, -0.2),
  }),
  dangerColor: (hex) => ({
    '--gr-color-danger-500': hex,
    '--gr-color-danger-700': shadeHex(hex, -0.2),
  }),
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly baseUrl = `${environment.apiUrl}/settings/theme`;

  getTheme(): Observable<ThemeColors> {
    return this.http.get<ThemeApi>(this.baseUrl).pipe(map(toTheme));
  }

  updateTheme(colors: ThemeColors): Observable<ThemeColors> {
    return this.http
      .patch<ThemeApi>(this.baseUrl, {
        primary_color: colors.primaryColor,
        accent_color: colors.accentColor,
        success_color: colors.successColor,
        warning_color: colors.warningColor,
        danger_color: colors.dangerColor,
      })
      .pipe(
        map(toTheme),
        tap((theme) => this.apply(theme)),
      );
  }

  // busca o tema salvo e aplica como custom properties no :root — chamado
  // uma vez pelo Shell (única raiz de toda rota autenticada). Login não
  // reflete o tema customizado de propósito (carrega só dentro do Shell).
  load(): void {
    if (!this.isBrowser) return;
    // falha em silêncio (fica no tema padrão) — não é crítico o bastante
    // pra interromper nada, e pode disparar antes do token de acesso estar
    // pronto (Shell monta antes da sessão terminar de restaurar)
    this.getTheme().subscribe({ next: (theme) => this.apply(theme), error: () => {} });
  }

  private apply(theme: ThemeColors): void {
    if (!this.isBrowser) return;
    const root = document.documentElement.style;
    for (const key of Object.keys(OVERRIDE_MAP) as (keyof ThemeColors)[]) {
      const hex = theme[key];
      const vars = hex ? OVERRIDE_MAP[key](hex) : null;
      const allVarNames = Object.keys(OVERRIDE_MAP[key]('#000000'));
      for (const varName of allVarNames) {
        if (vars) root.setProperty(varName, vars[varName]);
        else root.removeProperty(varName);
      }
    }
  }
}

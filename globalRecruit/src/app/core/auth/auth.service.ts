import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { environment } from '@env';
import { decodeAccessToken } from '@app/core/auth/jwt';
import { Session } from '@app/core/models/auth';

const REFRESH_TOKEN_KEY = 'gr_refresh_token';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
}

interface RefreshResponse {
  access_token: string;
}

interface MeResponse {
  id: string;
  email: string;
  role: Session['role'];
  partner_project_id: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // token de acesso só existe em memória — nunca vai pro localStorage,
  // reduz a janela de exfiltração por XSS (expira em minutos de qualquer forma)
  private accessTokenValue: string | null = null;

  private readonly sessionSignal = signal<Session | null>(null);
  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);

  get accessToken(): string | null {
    return this.accessTokenValue;
  }

  async restoreSession(): Promise<void> {
    if (!this.isBrowser) return;
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return;

    try {
      await this.refreshAccessToken(refreshToken);
      await this.loadProfile();
    } catch {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }

  private async loadProfile(): Promise<void> {
    const me = await firstValueFrom(
      this.http.get<MeResponse>(`${environment.apiUrl}/auth/me`),
    );
    const current = this.sessionSignal();
    if (current) {
      this.sessionSignal.set({ ...current, email: me.email });
    }
  }

  async login(email: string, password: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }),
    );
    this.setAccessToken(response.access_token);
    if (this.isBrowser) {
      localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token);
    }
    await this.loadProfile();
  }

  logout(): void {
    this.accessTokenValue = null;
    this.sessionSignal.set(null);
    if (this.isBrowser) {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await firstValueFrom(
      this.http.post<RefreshResponse>(`${environment.apiUrl}/auth/refresh`, {
        refresh_token: refreshToken,
      }),
    );
    this.setAccessToken(response.access_token);
    return response.access_token;
  }

  get storedRefreshToken(): string | null {
    return this.isBrowser ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
  }

  private setAccessToken(token: string): void {
    this.accessTokenValue = token;
    const claims = decodeAccessToken(token);
    this.sessionSignal.set(
      claims
        ? {
            userId: claims.sub,
            email: '',
            role: claims.role,
            partnerProjectId: claims.partner_project_id,
          }
        : null,
    );
  }
}

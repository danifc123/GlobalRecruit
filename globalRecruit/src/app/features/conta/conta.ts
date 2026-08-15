import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { Icon } from '@app/shared/ui';
import { environment } from '@env';
import { AuthService } from '@app/core/auth/auth.service';
import { UsersService } from '@app/core/data/users.service';
import { ProjetosParceirosService } from '@app/core/data/projetos-parceiros.service';

const ROLE_LABELS: Record<string, string> = {
  admin: 'ADMIN',
  recruiter: 'RECRUTADOR',
  developer: 'DEVELOPER',
};

@Component({
  selector: 'app-conta',
  imports: [Icon, RouterLink],
  templateUrl: './conta.html',
  styleUrl: './conta.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Conta {
  private readonly http = inject(HttpClient);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly usersService = inject(UsersService);
  private readonly projetosService = inject(ProjetosParceirosService);

  protected readonly isStaff = computed(() => {
    const role = this.auth.session()?.role;
    return role === 'admin' || role === 'developer';
  });

  protected readonly initials = computed(() => {
    const email = this.auth.session()?.email ?? '';
    const local = email.split('@')[0] ?? '';
    const partes = local.split(/[._-]+/).filter(Boolean);
    return (partes.length > 1 ? partes[0][0] + partes[1][0] : local.slice(0, 2)).toUpperCase();
  });

  protected readonly roleLabel = computed(() => ROLE_LABELS[this.auth.session()?.role ?? ''] ?? '');

  protected readonly usuariosCount = signal<number | null>(null);
  protected readonly projetosCount = signal<number | null>(null);
  protected readonly apiOnline = signal(true);

  constructor() {
    if (this.isStaff()) {
      this.usersService
        .list()
        .pipe(takeUntilDestroyed())
        .subscribe({ next: (users) => this.usuariosCount.set(users.length) });
      this.projetosService
        .list()
        .pipe(takeUntilDestroyed())
        .subscribe({ next: (projetos) => this.projetosCount.set(projetos.length) });
    }

    this.http
      .get(`${environment.apiUrl.replace(/\/api$/, '')}/health`)
      .pipe(
        catchError(() => {
          this.apiOnline.set(false);
          return of(null);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}

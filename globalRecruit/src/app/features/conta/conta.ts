import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { Icon } from '@app/shared/ui';
import { environment } from '@env';
import { AuthService } from '@app/core/auth/auth.service';
import { isStaffRole } from '@app/core/auth/is-staff';
import { UsersService } from '@app/core/data/users.service';
import { ProjetosParceirosService } from '@app/core/data/projetos-parceiros.service';
import { getEmailInitials, getInitials } from '@app/shared/utils/initials';
import { LanguageService } from '@app/core/i18n/language.service';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';
import { PerfilForm } from './perfil-form/perfil-form';

// caixa alta deliberada — visual do badge desta tela (não é o mesmo
// ROLE_LABELS de core/models/user.ts, que é usado como texto normal)
const ROLE_LABELS: Record<string, string> = {
  admin: 'ADMIN',
  recruiter: 'RECRUTADOR',
  developer: 'DEVELOPER',
};

@Component({
  selector: 'app-conta',
  imports: [Icon, RouterLink, PerfilForm, TranslatePipe],
  templateUrl: './conta.html',
  styleUrl: './conta.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Conta {
  private readonly http = inject(HttpClient);
  protected readonly auth = inject(AuthService);
  protected readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly usersService = inject(UsersService);
  private readonly projetosService = inject(ProjetosParceirosService);

  protected readonly isStaff = computed(() => isStaffRole(this.auth.session()?.role));

  protected readonly initials = computed(() => {
    const session = this.auth.session();
    return session?.nome ? getInitials(session.nome) : getEmailInitials(session?.email ?? '');
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

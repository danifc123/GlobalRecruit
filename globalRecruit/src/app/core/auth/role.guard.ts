import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '@app/core/auth/auth.service';
import { Role } from '@app/core/models/auth';

// uso: { canActivate: [roleGuard(['admin', 'recruiter'])] } na definição da rota
export function roleGuard(allowedRoles: Role[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const session = auth.session();
    if (!session) return router.createUrlTree(['/login']);
    if (!allowedRoles.includes(session.role)) return router.createUrlTree(['/dashboard']);

    return true;
  };
}

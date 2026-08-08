import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { environment } from '@env';
import { AuthService } from '@app/core/auth/auth.service';

const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApiRequest = req.url.startsWith(environment.apiUrl);
  const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => req.url.includes(path));

  const token = auth.accessToken;
  const authedReq =
    isApiRequest && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authedReq).pipe(
    catchError((error: unknown) => {
      const shouldTryRefresh =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiRequest &&
        !isAuthEndpoint &&
        auth.storedRefreshToken;

      if (!shouldTryRefresh) {
        return throwError(() => error);
      }

      // access token expirou no meio da sessão — tenta renovar 1x e repete a
      // requisição original; se o refresh também falhar, desloga de vez
      return from(auth.refreshAccessToken(auth.storedRefreshToken!)).pipe(
        switchMap((newToken) =>
          next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })),
        ),
        catchError((refreshError: unknown) => {
          auth.logout();
          router.navigate(['/login']);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '@env';
import { AppUser, UserCreate } from '@app/core/models/user';

interface UserApi {
  id: string;
  email: string;
  role: AppUser['role'];
  partner_project_id: string | null;
  is_active: boolean;
}

function toUser(api: UserApi): AppUser {
  return {
    id: api.id,
    email: api.email,
    role: api.role,
    partnerProjectId: api.partner_project_id,
    isActive: api.is_active,
  };
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  list(): Observable<AppUser[]> {
    return this.http.get<UserApi[]>(this.baseUrl).pipe(map((items) => items.map(toUser)));
  }

  create(user: UserCreate): Observable<AppUser> {
    return this.http
      .post<UserApi>(this.baseUrl, {
        email: user.email,
        password: user.password,
        role: user.role,
        partner_project_id: user.partnerProjectId ?? null,
      })
      .pipe(map(toUser));
  }
}

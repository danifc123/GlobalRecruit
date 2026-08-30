import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '@env';
import { AppUser, UserCreate } from '@app/core/models/user';

interface UserApi {
  id: string;
  email: string;
  nome: string | null;
  role: AppUser['role'];
  projetos: { id: string; nome: string }[];
  is_active: boolean;
}

function toUser(api: UserApi): AppUser {
  return {
    id: api.id,
    email: api.email,
    nome: api.nome,
    role: api.role,
    projetos: api.projetos,
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
        project_ids: user.projetoIds ?? [],
      })
      .pipe(map(toUser));
  }

  updateMe(nome: string | null, email: string): Observable<AppUser> {
    return this.http.patch<UserApi>(`${this.baseUrl}/me`, { nome, email }).pipe(map(toUser));
  }

  changePassword(senhaAtual: string, novaSenha: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/me/password`, {
      senha_atual: senhaAtual,
      nova_senha: novaSenha,
    });
  }

  setActive(id: string, isActive: boolean): Observable<AppUser> {
    return this.http
      .patch<UserApi>(`${this.baseUrl}/${id}/status`, { is_active: isActive })
      .pipe(map(toUser));
  }

  setProjetos(id: string, projetoIds: string[]): Observable<AppUser> {
    return this.http
      .patch<UserApi>(`${this.baseUrl}/${id}/projetos`, { project_ids: projetoIds })
      .pipe(map(toUser));
  }
}

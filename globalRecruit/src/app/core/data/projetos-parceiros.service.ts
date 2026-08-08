import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '@env';
import { ProjetoParceiro } from '@app/core/models/projeto-parceiro';

interface ProjetoParceiroApi {
  id: string;
  nome: string;
  cliente: string;
  status: string;
  created_at: string;
}

function toProjeto(api: ProjetoParceiroApi): ProjetoParceiro {
  return { id: api.id, nome: api.nome, cliente: api.cliente, status: api.status, createdAt: api.created_at };
}

@Injectable({ providedIn: 'root' })
export class ProjetosParceirosService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/projetos-parceiros`;

  list(): Observable<ProjetoParceiro[]> {
    return this.http.get<ProjetoParceiroApi[]>(this.baseUrl).pipe(map((items) => items.map(toProjeto)));
  }

  create(nome: string, cliente: string): Observable<ProjetoParceiro> {
    return this.http.post<ProjetoParceiroApi>(this.baseUrl, { nome, cliente }).pipe(map(toProjeto));
  }
}

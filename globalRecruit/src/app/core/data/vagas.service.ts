import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '@env';
import { StatusVaga, Vaga, VagaCreate, VagaPage } from '@app/core/models/vaga';

interface VagaApi {
  id: string;
  projeto_id: string;
  cliente: string;
  cargo: string;
  idioma: string | null;
  pais: string | null;
  modalidade: string | null;
  salario: number | null;
  comissao: number | null;
  prioridade: Vaga['prioridade'];
  status: StatusVaga;
  created_at: string;
  candidatos_count: number;
}

interface VagaPageApi {
  items: VagaApi[];
  page: number;
  page_size: number;
  total: number;
}

function toVaga(api: VagaApi): Vaga {
  return {
    id: api.id,
    projetoId: api.projeto_id,
    cliente: api.cliente,
    cargo: api.cargo,
    idioma: api.idioma,
    pais: api.pais,
    modalidade: api.modalidade,
    salario: api.salario,
    comissao: api.comissao,
    prioridade: api.prioridade,
    status: api.status,
    createdAt: api.created_at,
    candidatosCount: api.candidatos_count,
  };
}

@Injectable({ providedIn: 'root' })
export class VagasService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/vagas`;

  get(id: string): Observable<Vaga> {
    return this.http.get<VagaApi>(`${this.baseUrl}/${id}`).pipe(map(toVaga));
  }

  list(page = 0, pageSize = 20, status?: StatusVaga): Observable<VagaPage> {
    let params = new HttpParams().set('page', page).set('page_size', pageSize);
    if (status) params = params.set('status', status);

    return this.http
      .get<VagaPageApi>(this.baseUrl, { params })
      .pipe(
        map((res) => ({
          items: res.items.map(toVaga),
          page: res.page,
          pageSize: res.page_size,
          total: res.total,
        })),
      );
  }

  update(id: string, vaga: VagaCreate): Observable<Vaga> {
    return this.http
      .patch<VagaApi>(`${this.baseUrl}/${id}`, {
        projeto_id: vaga.projetoId,
        cliente: vaga.cliente,
        cargo: vaga.cargo,
        idioma: vaga.idioma,
        pais: vaga.pais,
        modalidade: vaga.modalidade,
        salario: vaga.salario,
        comissao: vaga.comissao,
        prioridade: vaga.prioridade,
      })
      .pipe(map(toVaga));
  }

  updatePrioridade(id: string, prioridade: Vaga['prioridade']): Observable<Vaga> {
    return this.http
      .patch<VagaApi>(`${this.baseUrl}/${id}/prioridade`, { prioridade })
      .pipe(map(toVaga));
  }

  updateStatus(id: string, status: StatusVaga): Observable<Vaga> {
    return this.http.patch<VagaApi>(`${this.baseUrl}/${id}/status`, { status }).pipe(map(toVaga));
  }

  create(vaga: VagaCreate): Observable<Vaga> {
    return this.http
      .post<VagaApi>(this.baseUrl, {
        projeto_id: vaga.projetoId,
        cliente: vaga.cliente,
        cargo: vaga.cargo,
        idioma: vaga.idioma,
        pais: vaga.pais,
        modalidade: vaga.modalidade,
        salario: vaga.salario,
        comissao: vaga.comissao,
        prioridade: vaga.prioridade,
      })
      .pipe(map(toVaga));
  }
}

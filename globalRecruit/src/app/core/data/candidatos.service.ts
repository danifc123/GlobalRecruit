import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '@env';
import { Candidato, CandidatoCreate, Estagio, OutraCandidatura } from '@app/core/models/candidato';

interface OutraCandidaturaApi {
  id: string;
  vaga_id: string;
  vaga_cargo: string;
  vaga_cliente: string;
  estagio_atual: Estagio | null;
}

interface CandidatoApi {
  id: string;
  nome: string;
  email: string;
  vaga_id: string;
  created_at: string;
  estagio_atual: Estagio | null;
  historico: { id: string; estagio: Estagio; updated_at: string }[];
  outras_candidaturas: OutraCandidaturaApi[];
}

function toOutraCandidatura(api: OutraCandidaturaApi): OutraCandidatura {
  return {
    id: api.id,
    vagaId: api.vaga_id,
    vagaCargo: api.vaga_cargo,
    vagaCliente: api.vaga_cliente,
    estagioAtual: api.estagio_atual,
  };
}

function toCandidato(api: CandidatoApi): Candidato {
  return {
    id: api.id,
    nome: api.nome,
    email: api.email,
    vagaId: api.vaga_id,
    createdAt: api.created_at,
    estagioAtual: api.estagio_atual,
    historico: (api.historico ?? []).map((h) => ({ id: h.id, estagio: h.estagio, updatedAt: h.updated_at })),
    outrasCandidaturas: (api.outras_candidaturas ?? []).map(toOutraCandidatura),
  };
}

@Injectable({ providedIn: 'root' })
export class CandidatosService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/candidatos`;

  get(id: string): Observable<Candidato> {
    return this.http.get<CandidatoApi>(`${this.baseUrl}/${id}`).pipe(map(toCandidato));
  }

  listByVaga(vagaId: string): Observable<Candidato[]> {
    const params = new HttpParams().set('vaga_id', vagaId);
    return this.http
      .get<CandidatoApi[]>(this.baseUrl, { params })
      .pipe(map((items) => items.map(toCandidato)));
  }

  create(candidato: CandidatoCreate): Observable<Candidato> {
    return this.http
      .post<CandidatoApi>(this.baseUrl, {
        nome: candidato.nome,
        email: candidato.email,
        vaga_id: candidato.vagaId,
      })
      .pipe(map(toCandidato));
  }

  updateStage(candidatoId: string, estagio: Estagio): Observable<Candidato> {
    return this.http
      .patch<CandidatoApi>(`${this.baseUrl}/${candidatoId}/pipeline`, { estagio })
      .pipe(map(toCandidato));
  }
}

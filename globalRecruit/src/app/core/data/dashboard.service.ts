import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '@env';
import { DashboardStats } from '@app/core/models/dashboard';

interface DashboardStatsApi {
  vagas_abertas: number;
  candidatos_em_pipeline: number;
  candidatos_contratados: number;
  clientes_ativos: number;
  pct_modalidade_remota: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  stats(): Observable<DashboardStats> {
    return this.http.get<DashboardStatsApi>(`${environment.apiUrl}/dashboard/stats`).pipe(
      map((api) => ({
        vagasAbertas: api.vagas_abertas,
        candidatosEmPipeline: api.candidatos_em_pipeline,
        candidatosContratados: api.candidatos_contratados,
        clientesAtivos: api.clientes_ativos,
        pctModalidadeRemota: api.pct_modalidade_remota,
      })),
    );
  }
}

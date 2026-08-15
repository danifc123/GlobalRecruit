import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '@env';
import { DashboardStats } from '@app/core/models/dashboard';

interface DashboardStatsApi {
  vagas_abertas: number;
  vagas_alta_prioridade: number;
  candidatos_em_pipeline: number;
  candidatos_contratados: number;
  clientes_ativos: number;
  pct_modalidade_remota: number;
  vagas_novas_semana: number;
  vagas_por_idioma: { idioma: string; count: number }[];
  candidatos_parados: { id: string; nome: string; vaga_cargo: string; dias_parado: number }[];
  vagas_sem_candidato: { id: string; cargo: string; cliente: string }[];
  funil_por_etapa: { estagio: string; count: number }[];
  propostas_aguardando: { id: string; nome: string; vaga_cargo: string; enviada_em: string }[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  stats(): Observable<DashboardStats> {
    return this.http.get<DashboardStatsApi>(`${environment.apiUrl}/dashboard/stats`).pipe(
      map((api) => ({
        vagasAbertas: api.vagas_abertas,
        vagasAltaPrioridade: api.vagas_alta_prioridade,
        candidatosEmPipeline: api.candidatos_em_pipeline,
        candidatosContratados: api.candidatos_contratados,
        clientesAtivos: api.clientes_ativos,
        pctModalidadeRemota: api.pct_modalidade_remota,
        vagasNovasSemana: api.vagas_novas_semana,
        vagasPorIdioma: api.vagas_por_idioma,
        candidatosParados: api.candidatos_parados.map((c) => ({
          id: c.id,
          nome: c.nome,
          vagaCargo: c.vaga_cargo,
          diasParado: c.dias_parado,
        })),
        vagasSemCandidato: api.vagas_sem_candidato,
        funilPorEtapa: api.funil_por_etapa,
        propostasAguardando: api.propostas_aguardando.map((p) => ({
          id: p.id,
          nome: p.nome,
          vagaCargo: p.vaga_cargo,
          enviadaEm: p.enviada_em,
        })),
      })),
    );
  }
}

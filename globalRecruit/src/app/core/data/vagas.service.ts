import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '@env';
import {
  AcaoImportacao,
  ResultadoImportacao,
  StatusVaga,
  Vaga,
  VagaCreate,
  VagaPage,
} from '@app/core/models/vaga';

interface VagaApi {
  id: string;
  projeto_id: string;
  codigo: string | null;
  cliente: string;
  cargo: string;
  idioma: string | null;
  pais: string | null;
  localizacao: string | null;
  modalidade: string | null;
  headcount: string | null;
  data_inicio: string | null;
  salario: number | null;
  faixa_salarial: string | null;
  moeda: string | null;
  tipo_salario: string | null;
  comissao: number | null;
  beneficios: string | null;
  realocacao: string | null;
  requisitos: string | null;
  notas_internas: string | null;
  jd_nome: string | null;
  jd_url: string | null;
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

interface ResultadoImportacaoApi {
  dry_run: boolean;
  aba: string;
  criadas: number;
  atualizadas: number;
  ignoradas: number;
  erros: { linha: number; motivo: string }[];
  itens: { linha: number; codigo: string | null; cargo: string | null; cliente: string | null; acao: AcaoImportacao }[];
}

function toVaga(api: VagaApi): Vaga {
  return {
    id: api.id,
    projetoId: api.projeto_id,
    codigo: api.codigo,
    cliente: api.cliente,
    cargo: api.cargo,
    idioma: api.idioma,
    pais: api.pais,
    localizacao: api.localizacao,
    modalidade: api.modalidade,
    headcount: api.headcount,
    dataInicio: api.data_inicio,
    salario: api.salario,
    faixaSalarial: api.faixa_salarial,
    moeda: api.moeda,
    tipoSalario: api.tipo_salario,
    comissao: api.comissao,
    beneficios: api.beneficios,
    realocacao: api.realocacao,
    requisitos: api.requisitos,
    notasInternas: api.notas_internas,
    jdNome: api.jd_nome,
    jdUrl: api.jd_url,
    prioridade: api.prioridade,
    status: api.status,
    createdAt: api.created_at,
    candidatosCount: api.candidatos_count,
  };
}

function toVagaPayload(vaga: VagaCreate): Record<string, unknown> {
  return {
    projeto_id: vaga.projetoId,
    codigo: vaga.codigo,
    cliente: vaga.cliente,
    cargo: vaga.cargo,
    idioma: vaga.idioma,
    pais: vaga.pais,
    localizacao: vaga.localizacao,
    modalidade: vaga.modalidade,
    headcount: vaga.headcount,
    data_inicio: vaga.dataInicio,
    faixa_salarial: vaga.faixaSalarial,
    moeda: vaga.moeda,
    tipo_salario: vaga.tipoSalario,
    comissao: vaga.comissao,
    beneficios: vaga.beneficios,
    realocacao: vaga.realocacao,
    requisitos: vaga.requisitos,
    notas_internas: vaga.notasInternas,
    jd_nome: vaga.jdNome,
    jd_url: vaga.jdUrl,
    prioridade: vaga.prioridade,
  };
}

function toResultadoImportacao(api: ResultadoImportacaoApi): ResultadoImportacao {
  return {
    dryRun: api.dry_run,
    aba: api.aba,
    criadas: api.criadas,
    atualizadas: api.atualizadas,
    ignoradas: api.ignoradas,
    erros: api.erros,
    itens: api.itens,
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
    return this.http.patch<VagaApi>(`${this.baseUrl}/${id}`, toVagaPayload(vaga)).pipe(map(toVaga));
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
    return this.http.post<VagaApi>(this.baseUrl, toVagaPayload(vaga)).pipe(map(toVaga));
  }

  /** Importa a planilha .xlsx do cliente; com dryRun=true só pré-visualiza. */
  importar(file: File, projetoId: string, dryRun: boolean): Observable<ResultadoImportacao> {
    const body = new FormData();
    body.append('file', file);
    body.append('projeto_id', projetoId);
    body.append('dry_run', String(dryRun));
    return this.http
      .post<ResultadoImportacaoApi>(`${this.baseUrl}/importar`, body)
      .pipe(map(toResultadoImportacao));
  }
}

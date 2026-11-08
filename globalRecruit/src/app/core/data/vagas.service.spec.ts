import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '@env';
import { VagasService } from '@app/core/data/vagas.service';
import { ResultadoImportacao, Vaga } from '@app/core/models/vaga';

const BASE_URL = `${environment.apiUrl}/vagas`;

const VAGA_API = {
  id: 'v1',
  projeto_id: 'p1',
  codigo: 'DSR-001',
  cliente: 'Acme',
  cargo: 'Support Agent',
  idioma: 'German',
  pais: 'Portugal',
  localizacao: 'Lisbon',
  modalidade: 'Hybrid',
  headcount: '3',
  data_inicio: 'ASAP',
  salario: 2500,
  faixa_salarial: '€1,700–€1,900/ month',
  moeda: 'EUR',
  tipo_salario: 'GROSS',
  comissao: 300,
  beneficios: 'Meal card',
  realocacao: 'Flight',
  requisitos: 'C1\nB2',
  notas_internas: 'nota',
  jd_nome: 'jd.pdf',
  jd_url: 'https://exemplo.com/jd.pdf',
  prioridade: 'alta',
  status: 'aberta',
  created_at: '2026-11-06T10:00:00Z',
  candidatos_count: 2,
  traducoes: { requisitos: 'C1 e B2', data_inicio: 'O quanto antes', faixa_salarial: 'negociável' },
};

describe('VagasService', () => {
  let service: VagasService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(VagasService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('get converte os campos novos da vaga de snake_case para camelCase', () => {
    let vaga: Vaga | undefined;

    service.get('v1').subscribe((resultado) => (vaga = resultado));
    http.expectOne(`${BASE_URL}/v1`).flush(VAGA_API);

    expect(vaga).toMatchObject({
      codigo: 'DSR-001',
      localizacao: 'Lisbon',
      headcount: '3',
      dataInicio: 'ASAP',
      faixaSalarial: '€1,700–€1,900/ month',
      moeda: 'EUR',
      tipoSalario: 'GROSS',
      beneficios: 'Meal card',
      realocacao: 'Flight',
      requisitos: 'C1\nB2',
      notasInternas: 'nota',
      jdNome: 'jd.pdf',
      jdUrl: 'https://exemplo.com/jd.pdf',
      candidatosCount: 2,
      traducoes: { requisitos: 'C1 e B2', dataInicio: 'O quanto antes', faixaSalarial: 'negociável' },
    });
  });

  it('list pede page_size 500 e status quando informados', () => {
    service.list(0, 500, 'aberta').subscribe();

    const req = http.expectOne((r) => r.url === BASE_URL);
    expect(req.request.params.get('page_size')).toBe('500');
    expect(req.request.params.get('status')).toBe('aberta');
    req.flush({ items: [], page: 0, page_size: 500, total: 0 });
  });

  it('create envia os campos novos em snake_case e não envia salario', () => {
    service
      .create({
        projetoId: 'p1',
        cliente: 'Acme',
        cargo: 'Support Agent',
        prioridade: 'media',
        codigo: 'DSR-050',
        faixaSalarial: '1,250EUR per month',
        tipoSalario: 'NET',
        notasInternas: 'linha 1\nlinha 2',
        jdUrl: 'https://exemplo.com/jd.pdf',
      })
      .subscribe();

    const req = http.expectOne(BASE_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      projeto_id: 'p1',
      codigo: 'DSR-050',
      faixa_salarial: '1,250EUR per month',
      tipo_salario: 'NET',
      notas_internas: 'linha 1\nlinha 2',
      jd_url: 'https://exemplo.com/jd.pdf',
    });
    expect('salario' in req.request.body).toBe(false);
    req.flush(VAGA_API);
  });

  it('importar envia multipart com arquivo, projeto e dry_run e converte o resumo', () => {
    const arquivo = new File(['conteudo'], 'vagas.xlsx');
    let resultado: ResultadoImportacao | undefined;

    service.importar(arquivo, 'p1', true).subscribe((resposta) => (resultado = resposta));

    const req = http.expectOne(`${BASE_URL}/importar`);
    const corpo = req.request.body as FormData;
    expect(req.request.method).toBe('POST');
    expect((corpo.get('file') as File).name).toBe('vagas.xlsx');
    expect(corpo.get('projeto_id')).toBe('p1');
    expect(corpo.get('dry_run')).toBe('true');
    req.flush({
      dry_run: true,
      aba: 'Active Roles - Live Data Feed',
      criadas: 2,
      atualizadas: 1,
      ignoradas: 1,
      erros: [{ linha: 6, motivo: 'STATUS "FILLED" não reconhecido' }],
      itens: [{ linha: 2, codigo: 'DSR-001', cargo: 'Support Agent', cliente: 'Acme', acao: 'criar' }],
    });

    expect(resultado).toEqual({
      dryRun: true,
      aba: 'Active Roles - Live Data Feed',
      criadas: 2,
      atualizadas: 1,
      ignoradas: 1,
      erros: [{ linha: 6, motivo: 'STATUS "FILLED" não reconhecido' }],
      itens: [{ linha: 2, codigo: 'DSR-001', cargo: 'Support Agent', cliente: 'Acme', acao: 'criar' }],
    });
  });
});

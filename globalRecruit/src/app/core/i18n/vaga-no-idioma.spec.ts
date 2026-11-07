import { Vaga } from '@app/core/models/vaga';
import { temTraducaoExibida, vagaNoIdioma } from './vaga-no-idioma';

const VAGA: Vaga = {
  id: 'v1',
  projetoId: 'p1',
  codigo: 'DSR-001',
  cliente: 'Acme',
  cargo: 'Customer Support Agent',
  idioma: 'German',
  pais: 'Portugal',
  localizacao: 'Lisbon',
  modalidade: 'Hybrid',
  headcount: '3',
  dataInicio: 'ASAP',
  salario: null,
  faixaSalarial: 'negotiable',
  moeda: 'EUR',
  tipoSalario: 'GROSS',
  comissao: null,
  beneficios: 'Meal card',
  realocacao: null,
  requisitos: 'Fluent German (C1)',
  notasInternas: 'Client prefers Lisbon',
  jdNome: null,
  jdUrl: null,
  prioridade: 'media',
  status: 'aberta',
  createdAt: '2026-11-07T10:00:00Z',
  candidatosCount: 0,
  traducoes: { requisitos: 'Alemão fluente (C1)', modalidade: 'Híbrido', faixaSalarial: 'negociável' },
};

describe('vagaNoIdioma', () => {
  it('em português troca só os campos que têm tradução', () => {
    const exibida = vagaNoIdioma(VAGA, 'pt');

    expect(exibida.requisitos).toBe('Alemão fluente (C1)');
    expect(exibida.modalidade).toBe('Híbrido');
    expect(exibida.faixaSalarial).toBe('negociável');
    expect(exibida.beneficios).toBe('Meal card');
    expect(exibida.cargo).toBe('Customer Support Agent');
    expect(exibida.notasInternas).toBe('Client prefers Lisbon');
  });

  it('em inglês devolve o original', () => {
    expect(vagaNoIdioma(VAGA, 'en')).toBe(VAGA);
  });

  it('não altera o objeto original', () => {
    vagaNoIdioma(VAGA, 'pt');

    expect(VAGA.requisitos).toBe('Fluent German (C1)');
  });
});

describe('temTraducaoExibida', () => {
  it('é verdadeiro em português quando algum campo tem tradução', () => {
    expect(temTraducaoExibida(VAGA, 'pt')).toBe(true);
  });

  it('é falso em inglês', () => {
    expect(temTraducaoExibida(VAGA, 'en')).toBe(false);
  });

  it('é falso sem nenhuma tradução', () => {
    expect(temTraducaoExibida({ ...VAGA, traducoes: {} }, 'pt')).toBe(false);
  });
});

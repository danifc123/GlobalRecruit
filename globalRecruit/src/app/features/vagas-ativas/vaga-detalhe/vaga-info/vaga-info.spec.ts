import { TestBed } from '@angular/core/testing';

import { Vaga } from '@app/core/models/vaga';
import { VagaInfo } from './vaga-info';

const VAGA_BASE: Vaga = {
  id: 'v1',
  projetoId: 'p1',
  codigo: null,
  cliente: 'Acme',
  cargo: 'Support Agent',
  idioma: null,
  pais: null,
  localizacao: null,
  modalidade: null,
  headcount: null,
  dataInicio: null,
  salario: null,
  faixaSalarial: null,
  moeda: null,
  tipoSalario: null,
  comissao: null,
  beneficios: null,
  realocacao: null,
  requisitos: null,
  notasInternas: null,
  jdNome: null,
  jdUrl: null,
  prioridade: 'media',
  status: 'aberta',
  createdAt: '2026-11-06T10:00:00Z',
  candidatosCount: 0,
  traducoes: {},
};

function renderizar(campos: Partial<Vaga>): HTMLElement {
  const fixture = TestBed.createComponent(VagaInfo);
  fixture.componentRef.setInput('vaga', { ...VAGA_BASE, ...campos });
  fixture.detectChanges();
  return fixture.nativeElement;
}

describe('VagaInfo', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [VagaInfo] }));

  it('vaga com link da JD mostra "Ver JD" apontando para o endereço, em nova aba', () => {
    const element = renderizar({ jdUrl: 'https://exemplo.com/jd.pdf', jdNome: 'jd.pdf' });

    const link = element.querySelector<HTMLAnchorElement>('a')!;
    expect(link.textContent).toContain('Ver JD');
    expect(link.getAttribute('href')).toBe('https://exemplo.com/jd.pdf');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('vaga sem link da JD não mostra "Ver JD"', () => {
    const element = renderizar({ codigo: 'DSR-001' });

    expect(element.querySelector('a')).toBeNull();
    expect(element.textContent).toContain('DSR-001');
  });

  it('link da JD que não é http(s) não vira link', () => {
    const element = renderizar({ jdUrl: 'javascript:alert(1)' });

    expect(element.querySelector('a')).toBeNull();
  });

  it('requisitos e notas internas preservam quebras de linha', () => {
    const element = renderizar({ requisitos: 'C1\nB2', notasInternas: 'nota 1\nnota 2' });

    const multilinha = element.querySelectorAll('.vaga-info__valor--multilinha');
    expect(multilinha.length).toBe(2);
    expect(multilinha[0].textContent).toBe('C1\nB2');
  });

  it('faixa salarial aparece com moeda e tipo, e cai no salário legado sem faixa', () => {
    expect(renderizar({ faixaSalarial: '1,250 per month', moeda: 'EUR', tipoSalario: 'GROSS' }).textContent).toContain(
      '1,250 per month · EUR · GROSS',
    );
    expect(renderizar({ salario: 2500 }).textContent).toContain('2500');
  });
});

describe('VagaInfo — tradução automática', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [VagaInfo] }));

  function montar(estado: 'nenhuma' | 'traduzida' | 'original') {
    const fixture = TestBed.createComponent(VagaInfo);
    fixture.componentRef.setInput('vaga', { ...VAGA_BASE, requisitos: 'Alemão fluente (C1)' });
    fixture.componentRef.setInput('estadoTraducao', estado);
    fixture.detectChanges();
    const cliques: number[] = [];
    fixture.componentInstance.alternarOriginal.subscribe(() => cliques.push(1));
    return { element: fixture.nativeElement as HTMLElement, cliques };
  }

  it('com texto traduzido mostra o aviso e o link "Ver original"', () => {
    const { element } = montar('traduzida');

    expect(element.textContent).toContain('Tradução automática');
    expect(element.querySelector('button')!.textContent).toContain('Ver original');
  });

  it('mostrando o original o link vira "Ver tradução"', () => {
    const { element } = montar('original');

    expect(element.querySelector('button')!.textContent).toContain('Ver tradução');
  });

  it('sem tradução não mostra aviso nem link', () => {
    const { element } = montar('nenhuma');

    expect(element.textContent).not.toContain('Tradução automática');
    expect(element.querySelector('button')).toBeNull();
  });

  it('clicar no link avisa o detalhe para alternar', () => {
    const { element, cliques } = montar('traduzida');

    element.querySelector('button')!.click();

    expect(cliques.length).toBe(1);
  });
});

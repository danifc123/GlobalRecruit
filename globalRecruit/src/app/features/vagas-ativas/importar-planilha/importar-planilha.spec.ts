import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { VagasService } from '@app/core/data/vagas.service';
import { ResultadoImportacao } from '@app/core/models/vaga';
import { ImportarPlanilha } from './importar-planilha';

const RESUMO_PREVIA: ResultadoImportacao = {
  dryRun: true,
  aba: 'Active Roles - Live Data Feed',
  criadas: 2,
  atualizadas: 1,
  ignoradas: 1,
  erros: [{ linha: 6, motivo: 'STATUS "FILLED" não reconhecido' }],
  itens: [],
};

/** Fake do VagasService: registra as chamadas de importar e devolve a resposta configurada. */
class FakeVagasService {
  readonly chamadas: { projetoId: string; dryRun: boolean; arquivo: string }[] = [];
  resposta: () => Observable<ResultadoImportacao> = () => of(RESUMO_PREVIA);

  importar(file: File, projetoId: string, dryRun: boolean): Observable<ResultadoImportacao> {
    this.chamadas.push({ projetoId, dryRun, arquivo: file.name });
    return this.resposta();
  }
}

describe('ImportarPlanilha', () => {
  let fixture: ComponentFixture<ImportarPlanilha>;
  let vagas: FakeVagasService;
  let element: HTMLElement;

  const botao = (texto: string): HTMLButtonElement => {
    const encontrado = Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(texto));
    if (!encontrado) throw new Error(`botão "${texto}" não encontrado`);
    return encontrado;
  };

  const escolherArquivo = (nome: string): void => {
    const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    // jsdom não implementa DataTransfer: FileList mínima com o que o componente usa
    const arquivo = new File(['x'], nome);
    const files = { length: 1, item: (indice: number) => (indice === 0 ? arquivo : null) };
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
  };

  const escolherProjeto = (id: string): void => {
    const select = element.querySelector<HTMLSelectElement>('select')!;
    select.value = id;
    select.dispatchEvent(new Event('change'));
  };

  const preencherEPrevisualizar = async (): Promise<void> => {
    escolherProjeto('p1');
    escolherArquivo('vagas.xlsx');
    fixture.detectChanges();
    botao('Pré-visualizar').click();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    vagas = new FakeVagasService();
    await TestBed.configureTestingModule({
      imports: [ImportarPlanilha],
      providers: [{ provide: VagasService, useValue: vagas }],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportarPlanilha);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('projetoOptions', [{ value: 'p1', label: 'Projeto 1' }]);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('Confirmar importação fica desabilitado antes da pré-visualização', () => {
    escolherProjeto('p1');
    escolherArquivo('vagas.xlsx');
    fixture.detectChanges();

    expect(botao('Confirmar importação').disabled).toBe(true);
  });

  it('pré-visualizar chama a API com dryRun e mostra o resumo e os erros por linha', async () => {
    await preencherEPrevisualizar();

    expect(vagas.chamadas).toEqual([{ projetoId: 'p1', dryRun: true, arquivo: 'vagas.xlsx' }]);
    expect(element.textContent).toContain('2');
    expect(element.textContent).toContain('STATUS "FILLED" não reconhecido');
    expect(botao('Confirmar importação').disabled).toBe(false);
  });

  it('trocar o arquivo depois da prévia desabilita Confirmar até nova prévia', async () => {
    await preencherEPrevisualizar();

    escolherArquivo('outra.xlsx');
    fixture.detectChanges();

    expect(botao('Confirmar importação').disabled).toBe(true);
  });

  it('confirmar grava com dryRun=false e emite importado', async () => {
    let importou = false;
    fixture.componentInstance.importado.subscribe(() => (importou = true));
    await preencherEPrevisualizar();

    botao('Confirmar importação').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(vagas.chamadas.at(-1)).toEqual({ projetoId: 'p1', dryRun: false, arquivo: 'vagas.xlsx' });
    expect(importou).toBe(true);
  });

  it('erro da API mostra a mensagem devolvida pelo servidor e não emite importado', async () => {
    let importou = false;
    fixture.componentInstance.importado.subscribe(() => (importou = true));
    vagas.resposta = () =>
      throwError(() => new HttpErrorResponse({ status: 400, error: { detail: 'Só arquivos .xlsx são aceitos.' } }));

    await preencherEPrevisualizar();

    expect(element.textContent).toContain('Só arquivos .xlsx são aceitos.');
    expect(importou).toBe(false);
  });
});

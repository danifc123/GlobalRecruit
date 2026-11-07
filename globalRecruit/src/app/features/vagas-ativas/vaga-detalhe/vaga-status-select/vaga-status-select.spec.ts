import { TestBed } from '@angular/core/testing';

import { StatusVaga } from '@app/core/models/vaga';
import { VagaStatusSelect } from './vaga-status-select';

describe('VagaStatusSelect', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [VagaStatusSelect] }));

  function montar(status: StatusVaga) {
    const fixture = TestBed.createComponent(VagaStatusSelect);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    const emitidos: StatusVaga[] = [];
    fixture.componentInstance.alterar.subscribe((novo) => emitidos.push(novo));
    const select = (fixture.nativeElement as HTMLElement).querySelector('select')!;
    return { select, emitidos };
  }

  it('oferece Aberta, Pausada e Fechada com o status atual selecionado', () => {
    const { select } = montar('aberta');

    expect(Array.from(select.options).map((o) => o.value)).toEqual(['aberta', 'pausada', 'fechada']);
    expect(select.value).toBe('aberta');
  });

  it('escolher Pausada numa vaga Aberta emite pausada', () => {
    const { select, emitidos } = montar('aberta');

    select.value = 'pausada';
    select.dispatchEvent(new Event('change'));

    expect(emitidos).toEqual(['pausada']);
  });

  it('escolher o mesmo status não emite', () => {
    const { select, emitidos } = montar('fechada');

    select.value = 'fechada';
    select.dispatchEvent(new Event('change'));

    expect(emitidos).toEqual([]);
  });
});

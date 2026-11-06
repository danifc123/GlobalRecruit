import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TranslatePipe } from '@app/core/i18n/translate.pipe';
import { Vaga } from '@app/core/models/vaga';

interface CampoVaga {
  rotulo: string;
  valor: string;
  // textos longos da planilha (requisitos, notas) vêm em várias linhas
  multilinha: boolean;
}

/** Dados da vaga vindos da planilha do cliente — usado nos dois layouts do detalhe. */
@Component({
  selector: 'app-vaga-info',
  imports: [TranslatePipe],
  templateUrl: './vaga-info.html',
  styleUrl: './vaga-info.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VagaInfo {
  readonly vaga = input.required<Vaga>();

  protected readonly campos = computed<CampoVaga[]>(() => {
    const vaga = this.vaga();
    const candidatos: [string, string | null, boolean][] = [
      ['Código', vaga.codigo, false],
      ['Localização', vaga.localizacao, false],
      ['Headcount', vaga.headcount, false],
      ['Data de início', vaga.dataInicio, false],
      ['Faixa salarial', faixaSalarialCompleta(vaga), false],
      ['Requisitos', vaga.requisitos, true],
      ['Benefícios', vaga.beneficios, true],
      ['Realocação', vaga.realocacao, true],
      ['Notas internas', vaga.notasInternas, true],
    ];
    return candidatos
      .filter((campo): campo is [string, string, boolean] => !!campo[1])
      .map(([rotulo, valor, multilinha]) => ({ rotulo, valor, multilinha }));
  });

  // o link vem da planilha (input externo): só http(s) vira link clicável,
  // além da sanitização de [href] que o Angular já aplica
  protected readonly jdUrlSegura = computed(() => {
    const url = this.vaga().jdUrl?.trim();
    return url && /^https?:\/\//i.test(url) ? url : null;
  });
}

/** "€1,700–€1,900/ month · EUR · GROSS" com só o que existir; cai no salário legado. */
function faixaSalarialCompleta(vaga: Vaga): string | null {
  const faixa = vaga.faixaSalarial ?? vaga.salario?.toString() ?? null;
  const partes = [faixa, vaga.moeda, vaga.tipoSalario].filter(Boolean);
  return partes.length > 0 ? partes.join(' · ') : null;
}

import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { Banner, Button, Select, Sheet, type SelectOption } from '@app/shared/ui';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';
import { VagasService } from '@app/core/data/vagas.service';
import { ResultadoImportacao } from '@app/core/models/vaga';

const ERRO_GENERICO = 'Não foi possível importar a planilha. Tente de novo.';

/**
 * Painel "Importar planilha": escolhe projeto e .xlsx, pré-visualiza
 * (dry-run) e só então libera "Confirmar importação" (spec importacao-vagas, P7).
 */
@Component({
  selector: 'app-importar-planilha',
  imports: [ReactiveFormsModule, Banner, Button, Select, Sheet, TranslatePipe],
  templateUrl: './importar-planilha.html',
  styleUrl: './importar-planilha.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportarPlanilha {
  private readonly vagasService = inject(VagasService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input(false);
  readonly projetoOptions = input.required<SelectOption[]>();
  readonly closed = output<void>();
  /** Emitido depois de uma importação real gravada — a lista deve recarregar. */
  readonly importado = output<void>();

  protected readonly projeto = new FormControl('', { nonNullable: true });
  private readonly projetoId = toSignal(this.projeto.valueChanges, { initialValue: '' });
  protected readonly arquivo = signal<File | null>(null);

  protected readonly previa = signal<ResultadoImportacao | null>(null);
  protected readonly resultadoFinal = signal<ResultadoImportacao | null>(null);
  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly podePrevisualizar = computed(
    () => !!this.projetoId() && this.arquivo() !== null && !this.carregando(),
  );
  protected readonly podeConfirmar = computed(
    () => this.previa() !== null && this.resultadoFinal() === null && !this.carregando(),
  );

  constructor() {
    // prévia vale só para o par projeto+arquivo em que foi feita
    effect(() => {
      this.projetoId();
      this.arquivo();
      this.previa.set(null);
      this.resultadoFinal.set(null);
    });

    // reabrir o painel começa do zero
    effect(() => {
      if (this.open()) this.limpar();
    });
  }

  protected escolherArquivo(event: Event): void {
    const arquivo = (event.target as HTMLInputElement).files?.item(0) ?? null;
    this.erro.set(null);
    this.arquivo.set(arquivo);
  }

  protected previsualizar(): void {
    this.executar(true, (resultado) => this.previa.set(resultado));
  }

  protected confirmar(): void {
    this.executar(false, (resultado) => {
      this.resultadoFinal.set(resultado);
      this.importado.emit();
    });
  }

  protected fechar(): void {
    this.closed.emit();
  }

  private executar(dryRun: boolean, aoConcluir: (resultado: ResultadoImportacao) => void): void {
    const arquivo = this.arquivo();
    const projetoId = this.projetoId();
    if (!arquivo || !projetoId) return;

    this.carregando.set(true);
    this.erro.set(null);
    this.vagasService
      .importar(arquivo, projetoId, dryRun)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.carregando.set(false);
          aoConcluir(resultado);
        },
        error: (falha: unknown) => {
          this.carregando.set(false);
          this.erro.set(mensagemDeErro(falha));
        },
      });
  }

  private limpar(): void {
    this.projeto.setValue('');
    this.arquivo.set(null);
    this.erro.set(null);
  }
}

/** Mensagem do servidor (`detail` em texto) quando houver; senão, genérica. */
function mensagemDeErro(falha: unknown): string {
  if (falha instanceof HttpErrorResponse && typeof falha.error?.detail === 'string') {
    return falha.error.detail;
  }
  return ERRO_GENERICO;
}

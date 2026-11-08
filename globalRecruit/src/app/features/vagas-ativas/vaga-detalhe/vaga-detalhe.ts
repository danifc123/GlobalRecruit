import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';

import { EmptyState, Icon, Skeleton } from '@app/shared/ui';
import { AuthService } from '@app/core/auth/auth.service';
import { isStaffRole } from '@app/core/auth/is-staff';
import { VagasService } from '@app/core/data/vagas.service';
import { CandidatosService } from '@app/core/data/candidatos.service';
import { ProjetosParceirosService } from '@app/core/data/projetos-parceiros.service';
import { QuickCreateService } from '@app/core/ui/quick-create.service';
import { StatusVaga, Vaga } from '@app/core/models/vaga';
import { Candidato, ESTAGIO_LABELS, ESTAGIO_ORDEM, Estagio } from '@app/core/models/candidato';
import { getInitials } from '@app/shared/utils/initials';
import { diasDesde, tempoRelativo } from '@app/shared/utils/relative-time';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';
import { LanguageService } from '@app/core/i18n/language.service';
import { temTraducaoExibida, vagaNoIdioma } from '@app/core/i18n/vaga-no-idioma';
import { type EstadoTraducao, VagaInfo } from './vaga-info/vaga-info';
import { VagaStatusSelect } from './vaga-status-select/vaga-status-select';

const DIAS_PARADO_ALERTA = 10;

@Component({
  selector: 'app-vaga-detalhe',
  imports: [EmptyState, Icon, Skeleton, RouterLink, TranslatePipe, VagaInfo, VagaStatusSelect],
  templateUrl: './vaga-detalhe.html',
  styleUrl: './vaga-detalhe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VagaDetalhe {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vagasService = inject(VagasService);
  private readonly candidatosService = inject(CandidatosService);
  private readonly projetosService = inject(ProjetosParceirosService);
  private readonly quickCreate = inject(QuickCreateService);
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly getInitials = getInitials;
  protected readonly estagioLabels = ESTAGIO_LABELS;
  protected readonly tempoRelativo = tempoRelativo;

  protected readonly vaga = signal<Vaga | null>(null);
  // "Ver original": vale para a vaga aberta; volta a mostrar a tradução ao
  // abrir outra vaga (ver effect no construtor)
  protected readonly verOriginal = signal(false);
  // vaga no idioma do site (spec traducao-vagas); a edição usa sempre vaga()
  protected readonly vagaExibida = computed(() => {
    const vaga = this.vaga();
    if (!vaga) return null;
    return this.verOriginal() ? vaga : vagaNoIdioma(vaga, this.language.language());
  });
  protected readonly estadoTraducao = computed<EstadoTraducao>(() => {
    const vaga = this.vaga();
    if (!vaga || !temTraducaoExibida(vaga, this.language.language())) return 'nenhuma';
    return this.verOriginal() ? 'original' : 'traduzida';
  });
  protected readonly projetoNome = signal<string | null>(null);
  protected readonly candidatos = signal<Candidato[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly alterandoStatus = signal(false);
  protected readonly erroStatus = signal(false);
  // troca de status é ação de gestão — a API também barra recrutador (403)
  protected readonly isStaff = computed(() => isStaffRole(this.auth.session()?.role));

  protected readonly pipelineCounts = computed<{ estagio: Estagio; count: number }[]>(() => {
    const counts = new Map<Estagio, number>();
    for (const c of this.candidatos()) {
      if (c.estagioAtual) counts.set(c.estagioAtual, (counts.get(c.estagioAtual) ?? 0) + 1);
    }
    return ESTAGIO_ORDEM.filter((e) => e !== 'rejeitado' && e !== 'concluido').map((estagio) => ({
      estagio,
      count: counts.get(estagio) ?? 0,
    }));
  });

  protected readonly ultimosCandidatos = computed(() =>
    [...this.candidatos()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3),
  );

  // no painel de master-detail, o usuário pode clicar em outra linha da
  // lista sem essa instância ser destruída/recriada (mesma rota filha, só
  // o :id muda) — por isso a busca reage ao paramMap em vez de ler uma
  // vez só no construtor
  private readonly routeId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: null,
  });

  constructor() {
    effect(() => {
      const id = this.routeId();
      if (!id) return;

      this.loading.set(true);
      this.error.set(false);
      this.verOriginal.set(false);

      forkJoin({
        vaga: this.vagasService.get(id),
        candidatos: this.candidatosService.listByVaga(id),
        projetos: this.projetosService.list(),
      })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: ({ vaga, candidatos, projetos }) => {
            this.vaga.set(vaga);
            this.candidatos.set(candidatos);
            this.projetoNome.set(projetos.find((p) => p.id === vaga.projetoId)?.nome ?? null);
            this.loading.set(false);
          },
          error: () => {
            this.error.set(true);
            this.loading.set(false);
          },
        });
    });
  }

  // fecha o painel voltando pra rota pai — não usa Location.back() porque
  // em deep link direto (ex.: vindo do Dashboard) pode não haver
  // "/vagas-ativas" no histórico do navegador
  protected closePanel(): void {
    this.router.navigate(['/vagas-ativas']);
  }

  protected alternarOriginal(): void {
    this.verOriginal.update((valor) => !valor);
  }

  protected editar(): void {
    const vaga = this.vaga();
    if (vaga) this.quickCreate.editVaga(vaga);
  }

  protected alterarStatus(status: StatusVaga): void {
    const vaga = this.vaga();
    if (!vaga || this.alterandoStatus()) return;

    this.alterandoStatus.set(true);
    this.erroStatus.set(false);
    this.vagasService
      .updateStatus(vaga.id, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (atualizada) => {
          this.vaga.set(atualizada);
          this.alterandoStatus.set(false);
          this.quickCreate.notificarStatusAlterado();
        },
        error: () => {
          this.alterandoStatus.set(false);
          this.erroStatus.set(true);
        },
      });
  }

  protected candidatoParado(candidato: Candidato): boolean {
    return diasDesde(candidato.historico[0].updatedAt) >= DIAS_PARADO_ALERTA;
  }
}

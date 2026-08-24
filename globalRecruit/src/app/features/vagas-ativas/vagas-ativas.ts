import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import {
  Banner,
  Button,
  ChipFilter,
  type ChipOption,
  EmptyState,
  Icon,
  Input,
  Page,
  Select,
  Sheet,
  Skeleton,
  SwipeRow,
  Table,
  type SelectOption,
  type SwipeAction,
} from '@app/shared/ui';
import { VagasService } from '@app/core/data/vagas.service';
import { ProjetosParceirosService } from '@app/core/data/projetos-parceiros.service';
import { QuickCreateService } from '@app/core/ui/quick-create.service';
import { TopbarActionsService } from '@app/core/ui/topbar-actions.service';
import { Vaga } from '@app/core/models/vaga';
import { ProjetoParceiro } from '@app/core/models/projeto-parceiro';

const PRIORIDADE_OPTIONS: SelectOption[] = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
];

const MODALIDADE_OPCOES = ['Presencial', 'Híbrido', 'Remoto'];

const STEP_FIELDS = {
  1: ['projetoId', 'cargo', 'cliente'],
  2: ['pais', 'idioma', 'modalidade', 'salario'],
  3: ['comissao', 'prioridade'],
} as const;

const SWIPE_ACTIONS: SwipeAction[] = [
  { id: 'indicar', label: 'Indicar', icon: 'user-plus', tone: 'primary' },
  { id: 'priorizar', label: 'Priorizar', icon: 'flame', tone: 'accent' },
];

@Component({
  selector: 'app-vagas-ativas',
  imports: [
    ReactiveFormsModule,
    Banner,
    Button,
    ChipFilter,
    EmptyState,
    Icon,
    Input,
    Page,
    RouterLink,
    RouterOutlet,
    Select,
    Sheet,
    Skeleton,
    SwipeRow,
    Table,
  ],
  templateUrl: './vagas-ativas.html',
  styleUrl: './vagas-ativas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VagasAtivas {
  private readonly fb = inject(FormBuilder);
  private readonly vagasService = inject(VagasService);
  private readonly projetosService = inject(ProjetosParceirosService);
  private readonly quickCreate = inject(QuickCreateService);
  private readonly topbarActions = inject(TopbarActionsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns = [
    'ID Vaga',
    'Cliente',
    'Cargo',
    'Idioma',
    'País',
    'Modalidade',
    'Salário',
    'Comissão',
    'Prioridade',
    'Ações',
  ];

  protected readonly swipeActions = SWIPE_ACTIONS;
  protected readonly modalidadeOpcoes = MODALIDADE_OPCOES;

  protected readonly vagas = signal<Vaga[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  protected readonly filtro = signal('todas');
  protected readonly filtroOptions = computed<ChipOption[]>(() => {
    const vagas = this.vagas();
    return [
      { value: 'todas', label: 'Todas', count: vagas.length },
      { value: 'alta', label: 'Alta', count: vagas.filter((v) => v.prioridade === 'alta').length },
      { value: 'sem-candidato', label: 'Sem candidato', count: vagas.filter((v) => v.candidatosCount === 0).length },
    ];
  });

  // busca do topbar (≥1024px, ver TopbarActionsService) — filtro client-side
  // sobre a lista já carregada, combinado ao chip de prioridade
  protected readonly search = signal('');

  protected readonly vagasFiltradas = computed(() => {
    const vagas = this.vagas();
    const porFiltro =
      this.filtro() === 'alta'
        ? vagas.filter((v) => v.prioridade === 'alta')
        : this.filtro() === 'sem-candidato'
          ? vagas.filter((v) => v.candidatosCount === 0)
          : vagas;

    const termo = this.search().trim().toLowerCase();
    if (!termo) return porFiltro;
    return porFiltro.filter(
      (v) =>
        v.cliente.toLowerCase().includes(termo) ||
        v.cargo.toLowerCase().includes(termo) ||
        (v.pais?.toLowerCase().includes(termo) ?? false),
    );
  });

  protected readonly isEmpty = computed(() => !this.loading() && this.vagasFiltradas().length === 0);

  // rota filha ativa (/vagas-ativas/:id) — dirige o painel de master-detail
  // em ≥1024px e o overlay de tela cheia abaixo disso (ver vagas-ativas.html)
  protected readonly selectedVagaId = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.route.firstChild?.snapshot.paramMap.get('id') ?? null),
    ),
    { initialValue: this.route.firstChild?.snapshot.paramMap.get('id') ?? null },
  );

  protected readonly hasDetail = computed(() => this.selectedVagaId() !== null);

  protected readonly projetos = signal<ProjetoParceiro[]>([]);
  protected readonly projetoOptions = computed<SelectOption[]>(() =>
    this.projetos().map((projeto) => ({ value: projeto.id, label: `${projeto.nome} — ${projeto.cliente}` })),
  );
  protected readonly prioridadeOptions = PRIORIDADE_OPTIONS;

  protected readonly showForm = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly currentStep = signal<1 | 2 | 3>(1);
  // não-nulo quando o wizard foi aberto via "Editar vaga" (painel de
  // detalhe, ver QuickCreateService.editVaga) em vez de "Nova vaga"
  protected readonly editingVagaId = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    projetoId: ['', [Validators.required]],
    cliente: ['', [Validators.required]],
    cargo: ['', [Validators.required]],
    idioma: [''],
    pais: [''],
    modalidade: [''],
    salario: [''],
    comissao: [''],
    prioridade: ['', [Validators.required]],
  });

  constructor() {
    this.loadVagas();
    this.projetosService
      .list()
      .pipe(takeUntilDestroyed())
      .subscribe((projetos) => this.projetos.set(projetos));

    // FAB da bottom nav pode ser tocado em qualquer aba — se já chegamos
    // aqui com o sinal pendente (navegação disparada pelo Shell) ou se ele
    // for acionado enquanto a tela já está montada, abre o wizard
    if (this.quickCreate.consume()) this.showForm.set(true);

    // "Editar vaga" do painel de detalhe (rota filha, sem acesso direto ao
    // Sheet daqui) — reabre o mesmo wizard, pré-preenchido, em modo edição
    effect(() => {
      const vaga = this.quickCreate.editTarget();
      if (vaga) this.openEditForm(vaga);
    });

    this.topbarActions.setAction({
      label: 'Nova vaga',
      icon: 'plus',
      onClick: () => this.toggleForm(),
    });
    this.topbarActions.setSearch({ placeholder: 'Cliente, cargo ou país', query: this.search });
    this.destroyRef.onDestroy(() => {
      this.topbarActions.clearAction();
      this.topbarActions.clearSearch();
    });
  }

  protected toggleForm(): void {
    this.showForm.update((value) => !value);
    this.errorMessage.set(null);
    this.currentStep.set(1);
    this.editingVagaId.set(null);
  }

  protected openEditForm(vaga: Vaga): void {
    this.quickCreate.consumeEdit();
    this.editingVagaId.set(vaga.id);
    this.currentStep.set(1);
    this.errorMessage.set(null);
    this.form.setValue({
      projetoId: vaga.projetoId,
      cliente: vaga.cliente,
      cargo: vaga.cargo,
      idioma: vaga.idioma ?? '',
      pais: vaga.pais ?? '',
      modalidade: vaga.modalidade ?? '',
      salario: vaga.salario?.toString() ?? '',
      comissao: vaga.comissao?.toString() ?? '',
      prioridade: vaga.prioridade,
    });
    this.showForm.set(true);
  }

  protected nextStep(): void {
    const fields = STEP_FIELDS[this.currentStep()];
    let valid = true;
    for (const field of fields) {
      const control = this.form.controls[field];
      control.markAsTouched();
      if (control.invalid) valid = false;
    }
    if (!valid) return;
    if (this.currentStep() < 3) this.currentStep.update((step) => (step + 1) as 1 | 2 | 3);
  }

  protected prevStep(): void {
    if (this.currentStep() > 1) this.currentStep.update((step) => (step - 1) as 1 | 2 | 3);
  }

  protected selecionarModalidade(valor: string): void {
    this.form.controls.modalidade.setValue(valor);
  }

  protected selectVaga(vagaId: string): void {
    this.router.navigate(['/vagas-ativas', vagaId]);
  }

  protected handleSwipeAction(vagaId: string, actionId: string): void {
    if (actionId === 'indicar') {
      this.router.navigate(['/pipeline-candidatos'], { queryParams: { vagaId, novo: 1 } });
      return;
    }
    if (actionId === 'priorizar') {
      this.vagasService.updatePrioridade(vagaId, 'alta').subscribe((atualizada) => {
        this.vagas.update((lista) => lista.map((v) => (v.id === atualizada.id ? atualizada : v)));
      });
    }
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const raw = this.form.getRawValue();
    const payload = {
      projetoId: raw.projetoId,
      cliente: raw.cliente,
      cargo: raw.cargo,
      idioma: raw.idioma || undefined,
      pais: raw.pais || undefined,
      modalidade: raw.modalidade || undefined,
      salario: raw.salario ? Number(raw.salario) : undefined,
      comissao: raw.comissao ? Number(raw.comissao) : undefined,
      prioridade: raw.prioridade as Vaga['prioridade'],
    };

    const editingId = this.editingVagaId();
    const request = editingId ? this.vagasService.update(editingId, payload) : this.vagasService.create(payload);
    const mensagemErro = editingId ? 'Não foi possível salvar as alterações.' : 'Não foi possível criar a vaga.';

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.showForm.set(false);
        this.currentStep.set(1);
        this.editingVagaId.set(null);
        this.form.reset({
          projetoId: '',
          cliente: '',
          cargo: '',
          idioma: '',
          pais: '',
          modalidade: '',
          salario: '',
          comissao: '',
          prioridade: '',
        });
        this.loadVagas();
      },
      error: () => {
        this.errorMessage.set(mensagemErro);
        this.submitting.set(false);
      },
    });
  }

  private loadVagas(): void {
    this.loading.set(true);
    this.error.set(false);
    this.vagasService
      .list(0, 50, 'aberta')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.vagas.set(page.items);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}

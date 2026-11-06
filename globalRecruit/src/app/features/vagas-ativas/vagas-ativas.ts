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
  Textarea,
  type SelectOption,
  type SwipeAction,
} from '@app/shared/ui';
import { AuthService } from '@app/core/auth/auth.service';
import { isStaffRole } from '@app/core/auth/is-staff';
import { VagasService } from '@app/core/data/vagas.service';
import { ProjetosParceirosService } from '@app/core/data/projetos-parceiros.service';
import { QuickCreateService } from '@app/core/ui/quick-create.service';
import { TopbarActionsService } from '@app/core/ui/topbar-actions.service';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';
import { Vaga, VagaCreate } from '@app/core/models/vaga';
import { ProjetoParceiro } from '@app/core/models/projeto-parceiro';
import { ImportarPlanilha } from './importar-planilha/importar-planilha';

const PRIORIDADE_OPTIONS: SelectOption[] = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
];

// atalhos — o campo continua aceitando texto livre (a planilha do cliente
// traz valores como "Hybrid after training/probation")
const MODALIDADE_OPCOES = ['Presencial', 'Híbrido', 'Remoto'];

// valores gravados em maiúsculas, como a importação normaliza a planilha
const TIPO_SALARIO_OPCOES: SelectOption[] = [
  { value: 'GROSS', label: 'Bruto' },
  { value: 'NET', label: 'Líquido' },
];

// a planilha do cliente tem ~136 vagas; 500 é o máximo aceito pela API
const VAGAS_POR_PAGINA = 500;

type Etapa = 1 | 2 | 3 | 4;
const TOTAL_ETAPAS: Etapa = 4;

const STEP_FIELDS = {
  1: ['projetoId', 'codigo', 'cargo', 'cliente'],
  2: ['pais', 'localizacao', 'idioma', 'modalidade', 'headcount', 'dataInicio'],
  3: ['faixaSalarial', 'moeda', 'tipoSalario', 'comissao', 'prioridade'],
  4: ['requisitos', 'beneficios', 'realocacao', 'notasInternas', 'jdUrl'],
} as const;

const FORM_VAZIO = {
  projetoId: '',
  codigo: '',
  cliente: '',
  cargo: '',
  pais: '',
  localizacao: '',
  idioma: '',
  modalidade: '',
  headcount: '',
  dataInicio: '',
  faixaSalarial: '',
  moeda: '',
  tipoSalario: '',
  comissao: '',
  prioridade: '',
  requisitos: '',
  beneficios: '',
  realocacao: '',
  notasInternas: '',
  jdNome: '',
  jdUrl: '',
};

const SWIPE_ACTIONS: SwipeAction[] = [
  { id: 'indicar', label: 'Indicar', icon: 'user-plus', tone: 'primary' },
  { id: 'priorizar', label: 'Priorizar', icon: 'flame', tone: 'accent' },
];

/** Campo opcional do formulário: string vazia vira "não informado". */
function opcional(valor: string): string | undefined {
  const limpo = valor.trim();
  return limpo ? limpo : undefined;
}

@Component({
  selector: 'app-vagas-ativas',
  imports: [
    ReactiveFormsModule,
    Banner,
    Button,
    ChipFilter,
    EmptyState,
    Icon,
    ImportarPlanilha,
    Input,
    Page,
    RouterLink,
    RouterOutlet,
    Select,
    Sheet,
    Skeleton,
    SwipeRow,
    Table,
    Textarea,
    TranslatePipe,
  ],
  templateUrl: './vagas-ativas.html',
  styleUrl: './vagas-ativas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VagasAtivas {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
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
    'Headcount',
    'Salário',
    'Comissão',
    'Prioridade',
    'Ações',
  ];

  protected readonly swipeActions = SWIPE_ACTIONS;
  protected readonly modalidadeOpcoes = MODALIDADE_OPCOES;
  protected readonly tipoSalarioOpcoes = TIPO_SALARIO_OPCOES;
  protected readonly totalEtapas = TOTAL_ETAPAS;

  // importação de planilha é ação de gestão — a API também barra recrutador
  protected readonly isStaff = computed(() => isStaffRole(this.auth.session()?.role));
  protected readonly showImport = signal(false);

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
        (v.codigo?.toLowerCase().includes(termo) ?? false) ||
        v.cliente.toLowerCase().includes(termo) ||
        v.cargo.toLowerCase().includes(termo) ||
        (v.pais?.toLowerCase().includes(termo) ?? false),
    );
  });

  protected readonly isEmpty = computed(() => !this.loading() && this.vagasFiltradas().length === 0);

  // rota filha ativa (/vagas-ativas/:id) — dirige o painel de master-detail
  // em ≥1024px e o overlay de tela cheia abaixo disso (ver vagas-ativas.html)
  // route.snapshot.firstChild (árvore de snapshot do próprio componente) em
  // vez de route.firstChild?.snapshot (rota-filha *viva*): numa navegação
  // profunda vinda de fora (ex.: "Vaga alvo" do Candidato Detalhe indo
  // direto pra /vagas-ativas/:id), VagasAtivas e VagaDetalhe são criados
  // juntos na mesma navegação, e o `.snapshot` da rota-filha viva ainda não
  // está pronto nesse instante — quebra o construtor. A árvore de snapshot
  // já vem resolvida antes de qualquer componente ser instanciado.
  protected readonly selectedVagaId = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.route.snapshot.firstChild?.paramMap.get('id') ?? null),
    ),
    { initialValue: this.route.snapshot.firstChild?.paramMap.get('id') ?? null },
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
  protected readonly currentStep = signal<Etapa>(1);
  // não-nulo quando o wizard foi aberto via "Editar vaga" (painel de
  // detalhe, ver QuickCreateService.editVaga) em vez de "Nova vaga"
  protected readonly editingVagaId = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    ...FORM_VAZIO,
    projetoId: ['', [Validators.required]],
    cliente: ['', [Validators.required]],
    cargo: ['', [Validators.required]],
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

    // status trocado no painel de detalhe: a vaga pode ter saído das ativas
    let ultimaAlteracaoVista = this.quickCreate.statusAlterado();
    effect(() => {
      const alteracao = this.quickCreate.statusAlterado();
      if (alteracao === ultimaAlteracaoVista) return;
      ultimaAlteracaoVista = alteracao;
      this.loadVagas();
    });

    this.topbarActions.setAction({
      label: 'Nova vaga',
      icon: 'plus',
      onClick: () => this.toggleForm(),
    });
    this.topbarActions.setSearch({ placeholder: 'Código, cliente, cargo ou país', query: this.search });
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

  protected abrirImportacao(): void {
    this.showImport.set(true);
  }

  protected fecharImportacao(): void {
    this.showImport.set(false);
  }

  protected aoImportar(): void {
    this.loadVagas();
  }

  protected openEditForm(vaga: Vaga): void {
    this.quickCreate.consumeEdit();
    this.editingVagaId.set(vaga.id);
    this.currentStep.set(1);
    this.errorMessage.set(null);
    this.form.setValue({
      projetoId: vaga.projetoId,
      codigo: vaga.codigo ?? '',
      cliente: vaga.cliente,
      cargo: vaga.cargo,
      pais: vaga.pais ?? '',
      localizacao: vaga.localizacao ?? '',
      idioma: vaga.idioma ?? '',
      modalidade: vaga.modalidade ?? '',
      headcount: vaga.headcount ?? '',
      dataInicio: vaga.dataInicio ?? '',
      faixaSalarial: vaga.faixaSalarial ?? '',
      moeda: vaga.moeda ?? '',
      tipoSalario: vaga.tipoSalario ?? '',
      comissao: vaga.comissao?.toString() ?? '',
      prioridade: vaga.prioridade,
      requisitos: vaga.requisitos ?? '',
      beneficios: vaga.beneficios ?? '',
      realocacao: vaga.realocacao ?? '',
      notasInternas: vaga.notasInternas ?? '',
      jdNome: vaga.jdNome ?? '',
      jdUrl: vaga.jdUrl ?? '',
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
    if (this.currentStep() < TOTAL_ETAPAS) this.currentStep.update((step) => (step + 1) as Etapa);
  }

  protected prevStep(): void {
    if (this.currentStep() > 1) this.currentStep.update((step) => (step - 1) as Etapa);
  }

  protected selecionarModalidade(valor: string): void {
    this.form.controls.modalidade.setValue(valor);
  }

  protected selecionarTipoSalario(valor: string): void {
    this.form.controls.tipoSalario.setValue(valor);
  }

  /** "País · Localização" com só o que existir (ex.: "Portugal · Lisbon"). */
  protected paisComLocalizacao(vaga: Vaga): string {
    return [vaga.pais, vaga.localizacao].filter(Boolean).join(' · ');
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
    const payload = this.montarPayload();

    const editingId = this.editingVagaId();
    const request = editingId ? this.vagasService.update(editingId, payload) : this.vagasService.create(payload);
    const mensagemErro = editingId ? 'Não foi possível salvar as alterações.' : 'Não foi possível criar a vaga.';

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.showForm.set(false);
        this.currentStep.set(1);
        this.editingVagaId.set(null);
        this.form.reset(FORM_VAZIO);
        this.loadVagas();
      },
      error: () => {
        this.errorMessage.set(mensagemErro);
        this.submitting.set(false);
      },
    });
  }

  // o PATCH substitui todos os campos: o que estiver vazio aqui é apagado
  private montarPayload(): VagaCreate {
    const raw = this.form.getRawValue();
    return {
      projetoId: raw.projetoId,
      codigo: opcional(raw.codigo),
      cliente: raw.cliente.trim(),
      cargo: raw.cargo.trim(),
      pais: opcional(raw.pais),
      localizacao: opcional(raw.localizacao),
      idioma: opcional(raw.idioma),
      modalidade: opcional(raw.modalidade),
      headcount: opcional(raw.headcount),
      dataInicio: opcional(raw.dataInicio),
      faixaSalarial: opcional(raw.faixaSalarial),
      moeda: opcional(raw.moeda)?.toUpperCase(),
      tipoSalario: opcional(raw.tipoSalario),
      comissao: raw.comissao ? Number(raw.comissao) : undefined,
      prioridade: raw.prioridade as Vaga['prioridade'],
      requisitos: opcional(raw.requisitos),
      beneficios: opcional(raw.beneficios),
      realocacao: opcional(raw.realocacao),
      notasInternas: opcional(raw.notasInternas),
      jdNome: opcional(raw.jdNome),
      jdUrl: opcional(raw.jdUrl),
    };
  }

  private loadVagas(): void {
    this.loading.set(true);
    this.error.set(false);
    this.vagasService
      .list(0, VAGAS_POR_PAGINA, 'aberta')
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

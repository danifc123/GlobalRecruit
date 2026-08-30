import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ActionsMenu, Banner, Button, ChipFilter, type ChipOption, EmptyState, Icon, Input, Page, Select, Sheet, Skeleton, Table, type SelectOption } from '@app/shared/ui';
import { UsersService } from '@app/core/data/users.service';
import { ProjetosParceirosService } from '@app/core/data/projetos-parceiros.service';
import { TopbarActionsService } from '@app/core/ui/topbar-actions.service';
import { AuthService } from '@app/core/auth/auth.service';
import { AppUser, ROLE_LABELS as ROLE_LABELS_CURTO } from '@app/core/models/user';
import { ProjetoParceiro } from '@app/core/models/projeto-parceiro';
import { getInitials } from '@app/shared/utils/initials';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'recruiter', label: 'Recrutador' },
  { value: 'developer', label: 'Desenvolvedor (acesso total)' },
];

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((option) => [option.value, option.label]),
);

@Component({
  selector: 'app-usuarios',
  imports: [
    ReactiveFormsModule,
    ActionsMenu,
    Banner,
    Button,
    ChipFilter,
    EmptyState,
    Icon,
    Input,
    Page,
    Select,
    Sheet,
    Skeleton,
    Table,
    TranslatePipe,
  ],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Usuarios {
  private readonly fb = inject(FormBuilder);
  private readonly usersService = inject(UsersService);
  private readonly projetosService = inject(ProjetosParceirosService);
  private readonly topbarActions = inject(TopbarActionsService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly columns = ['Email', 'Papel', 'Projetos', 'Status', 'Ações'];
  protected readonly getInitials = getInitials;

  protected readonly users = signal<AppUser[]>([]);
  protected readonly projetos = signal<ProjetoParceiro[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  protected readonly filtro = signal('todos');
  protected readonly filtroOptions = computed<ChipOption[]>(() => {
    const users = this.users();
    return [
      { value: 'todos', label: 'Todos', count: users.length },
      { value: 'recruiter', label: 'Recrutador', count: users.filter((u) => u.role === 'recruiter').length },
      { value: 'inativos', label: 'Inativos', count: users.filter((u) => !u.isActive).length },
    ];
  });

  // busca do topbar (≥1024px) — mesmo padrão de Vagas Ativas/Pipeline
  protected readonly search = signal('');

  protected readonly usersFiltrados = computed(() => {
    const users = this.users();
    const porFiltro =
      this.filtro() === 'recruiter'
        ? users.filter((u) => u.role === 'recruiter')
        : this.filtro() === 'inativos'
          ? users.filter((u) => !u.isActive)
          : users;

    const termo = this.search().trim().toLowerCase();
    if (!termo) return porFiltro;
    return porFiltro.filter((u) => u.email.toLowerCase().includes(termo));
  });

  protected readonly showForm = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly togglingId = signal<string | null>(null);
  protected readonly statusError = signal<string | null>(null);
  // guarda só o email criado — a frase ao redor é montada no template com
  // 'Usuário {0} criado.' | translate, senão o texto fixo ficaria preso
  // dentro da string interpolada e não teria como traduzir
  protected readonly createdEmail = signal<string | null>(null);

  // "Recrutador" pode estar vinculado a vários projetos ao mesmo tempo — o
  // Select do UI kit só suporta valor único, então o vínculo aqui é uma
  // lista de checkboxes controlada à parte do FormGroup (validação manual
  // no submit, mesmo padrão de errorMessage/successMessage já usado abaixo)
  protected readonly selectedProjetoIds = signal<Set<string>>(new Set());

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['', [Validators.required]],
  });

  // FormControl.value não é um signal — ler ele direto dentro de computed()
  // não registra dependência nenhuma, então o computed calculava uma vez só
  // (com o form ainda vazio) e nunca mais atualizava, mesmo trocando o papel
  // pelos cards/segmented/select. toSignal(valueChanges) resolve isso.
  private readonly roleValue = toSignal(this.form.controls.role.valueChanges, {
    initialValue: this.form.controls.role.value,
  });
  protected readonly isRecrutadorRole = computed(() => this.roleValue() === 'recruiter');

  constructor() {
    this.loadUsers();
    this.projetosService.list().subscribe((projetos) => this.projetos.set(projetos));

    this.form.controls.role.valueChanges.pipe(takeUntilDestroyed()).subscribe((role) => {
      if (role !== 'recruiter') this.selectedProjetoIds.set(new Set());
    });

    this.topbarActions.setAction({
      label: 'Novo usuário',
      icon: 'plus',
      onClick: () => this.toggleForm(),
    });
    this.topbarActions.setSearch({ placeholder: 'E-mail do usuário', query: this.search });
    this.destroyRef.onDestroy(() => {
      this.topbarActions.clearAction();
      this.topbarActions.clearSearch();
    });
  }

  protected roleLabel(role: string): string {
    return ROLE_LABELS[role] ?? role;
  }

  // label curto (Admin/Recrutador/Developer) — usado no segmentado ≥1024px,
  // onde o texto verbose de roleLabel() não cabe
  protected roleLabelCurto(role: string): string {
    return ROLE_LABELS_CURTO[role as AppUser['role']] ?? role;
  }

  // usado pelos cards do celular (só admin/recrutador — developer é criado
  // via seed) e pelo segmentado ≥1024px (os 3 papéis)
  protected selecionarRole(role: 'admin' | 'recruiter' | 'developer'): void {
    this.form.controls.role.setValue(role);
  }

  protected toggleForm(): void {
    this.showForm.update((value) => !value);
    this.errorMessage.set(null);
  }

  protected toggleProjeto(id: string): void {
    this.selectedProjetoIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.createdEmail.set(null);
    const { email, password, role } = this.form.getRawValue();

    this.usersService
      .create({
        email,
        password,
        role: role as AppUser['role'],
        projetoIds: Array.from(this.selectedProjetoIds()),
      })
      .subscribe({
        next: () => {
          this.createdEmail.set(email);
          this.form.reset({ email: '', password: '', role: '' });
          this.selectedProjetoIds.set(new Set());
          this.submitting.set(false);
          this.showForm.set(false);
          this.loadUsers();
        },
        error: (err) => {
          this.errorMessage.set(
            err?.status === 409 ? 'Já existe um usuário com esse email.' : 'Não foi possível criar o usuário.',
          );
          this.submitting.set(false);
        },
      });
  }

  // ninguém desativa a própria conta — o backend também barra isso, esse
  // check aqui é só pra não nem mostrar o botão pra esse caso
  protected isSelf(user: AppUser): boolean {
    return user.id === this.auth.session()?.userId;
  }

  protected toggleActive(user: AppUser): void {
    if (this.togglingId()) return;
    this.togglingId.set(user.id);
    this.statusError.set(null);
    this.usersService.setActive(user.id, !user.isActive).subscribe({
      next: (updated) => {
        this.users.update((lista) => lista.map((u) => (u.id === updated.id ? updated : u)));
        this.togglingId.set(null);
      },
      error: () => {
        this.statusError.set(
          user.isActive ? 'Não foi possível desativar o usuário.' : 'Não foi possível reativar o usuário.',
        );
        this.togglingId.set(null);
      },
    });
  }

  // recrutador pode ser criado sem projeto (ex.: nenhum projeto cadastrado
  // ainda) — esse sheet à parte é o jeito de vincular depois, e também de
  // ajustar o vínculo de um recrutador já existente
  protected readonly vinculoUser = signal<AppUser | null>(null);
  protected readonly vinculoSelectedIds = signal<Set<string>>(new Set());
  protected readonly vinculoSubmitting = signal(false);
  protected readonly vinculoError = signal<string | null>(null);

  protected abrirVincular(user: AppUser): void {
    this.vinculoUser.set(user);
    this.vinculoSelectedIds.set(new Set(user.projetos.map((p) => p.id)));
    this.vinculoError.set(null);
  }

  protected fecharVincular(): void {
    this.vinculoUser.set(null);
  }

  protected toggleVinculoProjeto(id: string): void {
    this.vinculoSelectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected salvarVinculo(): void {
    const user = this.vinculoUser();
    if (!user || this.vinculoSubmitting()) return;

    this.vinculoSubmitting.set(true);
    this.vinculoError.set(null);
    this.usersService.setProjetos(user.id, Array.from(this.vinculoSelectedIds())).subscribe({
      next: (updated) => {
        this.users.update((lista) => lista.map((u) => (u.id === updated.id ? updated : u)));
        this.vinculoSubmitting.set(false);
        this.vinculoUser.set(null);
      },
      error: () => {
        this.vinculoError.set('Não foi possível atualizar os projetos vinculados.');
        this.vinculoSubmitting.set(false);
      },
    });
  }

  private loadUsers(): void {
    this.loading.set(true);
    this.error.set(false);
    this.usersService.list().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}

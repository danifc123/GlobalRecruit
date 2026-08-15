import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Banner, Button, ChipFilter, type ChipOption, EmptyState, Icon, Input, Page, Select, Sheet, Skeleton, Table, type SelectOption } from '@app/shared/ui';
import { UsersService } from '@app/core/data/users.service';
import { ProjetosParceirosService } from '@app/core/data/projetos-parceiros.service';
import { AppUser } from '@app/core/models/user';
import { ProjetoParceiro } from '@app/core/models/projeto-parceiro';
import { getInitials } from '@app/shared/utils/initials';

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
  ],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Usuarios {
  private readonly fb = inject(FormBuilder);
  private readonly usersService = inject(UsersService);
  private readonly projetosService = inject(ProjetosParceirosService);

  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly columns = ['Email', 'Papel', 'Projetos', 'Status'];
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

  protected readonly usersFiltrados = computed(() => {
    const users = this.users();
    switch (this.filtro()) {
      case 'recruiter':
        return users.filter((u) => u.role === 'recruiter');
      case 'inativos':
        return users.filter((u) => !u.isActive);
      default:
        return users;
    }
  });

  protected readonly showForm = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

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

  protected readonly isRecrutadorRole = computed(() => this.form.controls.role.value === 'recruiter');

  constructor() {
    this.loadUsers();
    this.projetosService.list().subscribe((projetos) => this.projetos.set(projetos));

    this.form.controls.role.valueChanges.pipe(takeUntilDestroyed()).subscribe((role) => {
      if (role !== 'recruiter') this.selectedProjetoIds.set(new Set());
    });
  }

  protected roleLabel(role: string): string {
    return ROLE_LABELS[role] ?? role;
  }

  // usado pelos 2 cards grandes do seletor de papel no celular (só
  // admin/recrutador — developer é criado via seed, não por essa tela)
  protected selecionarRole(role: 'admin' | 'recruiter'): void {
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
    const missingProjetos = this.isRecrutadorRole() && this.selectedProjetoIds().size === 0;
    if (this.form.invalid || missingProjetos || this.submitting()) {
      this.form.markAllAsTouched();
      if (missingProjetos) this.errorMessage.set('Selecione ao menos um projeto para o recrutador.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
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
          this.successMessage.set(`Usuário ${email} criado.`);
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

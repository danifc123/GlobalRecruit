import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Banner, Button, Card, Input, Select, Table, type SelectOption } from '@app/shared/ui';
import { UsersService } from '@app/core/data/users.service';
import { ProjetosParceirosService } from '@app/core/data/projetos-parceiros.service';
import { AppUser } from '@app/core/models/user';
import { ProjetoParceiro } from '@app/core/models/projeto-parceiro';

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'recruiter', label: 'Recrutador' },
  { value: 'partner', label: 'Parceiro' },
  { value: 'developer', label: 'Desenvolvedor (acesso total)' },
];

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((option) => [option.value, option.label]),
);

@Component({
  selector: 'app-usuarios',
  imports: [ReactiveFormsModule, Banner, Button, Card, Input, Select, Table],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Usuarios {
  private readonly fb = inject(FormBuilder);
  private readonly usersService = inject(UsersService);
  private readonly projetosService = inject(ProjetosParceirosService);

  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly columns = ['Email', 'Papel', 'Projeto Parceiro', 'Status'];

  protected readonly users = signal<AppUser[]>([]);
  protected readonly projetos = signal<ProjetoParceiro[]>([]);
  protected readonly loading = signal(true);
  protected readonly isEmpty = computed(() => !this.loading() && this.users().length === 0);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly projetoOptions = computed<SelectOption[]>(() =>
    this.projetos().map((projeto) => ({ value: projeto.id, label: `${projeto.nome} — ${projeto.cliente}` })),
  );

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['', [Validators.required]],
    partnerProjectId: [''],
  });

  protected readonly isPartnerRole = computed(() => this.form.controls.role.value === 'partner');

  constructor() {
    this.loadUsers();
    this.projetosService.list().subscribe((projetos) => this.projetos.set(projetos));

    this.form.controls.role.valueChanges.subscribe((role) => {
      const partnerCtrl = this.form.controls.partnerProjectId;
      if (role === 'partner') {
        partnerCtrl.setValidators([Validators.required]);
      } else {
        partnerCtrl.clearValidators();
        partnerCtrl.setValue('');
      }
      partnerCtrl.updateValueAndValidity();
    });
  }

  protected roleLabel(role: string): string {
    return ROLE_LABELS[role] ?? role;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    const { email, password, role, partnerProjectId } = this.form.getRawValue();

    this.usersService
      .create({
        email,
        password,
        role: role as AppUser['role'],
        partnerProjectId: partnerProjectId || undefined,
      })
      .subscribe({
        next: () => {
          this.successMessage.set(`Usuário ${email} criado.`);
          this.form.reset({ email: '', password: '', role: '', partnerProjectId: '' });
          this.submitting.set(false);
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
    this.usersService.list().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}

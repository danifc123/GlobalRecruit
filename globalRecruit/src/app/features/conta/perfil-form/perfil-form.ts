import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

import { Banner, Button, Input } from '@app/shared/ui';
import { AuthService } from '@app/core/auth/auth.service';
import { UsersService } from '@app/core/data/users.service';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';

// nova senha e confirmação precisam bater — validador no grupo, não no
// campo, porque depende do valor de dois controles ao mesmo tempo
function senhasIguaisValidator(): ValidatorFn {
  return (group): ValidationErrors | null => {
    const nova = group.get('novaSenha')?.value;
    const confirmar = group.get('confirmarSenha')?.value;
    return nova === confirmar ? null : { senhasDiferentes: true };
  };
}

// reaproveitado no dialog de Configurações (PC, ≥1024px) e em /conta
// (celular/tablet, e PC se acessado direto) — qualquer usuário autenticado
// pode editar nome/e-mail/senha, independente do papel
@Component({
  selector: 'app-perfil-form',
  imports: [ReactiveFormsModule, Banner, Button, Input, TranslatePipe],
  templateUrl: './perfil-form.html',
  styleUrl: './perfil-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilForm {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly dadosForm = this.fb.nonNullable.group({
    nome: [this.auth.session()?.nome ?? ''],
    email: [this.auth.session()?.email ?? '', [Validators.required, Validators.email]],
  });

  protected readonly senhaForm = this.fb.nonNullable.group(
    {
      senhaAtual: ['', [Validators.required, Validators.minLength(8)]],
      novaSenha: ['', [Validators.required, Validators.minLength(8)]],
      confirmarSenha: ['', [Validators.required, Validators.minLength(8)]],
    },
    { validators: senhasIguaisValidator() },
  );

  protected readonly savingDados = signal(false);
  protected readonly dadosSucesso = signal(false);
  protected readonly dadosErro = signal<string | null>(null);

  protected readonly savingSenha = signal(false);
  protected readonly senhaSucesso = signal(false);
  protected readonly senhaErro = signal<string | null>(null);

  protected salvarDados(): void {
    if (this.dadosForm.invalid || this.savingDados()) {
      this.dadosForm.markAllAsTouched();
      return;
    }

    this.savingDados.set(true);
    this.dadosSucesso.set(false);
    this.dadosErro.set(null);
    const { nome, email } = this.dadosForm.getRawValue();

    this.usersService
      .updateMe(nome.trim() || null, email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.auth.updateSessionProfile(user.nome, user.email);
          this.savingDados.set(false);
          this.dadosSucesso.set(true);
        },
        error: (err) => {
          this.savingDados.set(false);
          this.dadosErro.set(err.status === 409 ? 'Esse e-mail já está em uso.' : 'Não foi possível salvar.');
        },
      });
  }

  protected salvarSenha(): void {
    if (this.senhaForm.invalid || this.savingSenha()) {
      this.senhaForm.markAllAsTouched();
      return;
    }

    this.savingSenha.set(true);
    this.senhaSucesso.set(false);
    this.senhaErro.set(null);
    const { senhaAtual, novaSenha } = this.senhaForm.getRawValue();

    this.usersService
      .changePassword(senhaAtual, novaSenha)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingSenha.set(false);
          this.senhaSucesso.set(true);
          this.senhaForm.reset({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });
        },
        error: (err) => {
          this.savingSenha.set(false);
          this.senhaErro.set(err.status === 400 ? 'Senha atual incorreta.' : 'Não foi possível trocar a senha.');
        },
      });
  }
}

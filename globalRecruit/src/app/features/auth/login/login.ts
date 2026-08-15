import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '@app/core/auth/auth.service';
import { Banner, Button, Card, Input } from '@app/shared/ui';

function buildLoginForm(fb: FormBuilder) {
  return fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
}

type LoginForm = ReturnType<typeof buildLoginForm>;

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, Button, Input, Card, Banner],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  // 3 árvores de markup (<640 / 640–1023 / ≥1024) ficam todas no DOM ao
  // mesmo tempo, só uma visível via CSS — por isso cada uma precisa da sua
  // própria instância de FormGroup. Um único FormGroup compartilhado por 3
  // <form [formGroup]> simultâneos deixa mais de um FormGroupDirective vivo
  // apontando pro mesmo controle ao mesmo tempo, o que quebra a hidratação/
  // bootstrap do Angular (tela pisca e fica em branco).
  protected readonly formMobile = buildLoginForm(this.fb);
  protected readonly formCard = buildLoginForm(this.fb);
  protected readonly formSplit = buildLoginForm(this.fb);

  protected async submit(form: LoginForm): Promise<void> {
    if (form.invalid || this.loading()) {
      form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    const { email, password } = form.getRawValue();

    try {
      await this.auth.login(email, password);
      await this.router.navigateByUrl('/dashboard');
    } catch {
      this.errorMessage.set('Email ou senha inválidos.');
    } finally {
      this.loading.set(false);
    }
  }
}

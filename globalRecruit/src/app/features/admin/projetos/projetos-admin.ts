import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Banner, Button, EmptyState, Icon, Input, Page, Sheet, Skeleton, Table } from '@app/shared/ui';
import { ProjetosParceirosService } from '@app/core/data/projetos-parceiros.service';
import { ProjetoParceiro } from '@app/core/models/projeto-parceiro';

@Component({
  selector: 'app-projetos-admin',
  imports: [ReactiveFormsModule, Banner, Button, EmptyState, Icon, Input, Page, Sheet, Skeleton, Table, DatePipe],
  templateUrl: './projetos-admin.html',
  styleUrl: './projetos-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjetosAdmin {
  private readonly fb = inject(FormBuilder);
  private readonly projetosService = inject(ProjetosParceirosService);

  protected readonly columns = ['Nome', 'Cliente', 'Status', 'Criado em'];

  protected readonly projetos = signal<ProjetoParceiro[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly isEmpty = computed(() => !this.loading() && this.projetos().length === 0);

  protected readonly showForm = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required]],
    cliente: ['', [Validators.required]],
  });

  constructor() {
    this.loadProjetos();
  }

  protected toggleForm(): void {
    this.showForm.update((value) => !value);
    this.errorMessage.set(null);
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    const { nome, cliente } = this.form.getRawValue();

    this.projetosService.create(nome, cliente).subscribe({
      next: (projeto) => {
        this.successMessage.set(`Projeto ${projeto.nome} criado.`);
        this.form.reset({ nome: '', cliente: '' });
        this.submitting.set(false);
        this.showForm.set(false);
        this.loadProjetos();
      },
      error: () => {
        this.errorMessage.set('Não foi possível criar o projeto.');
        this.submitting.set(false);
      },
    });
  }

  private loadProjetos(): void {
    this.loading.set(true);
    this.error.set(false);
    this.projetosService.list().subscribe({
      next: (projetos) => {
        this.projetos.set(projetos);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Banner, Button, Card, Icon, Input, Select, Table, type SelectOption } from '@app/shared/ui';
import { VagasService } from '@app/core/data/vagas.service';
import { ProjetosParceirosService } from '@app/core/data/projetos-parceiros.service';
import { Vaga } from '@app/core/models/vaga';
import { ProjetoParceiro } from '@app/core/models/projeto-parceiro';

const PRIORIDADE_OPTIONS: SelectOption[] = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
];

@Component({
  selector: 'app-vagas-ativas',
  imports: [ReactiveFormsModule, Button, Icon, Table, Card, Input, Select, Banner],
  templateUrl: './vagas-ativas.html',
  styleUrl: './vagas-ativas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VagasAtivas {
  private readonly fb = inject(FormBuilder);
  private readonly vagasService = inject(VagasService);
  private readonly projetosService = inject(ProjetosParceirosService);

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
  ];

  protected readonly vagas = signal<Vaga[]>([]);
  protected readonly loading = signal(true);
  protected readonly isEmpty = computed(() => !this.loading() && this.vagas().length === 0);

  protected readonly projetos = signal<ProjetoParceiro[]>([]);
  protected readonly projetoOptions = computed<SelectOption[]>(() =>
    this.projetos().map((projeto) => ({ value: projeto.id, label: `${projeto.nome} — ${projeto.cliente}` })),
  );
  protected readonly prioridadeOptions = PRIORIDADE_OPTIONS;

  protected readonly showForm = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

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
    this.projetosService.list().subscribe((projetos) => this.projetos.set(projetos));
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
    const raw = this.form.getRawValue();

    this.vagasService
      .create({
        projetoId: raw.projetoId,
        cliente: raw.cliente,
        cargo: raw.cargo,
        idioma: raw.idioma || undefined,
        pais: raw.pais || undefined,
        modalidade: raw.modalidade || undefined,
        salario: raw.salario ? Number(raw.salario) : undefined,
        comissao: raw.comissao ? Number(raw.comissao) : undefined,
        prioridade: raw.prioridade as Vaga['prioridade'],
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.showForm.set(false);
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
          this.errorMessage.set('Não foi possível criar a vaga.');
          this.submitting.set(false);
        },
      });
  }

  private loadVagas(): void {
    this.loading.set(true);
    this.vagasService.list(0, 50, 'aberta').subscribe({
      next: (page) => {
        this.vagas.set(page.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}

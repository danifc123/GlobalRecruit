import { Injectable, signal } from '@angular/core';

import type { Vaga } from '@app/core/models/vaga';

// acionado pelo FAB da BottomNav (só existe no celular) — como o FAB fica
// visível em qualquer aba, "Nova vaga" pode ser pedida de fora da rota
// /vagas-ativas; o componente lê `pending` no construtor (chegando já pela
// navegação) e via effect (se já estiver montado) e some com o sinal ao
// consumir, pra não reabrir sozinho numa navegação futura.
//
// Mesmo mecanismo serve pro "Editar vaga" do painel de detalhe (≥1024px):
// VagaDetalhe é uma rota filha de VagasAtivas, então não tem acesso direto
// ao Sheet/form que só existe no pai — aciona editVaga() aqui, VagasAtivas
// (que já está montado, é o pai) reage via effect.
@Injectable({ providedIn: 'root' })
export class QuickCreateService {
  private readonly pendingSignal = signal(false);
  readonly pending = this.pendingSignal.asReadonly();

  private readonly editSignal = signal<Vaga | null>(null);
  readonly editTarget = this.editSignal.asReadonly();

  openNovaVaga(): void {
    this.pendingSignal.set(true);
  }

  consume(): boolean {
    const wasPending = this.pendingSignal();
    if (wasPending) this.pendingSignal.set(false);
    return wasPending;
  }

  editVaga(vaga: Vaga): void {
    this.editSignal.set(vaga);
  }

  consumeEdit(): Vaga | null {
    const vaga = this.editSignal();
    if (vaga) this.editSignal.set(null);
    return vaga;
  }
}

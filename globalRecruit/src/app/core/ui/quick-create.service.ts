import { Injectable, signal } from '@angular/core';

// acionado pelo FAB da BottomNav (só existe no celular) — como o FAB fica
// visível em qualquer aba, "Nova vaga" pode ser pedida de fora da rota
// /vagas-ativas; o componente lê `pending` no construtor (chegando já pela
// navegação) e via effect (se já estiver montado) e some com o sinal ao
// consumir, pra não reabrir sozinho numa navegação futura.
@Injectable({ providedIn: 'root' })
export class QuickCreateService {
  private readonly pendingSignal = signal(false);
  readonly pending = this.pendingSignal.asReadonly();

  openNovaVaga(): void {
    this.pendingSignal.set(true);
  }

  consume(): boolean {
    const wasPending = this.pendingSignal();
    if (wasPending) this.pendingSignal.set(false);
    return wasPending;
  }
}

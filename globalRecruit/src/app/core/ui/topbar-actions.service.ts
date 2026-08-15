import { Injectable, WritableSignal, signal } from '@angular/core';

import type { IconName } from '@app/shared/ui';

export interface TopbarAction {
  label: string;
  icon?: IconName;
  onClick: () => void;
}

export interface TopbarSearch {
  placeholder: string;
  query: WritableSignal<string>;
}

// Mesmo padrão do QuickCreateService: um sinal que a tela atual registra e o
// Shell lê pra desenhar a busca/ação contextual no topbar (só ≥1024px) sem
// cada tela precisar saber que o topbar existe. Tela troca de rota → limpa
// no DestroyRef.onDestroy — sem isso a ação/busca da tela anterior "gruda".
@Injectable({ providedIn: 'root' })
export class TopbarActionsService {
  private readonly actionSignal = signal<TopbarAction | null>(null);
  private readonly searchSignal = signal<TopbarSearch | null>(null);

  readonly action = this.actionSignal.asReadonly();
  readonly search = this.searchSignal.asReadonly();

  setAction(action: TopbarAction): void {
    this.actionSignal.set(action);
  }

  clearAction(): void {
    this.actionSignal.set(null);
  }

  setSearch(search: TopbarSearch): void {
    this.searchSignal.set(search);
  }

  clearSearch(): void {
    this.searchSignal.set(null);
  }
}

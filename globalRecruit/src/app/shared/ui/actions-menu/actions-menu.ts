import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild, input, signal } from '@angular/core';

import { Icon } from '../icon/icon';

// Primeiro menu de ações do app — botão "..." que abre um painel pequeno
// ancorado embaixo dele. `position: fixed` (coordenadas calculadas do
// gatilho no momento em que abre) em vez de `absolute`: assim o painel
// flutua por cima de qualquer coisa, sem contar como overflow de um
// ancestral com scroll — ex.: a tabela em `table.scss` tem
// `overflow-x: auto`, e um painel `absolute` all lá dentro forçava um
// scroll esquisito nela. Fecha ao clicar fora (backdrop invisível
// full-screen, mesma técnica do Sheet), no Escape, ao rolar a página, ou
// ao clicar em qualquer item projetado (o clique borbulha até o painel).
@Component({
  selector: 'app-actions-menu',
  imports: [Icon],
  templateUrl: './actions-menu.html',
  styleUrl: './actions-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionsMenu {
  readonly label = input('Mais ações');

  protected readonly open = signal(false);
  protected readonly panelStyle = signal<Record<string, string>>({});

  @ViewChild('trigger') private readonly triggerRef?: ElementRef<HTMLButtonElement>;

  @HostListener('document:keydown.escape')
  protected handleEscape(): void {
    if (this.open()) this.close();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  protected handleViewportChange(): void {
    // painel fixed não acompanha o gatilho se a página rolar/mudar de
    // tamanho enquanto aberto — mais simples fechar do que reposicionar
    if (this.open()) this.close();
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    const rect = this.triggerRef?.nativeElement.getBoundingClientRect();
    if (rect) {
      this.panelStyle.set({
        top: `${rect.bottom + 8}px`,
        right: `${window.innerWidth - rect.right}px`,
      });
    }
    this.open.set(true);
  }

  protected close(): void {
    this.open.set(false);
  }
}

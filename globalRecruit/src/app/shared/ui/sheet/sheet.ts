import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  ViewChild,
  effect,
  inject,
  input,
  output,
} from '@angular/core';

import { Icon } from '../icon/icon';
import { IdGenerator } from '../../utils/id-generator';

// Abaixo de 640px vira um painel de tela cheia deslizando de baixo pra cima
// (modal de verdade, com backdrop e foco preso); de 640px pra cima renderiza
// como bloco inline, visual idêntico ao Card (mesmo container que os
// formulários de criação já usavam antes deste componente existir).
@Component({
  selector: 'app-sheet',
  imports: [Icon],
  templateUrl: './sheet.html',
  styleUrl: './sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sheet {
  readonly open = input(false);
  readonly title = input<string>();
  readonly closed = output<void>();

  @ViewChild('closeButton') private readonly closeButtonRef?: ElementRef<HTMLButtonElement>;

  protected readonly titleId = inject(IdGenerator).next('app-sheet-title');

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private lastFocused: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (!this.isBrowser) return;

      if (this.open()) {
        this.lastFocused = document.activeElement as HTMLElement | null;
        queueMicrotask(() => this.closeButtonRef?.nativeElement.focus());
      } else {
        this.lastFocused?.focus();
        this.lastFocused = null;
      }
    });
  }

  @HostListener('document:keydown.escape')
  protected handleEscape(): void {
    if (this.open()) this.close();
  }

  protected close(): void {
    this.closed.emit();
  }
}

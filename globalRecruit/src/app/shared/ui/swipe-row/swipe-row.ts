import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { Icon, type IconName } from '../icon/icon';
import { TranslatePipe } from '@app/core/i18n/translate.pipe';

export interface SwipeAction {
  id: string;
  label: string;
  icon: IconName;
  tone: 'primary' | 'accent';
}

const ACTION_WIDTH = 68;

// linha com ações reveladas ao arrastar pra esquerda (padrão "Indicar" /
// "Priorizar" de Vagas Ativas). Só intercepta o gesto depois que o arrasto
// horizontal supera o vertical — antes disso a lista rola normalmente.
@Component({
  selector: 'app-swipe-row',
  imports: [Icon, TranslatePipe],
  templateUrl: './swipe-row.html',
  styleUrl: './swipe-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwipeRow {
  readonly actions = input<SwipeAction[]>([]);
  readonly action = output<string>();

  protected readonly offset = signal(0);
  protected readonly dragging = signal(false);
  protected readonly maxOffset = computed(() => this.actions().length * ACTION_WIDTH);

  private startX = 0;
  private startY = 0;
  private startOffset = 0;
  private axisLocked: 'x' | 'y' | null = null;

  protected onTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.startOffset = this.offset();
    this.axisLocked = null;
    this.dragging.set(true);
  }

  protected onTouchMove(event: TouchEvent): void {
    const touch = event.touches[0];
    const dx = touch.clientX - this.startX;
    const dy = touch.clientY - this.startY;

    if (this.axisLocked === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      this.axisLocked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }

    if (this.axisLocked === 'x') {
      event.preventDefault();
      const next = Math.min(0, Math.max(-this.maxOffset(), this.startOffset + dx));
      this.offset.set(next);
    }
  }

  protected onTouchEnd(): void {
    this.dragging.set(false);
    if (this.axisLocked === 'x') {
      this.offset.set(this.offset() < -this.maxOffset() / 2 ? -this.maxOffset() : 0);
    }
    this.axisLocked = null;
  }

  protected trigger(id: string): void {
    this.offset.set(0);
    this.action.emit(id);
  }

  protected close(): void {
    this.offset.set(0);
  }
}

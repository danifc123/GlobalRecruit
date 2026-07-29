import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Card, EmptyState } from '@app/shared/ui';

@Component({
  selector: 'app-banco-talentos',
  imports: [Card, EmptyState],
  template: `
    <div class="page">
      <app-card>
        <app-empty-state
          icon="users"
          title="Banco de Talentos"
          description="A base de candidatos disponíveis para futuras oportunidades será construída aqui."
        />
      </app-card>
    </div>
  `,
  styles: `
    :host {
      display: block;
      padding: var(--gr-space-4);
      animation: page-enter var(--gr-transition-base);
    }
    .page {
      max-width: 1200px;
      margin-inline: auto;
    }
    @media (min-width: 1024px) {
      :host {
        padding: var(--gr-space-6);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BancoTalentos {}

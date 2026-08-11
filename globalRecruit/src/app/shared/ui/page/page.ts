import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page',
  templateUrl: './page.html',
  styleUrl: './page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Page {
  readonly description = input<string>();
}

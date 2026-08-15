import { Injectable } from '@angular/core';

// `providedIn: 'root'` (em vez de um contador de módulo) é o que importa aqui:
// no SSR, `bootstrapApplication` cria uma árvore de injeção nova a cada
// request, então esta instância — e o contador dela — reinicia em sincronia
// com a que o client cria ao hidratar. Uma variável de módulo, ao contrário,
// persistiria e acumularia entre requests no processo Node de longa duração,
// gerando um id diferente do renderizado no servidor e quebrando a
// associação label/for após a hidratação.
@Injectable({ providedIn: 'root' })
export class IdGenerator {
  private counter = 0;

  next(prefix: string): string {
    return `${prefix}-${this.counter++}`;
  }
}

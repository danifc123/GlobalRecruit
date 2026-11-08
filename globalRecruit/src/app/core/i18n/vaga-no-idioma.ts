import { CAMPOS_TRADUZIVEIS, Vaga } from '@app/core/models/vaga';
import type { Language } from './language.service';

/**
 * Vaga como deve ser exibida no idioma do site: em português, os campos com
 * tradução automática trocam pelo texto traduzido; em inglês, o original
 * (spec traducao-vagas). Não altera o objeto recebido.
 */
export function vagaNoIdioma(vaga: Vaga, idioma: Language): Vaga {
  if (idioma !== 'pt' || !temTraducao(vaga)) return vaga;
  const exibida: Vaga = { ...vaga };
  for (const campo of CAMPOS_TRADUZIVEIS) {
    const traduzido = vaga.traducoes[campo];
    if (traduzido) exibida[campo] = traduzido;
  }
  return exibida;
}

/** Há ao menos um campo exibido traduzido nesse idioma? */
export function temTraducaoExibida(vaga: Vaga, idioma: Language): boolean {
  return idioma === 'pt' && temTraducao(vaga);
}

function temTraducao(vaga: Vaga): boolean {
  return CAMPOS_TRADUZIVEIS.some((campo) => !!vaga.traducoes[campo]);
}

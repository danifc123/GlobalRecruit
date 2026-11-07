export type Prioridade = 'baixa' | 'media' | 'alta';
export type StatusVaga = 'aberta' | 'pausada' | 'fechada';

export interface Vaga {
  id: string;
  projetoId: string;
  // Role ID da planilha do cliente (ex.: "DSR-001"); não é único
  codigo: string | null;
  cliente: string;
  cargo: string;
  idioma: string | null;
  pais: string | null;
  localizacao: string | null;
  modalidade: string | null;
  // texto livre: "multiple", "30 per mo", "ASAP (2 HC)" além de números/datas
  headcount: string | null;
  dataInicio: string | null;
  // legado — não é mais preenchido; faixaSalarial substitui
  salario: number | null;
  faixaSalarial: string | null;
  moeda: string | null;
  tipoSalario: string | null;
  comissao: number | null;
  beneficios: string | null;
  realocacao: string | null;
  requisitos: string | null;
  notasInternas: string | null;
  jdNome: string | null;
  jdUrl: string | null;
  prioridade: Prioridade;
  status: StatusVaga;
  createdAt: string;
  candidatosCount: number;
}

export interface VagaPage {
  items: Vaga[];
  page: number;
  pageSize: number;
  total: number;
}

export const PRIORIDADE_ORDEM: Record<Prioridade, number> = { alta: 0, media: 1, baixa: 2 };

export interface VagaCreate {
  projetoId: string;
  codigo?: string;
  cliente: string;
  cargo: string;
  idioma?: string;
  pais?: string;
  localizacao?: string;
  modalidade?: string;
  headcount?: string;
  dataInicio?: string;
  faixaSalarial?: string;
  moeda?: string;
  tipoSalario?: string;
  comissao?: number;
  beneficios?: string;
  realocacao?: string;
  requisitos?: string;
  notasInternas?: string;
  // não aparece no formulário (vem da planilha), mas precisa ir no PATCH:
  // a edição substitui todos os campos e apagaria o nome da JD
  jdNome?: string;
  jdUrl?: string;
  prioridade: Prioridade;
}

export type AcaoImportacao = 'criar' | 'atualizar' | 'ignorar';

export interface ErroLinhaImportacao {
  linha: number;
  motivo: string;
}

export interface ItemImportacao {
  linha: number;
  codigo: string | null;
  cargo: string | null;
  cliente: string | null;
  acao: AcaoImportacao;
}

export interface ResultadoImportacao {
  dryRun: boolean;
  aba: string;
  criadas: number;
  atualizadas: number;
  ignoradas: number;
  erros: ErroLinhaImportacao[];
  itens: ItemImportacao[];
}

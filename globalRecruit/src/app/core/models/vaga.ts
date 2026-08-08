export type Prioridade = 'baixa' | 'media' | 'alta';
export type StatusVaga = 'aberta' | 'pausada' | 'fechada';

export interface Vaga {
  id: string;
  projetoId: string;
  cliente: string;
  cargo: string;
  idioma: string | null;
  pais: string | null;
  modalidade: string | null;
  salario: number | null;
  comissao: number | null;
  prioridade: Prioridade;
  status: StatusVaga;
  createdAt: string;
}

export interface VagaPage {
  items: Vaga[];
  page: number;
  pageSize: number;
  total: number;
}

export interface VagaCreate {
  projetoId: string;
  cliente: string;
  cargo: string;
  idioma?: string;
  pais?: string;
  modalidade?: string;
  salario?: number;
  comissao?: number;
  prioridade: Prioridade;
}

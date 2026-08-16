export type Estagio = 'triagem' | 'entrevista' | 'proposta' | 'contratado' | 'rejeitado';

export interface HistoricoEstagio {
  id: string;
  estagio: Estagio;
  updatedAt: string;
}

export interface OutraCandidatura {
  id: string;
  vagaId: string;
  vagaCargo: string;
  vagaCliente: string;
  estagioAtual: Estagio | null;
}

export interface Candidato {
  id: string;
  nome: string;
  email: string;
  vagaId: string;
  createdAt: string;
  estagioAtual: Estagio | null;
  historico: HistoricoEstagio[];
  outrasCandidaturas: OutraCandidatura[];
}

export interface CandidatoCreate {
  nome: string;
  email: string;
  vagaId: string;
}

export const ESTAGIO_ORDEM: Estagio[] = ['triagem', 'entrevista', 'proposta', 'contratado', 'rejeitado'];

export const ESTAGIO_LABELS: Record<Estagio, string> = {
  triagem: 'Triagem',
  entrevista: 'Entrevista cliente',
  proposta: 'Proposta',
  contratado: 'Contratado',
  rejeitado: 'Rejeitado',
};

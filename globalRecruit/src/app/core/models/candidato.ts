export type Estagio = 'triagem' | 'entrevista' | 'proposta' | 'contratado' | 'rejeitado';

export interface Candidato {
  id: string;
  nome: string;
  email: string;
  vagaId: string;
  createdAt: string;
  estagioAtual: Estagio | null;
}

export interface CandidatoCreate {
  nome: string;
  email: string;
  vagaId: string;
}

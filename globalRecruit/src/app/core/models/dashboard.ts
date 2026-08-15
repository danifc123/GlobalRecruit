export interface VagaPorIdioma {
  idioma: string;
  count: number;
}

export interface CandidatoParado {
  id: string;
  nome: string;
  vagaCargo: string;
  diasParado: number;
}

export interface VagaSemCandidato {
  id: string;
  cargo: string;
  cliente: string;
}

export interface EtapaCount {
  estagio: string;
  count: number;
}

export interface PropostaAguardando {
  id: string;
  nome: string;
  vagaCargo: string;
  enviadaEm: string;
}

export interface DashboardStats {
  vagasAbertas: number;
  vagasAltaPrioridade: number;
  candidatosEmPipeline: number;
  candidatosContratados: number;
  clientesAtivos: number;
  pctModalidadeRemota: number;
  vagasNovasSemana: number;
  vagasPorIdioma: VagaPorIdioma[];
  candidatosParados: CandidatoParado[];
  vagasSemCandidato: VagaSemCandidato[];
  funilPorEtapa: EtapaCount[];
  propostasAguardando: PropostaAguardando[];
}

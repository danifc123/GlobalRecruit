import { Role } from '@app/core/models/auth';

export interface ProjetoRef {
  id: string;
  nome: string;
}

export interface AppUser {
  id: string;
  email: string;
  role: Role;
  projetos: ProjetoRef[];
  isActive: boolean;
}

export interface UserCreate {
  email: string;
  password: string;
  role: Role;
  projetoIds?: string[];
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  recruiter: 'Recrutador',
  developer: 'Developer',
};

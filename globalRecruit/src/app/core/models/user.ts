import { Role } from '@app/core/models/auth';

export interface AppUser {
  id: string;
  email: string;
  role: Role;
  partnerProjectId: string | null;
  isActive: boolean;
}

export interface UserCreate {
  email: string;
  password: string;
  role: Role;
  partnerProjectId?: string;
}

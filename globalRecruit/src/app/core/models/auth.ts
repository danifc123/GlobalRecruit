export type Role = 'admin' | 'recruiter' | 'partner' | 'developer';

export interface Session {
  userId: string;
  email: string;
  role: Role;
  partnerProjectId: string | null;
}

export type Role = 'admin' | 'recruiter' | 'developer';

export interface Session {
  userId: string;
  email: string;
  role: Role;
}

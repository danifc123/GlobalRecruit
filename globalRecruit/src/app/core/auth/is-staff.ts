import type { Role } from '@app/core/models/auth';

// admin/developer têm acesso a telas de gestão (vagas, pipeline, usuários,
// projetos) e à personalização do sistema; recrutador não.
export function isStaffRole(role: Role | undefined): boolean {
  return role === 'admin' || role === 'developer';
}

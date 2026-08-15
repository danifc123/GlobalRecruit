import { Role } from '@app/core/models/auth';

interface AccessTokenClaims {
  sub: string;
  role: Role;
  exp: number;
}

// decodifica só pra ler claims no client (UI state) — nunca é a fonte da
// verdade de autorização, o backend sempre revalida a assinatura a cada request
export function decodeAccessToken(token: string): AccessTokenClaims | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as AccessTokenClaims;
  } catch {
    return null;
  }
}

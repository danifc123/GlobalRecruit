// primeira letra do primeiro e do último nome ("Rafael Souza" -> "RS");
// nome de uma palavra só usa as 2 primeiras letras ("Ana" -> "AN")
export function getInitials(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// fallback pra quando o usuário não preencheu um nome — usa a parte local
// do e-mail, separada por ./_/- ("ana.ferreira@..." -> "AF"; "dev@..." -> "DE")
export function getEmailInitials(email: string): string {
  const local = email.split('@')[0] ?? '';
  const partes = local.split(/[._-]+/).filter(Boolean);
  return (partes.length > 1 ? partes[0][0] + partes[1][0] : local.slice(0, 2)).toUpperCase();
}

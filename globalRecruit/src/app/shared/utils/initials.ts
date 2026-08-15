// primeira letra do primeiro e do último nome ("Rafael Souza" -> "RS");
// nome de uma palavra só usa as 2 primeiras letras ("Ana" -> "AN")
export function getInitials(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

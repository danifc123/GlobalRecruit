// dias inteiros desde uma data ISO — usado pro alerta de "candidato parado"
export function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

// texto curto tipo "há 4 dias" / "há 6 horas", pras linhas de candidato
export function tempoRelativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const horas = Math.floor(ms / (1000 * 60 * 60));
  if (horas < 24) return horas <= 1 ? 'há 1 hora' : `há ${horas} horas`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

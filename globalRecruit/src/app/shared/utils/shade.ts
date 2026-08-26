// Deriva só o tom vizinho (hover/ativo) de UMA cor escolhida pelo admin —
// não é um gerador de paleta completo (isso exigiria interpolar os 10
// degraus inteiros em HSL, decisão explícita de não fazer agora). Escala
// os canais RGB em direção a branco (percent > 0) ou preto (percent < 0).
export function shadeHex(hex: string, percent: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;

  const num = parseInt(match[1], 16);
  const channels = [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff].map((channel) => {
    const target = percent > 0 ? 255 : 0;
    const shifted = Math.round(channel + (target - channel) * Math.abs(percent));
    return Math.min(255, Math.max(0, shifted));
  });

  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

// Datas sempre no fuso do Renato (Recife).
export const TZ = 'America/Recife';

export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 0 = domingo ... 6 = sábado
export function weekday(iso: string) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

export function formatDay(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

export function formatShort(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

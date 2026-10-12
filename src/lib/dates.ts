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

// "2026-10" → primeiro e último dia do mês.
export function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, '0')}`, lastDay: last };
}

export function addMonths(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function formatMonth(ym: string) {
  const s = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${ym}-15T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Prazo em linguagem do dia a dia: "Hoje", "Amanhã", "Ontem" ou "12/10".
export function prazo(iso: string, hoje: string) {
  if (iso === hoje) return 'Hoje';
  if (iso === addDays(hoje, 1)) return 'Amanhã';
  if (iso === addDays(hoje, -1)) return 'Ontem';
  return formatShort(iso);
}

// Sem 'server-only': o botão de criar compromisso monta o link no navegador.
const TZ = 'America/Recife';

// Link que abre o Google Agenda com o compromisso já preenchido (o Renato só confere e salva).
export function linkNovoEvento(ev: { titulo: string; dia: string; hora: string | null; minutos: number; descricao?: string | null; local?: string | null; convidados?: string[] }) {
  const compacto = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  let datas: string;
  if (ev.hora) {
    const ini = new Date(`${ev.dia}T${ev.hora}:00-03:00`);
    const fim = new Date(ini.getTime() + ev.minutos * 60_000);
    datas = `${compacto(ini.toISOString())}/${compacto(fim.toISOString())}`;
  } else {
    const d = new Date(`${ev.dia}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    datas = `${ev.dia.replace(/-/g, '')}/${d.toISOString().slice(0, 10).replace(/-/g, '')}`;
  }
  const p = new URLSearchParams({ action: 'TEMPLATE', text: ev.titulo, dates: datas, ctz: TZ });
  if (ev.descricao) p.set('details', ev.descricao);
  if (ev.local) p.set('location', ev.local);
  if (ev.convidados?.length) p.set('add', ev.convidados.join(','));
  return `https://calendar.google.com/calendar/render?${p}`;
}

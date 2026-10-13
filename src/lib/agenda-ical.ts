import 'server-only';
import ICAL from 'ical.js';
import type { Evento } from './google-agenda';

// Jeito simples de ler o Google Agenda: o "Endereço secreto no formato iCal" da agenda,
// guardado na Vercel em GOOGLE_AGENDA_ICS. Só leitura; não precisa de Google Cloud.

const limpa = (v: string | undefined) => v?.trim().replace(/^['"]|['"]$/g, '') || undefined;
export const enderecoIcal = () => limpa(process.env.GOOGLE_AGENDA_ICS);
// O endereço público (".../public/basic.ics") só funciona com a agenda aberta pra todo mundo.
export const icalPublico = () => !!enderecoIcal()?.includes('/public/');

let cache: { url: string; em: number; texto: string } | null = null;

async function baixar() {
  const url = enderecoIcal()!;
  if (cache && cache.url === url && Date.now() - cache.em < 2 * 60_000) return cache.texto;
  const r = await fetch(url, { cache: 'no-store', headers: { accept: 'text/calendar' } });
  const texto = await r.text();
  if (!r.ok || !texto.includes('BEGIN:VCALENDAR')) throw new Error(r.status === 404 ? 'endereço iCal não encontrado (confira GOOGLE_AGENDA_ICS)' : `Google respondeu ${r.status}`);
  cache = { url, em: Date.now(), texto };
  return texto;
}

function paraEvento(ev: ICAL.Event, inicio: ICAL.Time, fim: ICAL.Time, chave: string): Evento {
  const diaInteiro = inicio.isDate;
  const texto = (t: ICAL.Time) => (diaInteiro ? t.toString().slice(0, 10) : t.toJSDate().toISOString());
  const descricao = ev.description ?? '';
  const meet = descricao.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i)?.[0] ?? (ev.component.getFirstPropertyValue('x-google-conference') as string | null) ?? null;
  return { id: chave, titulo: ev.summary || '(sem título)', inicio: texto(inicio), fim: texto(fim), diaInteiro, link: null, meet, local: ev.location || null, soLeitura: true };
}

// Eventos entre dois dias (inclusive), com as repetições (ex.: Rhema toda segunda) já abertas.
export async function listarEventosIcal(de: string, ate: string) {
  const comp = new ICAL.Component(ICAL.parse(await baixar()));
  for (const tz of comp.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz);
  const limiteIni = new Date(`${de}T00:00:00-03:00`).getTime();
  const limiteFim = new Date(`${ate}T23:59:59-03:00`).getTime();
  const dentro = (ini: ICAL.Time, fim: ICAL.Time) => {
    const a = ini.isDate ? new Date(`${ini.toString().slice(0, 10)}T00:00:00-03:00`).getTime() : ini.toJSDate().getTime();
    const b = fim.isDate ? new Date(`${fim.toString().slice(0, 10)}T00:00:00-03:00`).getTime() : fim.toJSDate().getTime();
    return a <= limiteFim && (b > limiteIni || a >= limiteIni);
  };

  const vevents = comp.getAllSubcomponents('vevent');
  // Exceções de eventos repetidos (uma ocorrência remarcada) vêm como VEVENT com RECURRENCE-ID.
  const excecoes = new Map<string, ICAL.Event[]>();
  for (const v of vevents) {
    if (!v.hasProperty('recurrence-id')) continue;
    const uid = String(v.getFirstPropertyValue('uid'));
    excecoes.set(uid, [...(excecoes.get(uid) ?? []), new ICAL.Event(v)]);
  }

  const eventos: Evento[] = [];
  for (const v of vevents) {
    if (v.hasProperty('recurrence-id') || v.getFirstPropertyValue('status') === 'CANCELLED') continue;
    const ev = new ICAL.Event(v);
    for (const ex of excecoes.get(ev.uid) ?? []) ev.relateException(ex);
    if (!ev.isRecurring()) {
      const fim = ev.endDate ?? ev.startDate;
      if (dentro(ev.startDate, fim)) eventos.push(paraEvento(ev, ev.startDate, fim, ev.uid));
      continue;
    }
    const it = ev.iterator();
    for (let n = 0, t = it.next(); t && n < 2000; t = it.next(), n++) {
      const o = ev.getOccurrenceDetails(t);
      if ((o.startDate.isDate ? new Date(`${o.startDate.toString().slice(0, 10)}T00:00:00-03:00`).getTime() : o.startDate.toJSDate().getTime()) > limiteFim) break;
      if (o.item.component.getFirstPropertyValue('status') === 'CANCELLED') continue;
      if (dentro(o.startDate, o.endDate)) eventos.push(paraEvento(o.item, o.startDate, o.endDate, `${ev.uid}:${o.recurrenceId.toString()}`));
    }
  }
  return eventos.sort((a, b) => (a.diaInteiro === b.diaInteiro ? a.inicio.localeCompare(b.inicio) : a.diaInteiro ? -1 : 1));
}

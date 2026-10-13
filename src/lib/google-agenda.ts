import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TZ } from './dates';

// Google Agenda: o Renato conecta a conta Google uma vez (OAuth) e o sistema lê e cria eventos na agenda principal.
// Variáveis na Vercel:
//   GOOGLE_CLIENT_ID       ID do cliente OAuth (Google Cloud > APIs e serviços > Credenciais)
//   GOOGLE_CLIENT_SECRET   chave secreta desse cliente
// O token de acesso de longa duração (refresh token) fica no banco, criptografado com o ORIGO_SESSION_SECRET.

const CHAVE = 'google_agenda';
const ESCOPOS = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events'];
const OAUTH = () => process.env.GOOGLE_OAUTH_BASE?.trim() || 'https://oauth2.googleapis.com';
const API = () => process.env.GOOGLE_API_BASE?.trim() || 'https://www.googleapis.com';
export const ESTADO_COOKIE = 'origo_google_estado';

const limpa = (v: string | undefined) => v?.trim().replace(/^['"]|['"]$/g, '') || undefined;
const clientId = () => limpa(process.env.GOOGLE_CLIENT_ID);
const clientSecret = () => limpa(process.env.GOOGLE_CLIENT_SECRET);

export const agendaConfigurada = () => !!clientId() && !!clientSecret();
export const redirecionamento = (origem: string) => `${origem}/api/google-agenda/callback`;

type Conexao = { token: string; email: string | null; conectado_em: string };
export type Evento = {
  id: string;
  titulo: string;
  inicio: string; // ISO com fuso, ou AAAA-MM-DD quando é dia inteiro
  fim: string;
  diaInteiro: boolean;
  link: string | null;
  meet: string | null;
  local: string | null;
};

// Criptografia do refresh token (AES-256-GCM). A chave sai do segredo da sessão.
function chave() {
  const s = limpa(process.env.ORIGO_SESSION_SECRET);
  if (!s) throw new Error('ORIGO_SESSION_SECRET não configurado');
  return createHash('sha256').update(`${s}:google-agenda`).digest();
}
function cifrar(texto: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chave(), iv);
  const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), dados].map((b) => b.toString('base64url')).join('.');
}
function decifrar(texto: string) {
  const [iv, tag, dados] = texto.split('.').map((p) => Buffer.from(p, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString('utf8');
}

async function lerConexao(supa: SupabaseClient) {
  const { data } = await supa.from('settings').select('valor').eq('chave', CHAVE).maybeSingle();
  return (data?.valor as Conexao | null) ?? null;
}

// O que a tela precisa saber, sem expor o token.
export async function situacaoAgenda(supa: SupabaseClient) {
  const c = agendaConfigurada() ? await lerConexao(supa) : null;
  return { configurada: agendaConfigurada(), conectada: !!c, email: c?.email ?? null, desde: c?.conectado_em ?? null };
}

export function linkDeConexao(origem: string, estado: string) {
  const p = new URLSearchParams({
    client_id: clientId()!,
    redirect_uri: redirecionamento(origem),
    response_type: 'code',
    scope: ESCOPOS.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: estado,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function pedirToken(campos: Record<string, string>) {
  const r = await fetch(`${OAUTH()}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId()!, client_secret: clientSecret()!, ...campos }),
    cache: 'no-store',
  });
  const j = (await r.json().catch(() => null)) as { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string; error?: string; error_description?: string } | null;
  if (!r.ok || !j?.access_token) throw new Error(j?.error_description ?? j?.error ?? `Google respondeu ${r.status}`);
  return j;
}

// Troca o código da volta do Google pelo refresh token e guarda criptografado.
export async function concluirConexao(supa: SupabaseClient, origem: string, codigo: string) {
  const j = await pedirToken({ code: codigo, grant_type: 'authorization_code', redirect_uri: redirecionamento(origem) });
  if (!j.refresh_token) throw new Error('O Google não mandou o acesso permanente. Remova o Origo OS em myaccount.google.com/permissions e conecte de novo.');
  let email: string | null = null;
  try {
    email = String(JSON.parse(Buffer.from(j.id_token!.split('.')[1], 'base64url').toString()).email ?? '') || null;
  } catch {}
  const valor: Conexao = { token: cifrar(j.refresh_token), email, conectado_em: new Date().toISOString() };
  const { error } = await supa.from('settings').upsert({ chave: CHAVE, valor });
  if (error) throw new Error(error.message);
  cache = { acesso: j.access_token!, ate: Date.now() + (j.expires_in ?? 3600) * 1000 - 60_000, de: valor.token };
}

export async function desconectar(supa: SupabaseClient) {
  const c = await lerConexao(supa);
  if (c) {
    try {
      await fetch(`${OAUTH()}/revoke?token=${encodeURIComponent(decifrar(c.token))}`, { method: 'POST', cache: 'no-store' });
    } catch {}
  }
  cache = null;
  await supa.from('settings').delete().eq('chave', CHAVE);
}

let cache: { acesso: string; ate: number; de: string } | null = null;

async function acesso(supa: SupabaseClient) {
  const c = await lerConexao(supa);
  if (!c || !agendaConfigurada()) throw new Error('Google Agenda não conectado');
  if (cache && cache.de === c.token && cache.ate > Date.now()) return cache.acesso;
  const j = await pedirToken({ refresh_token: decifrar(c.token), grant_type: 'refresh_token' });
  cache = { acesso: j.access_token!, ate: Date.now() + (j.expires_in ?? 3600) * 1000 - 60_000, de: c.token };
  return cache.acesso;
}

async function chamar<T>(supa: SupabaseClient, caminho: string, init: RequestInit = {}) {
  const r = await fetch(`${API()}/calendar/v3/calendars/primary${caminho}`, {
    ...init,
    headers: { authorization: `Bearer ${await acesso(supa)}`, 'content-type': 'application/json', ...init.headers },
    cache: 'no-store',
  });
  if (r.status === 204) return null as T;
  const j = (await r.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!r.ok) throw new Error(j?.error?.message ?? `Google Agenda respondeu ${r.status}`);
  return j as T;
}

type EventoGoogle = {
  id: string;
  summary?: string;
  status?: string;
  htmlLink?: string;
  hangoutLink?: string;
  location?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
};

const converter = (e: EventoGoogle): Evento => ({
  id: e.id,
  titulo: e.summary || '(sem título)',
  inicio: e.start.dateTime ?? e.start.date!,
  fim: e.end.dateTime ?? e.end.date!,
  diaInteiro: !e.start.dateTime,
  link: e.htmlLink ?? null,
  meet: e.hangoutLink ?? null,
  local: e.location ?? null,
});

// Recife não tem horário de verão: sempre -03:00.
const noFuso = (dia: string, hora = '00:00') => `${dia}T${hora}:00-03:00`;

// Eventos entre dois dias (inclusive), já em ordem.
export async function listarEventos(supa: SupabaseClient, de: string, ate: string) {
  const eventos: Evento[] = [];
  let pagina: string | undefined;
  do {
    const p = new URLSearchParams({
      timeMin: noFuso(de),
      timeMax: noFuso(ate, '23:59'),
      singleEvents: 'true',
      orderBy: 'startTime',
      timeZone: TZ,
      maxResults: '250',
    });
    if (pagina) p.set('pageToken', pagina);
    const j = await chamar<{ items?: EventoGoogle[]; nextPageToken?: string }>(supa, `/events?${p}`);
    eventos.push(...(j?.items ?? []).filter((e) => e.status !== 'cancelled').map(converter));
    pagina = j?.nextPageToken;
  } while (pagina);
  return eventos;
}

export async function criarEvento(
  supa: SupabaseClient,
  ev: { titulo: string; dia: string; hora: string | null; minutos: number; descricao?: string | null; local?: string | null; convidados?: string[]; meet?: boolean },
) {
  let inicio: { date?: string; dateTime?: string; timeZone?: string };
  let fim: typeof inicio;
  if (ev.hora) {
    const comeco = new Date(noFuso(ev.dia, ev.hora));
    inicio = { dateTime: comeco.toISOString(), timeZone: TZ };
    fim = { dateTime: new Date(comeco.getTime() + ev.minutos * 60_000).toISOString(), timeZone: TZ };
  } else {
    const d = new Date(`${ev.dia}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    inicio = { date: ev.dia };
    fim = { date: d.toISOString().slice(0, 10) };
  }
  const corpo = {
    summary: ev.titulo,
    description: ev.descricao || undefined,
    location: ev.local || undefined,
    start: inicio,
    end: fim,
    attendees: ev.convidados?.length ? ev.convidados.map((email) => ({ email })) : undefined,
    conferenceData: ev.meet ? { createRequest: { requestId: randomBytes(12).toString('hex'), conferenceSolutionKey: { type: 'hangoutsMeet' } } } : undefined,
  };
  const p = new URLSearchParams({ conferenceDataVersion: ev.meet ? '1' : '0', sendUpdates: ev.convidados?.length ? 'all' : 'none' });
  const e = await chamar<EventoGoogle>(supa, `/events?${p}`, { method: 'POST', body: JSON.stringify(corpo) });
  return converter(e);
}

export async function excluirEvento(supa: SupabaseClient, id: string) {
  await chamar(supa, `/events/${encodeURIComponent(id)}?sendUpdates=all`, { method: 'DELETE' });
}

// "09:30" no fuso do Renato.
export function hora(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

// Dia (AAAA-MM-DD) em que o evento começa, no fuso do Renato.
export function diaDo(ev: Evento) {
  return ev.diaInteiro ? ev.inicio : new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ev.inicio));
}

// Dias em que o evento aparece (eventos de vários dias aparecem em cada um).
export function diasDo(ev: Evento) {
  const primeiro = diaDo(ev);
  const ultimo = ev.diaInteiro
    ? new Date(new Date(`${ev.fim}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10)
    : new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(new Date(ev.fim).getTime() - 1));
  const dias = [primeiro];
  for (let d = primeiro; d < ultimo && dias.length < 31; ) {
    const n = new Date(`${d}T12:00:00Z`);
    n.setUTCDate(n.getUTCDate() + 1);
    d = n.toISOString().slice(0, 10);
    dias.push(d);
  }
  return dias;
}

// Endereço público do site, do jeito que o navegador vê (a Vercel manda nos cabeçalhos).
export function origemDe(h: Headers) {
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
}

'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkPassword, createSessionToken, isLoginConfigured, requireAuth, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth';
import { db, type LeadStatus } from '@/lib/db';
import { addDays, today } from '@/lib/dates';
import { ESPERA, normalizeWhatsapp, type Passo } from '@/lib/prospeccao';

export async function login(_: unknown, form: FormData) {
  if (!isLoginConfigured()) return { erro: 'Login ainda não configurado: defina ORIGO_PASSWORD e ORIGO_SESSION_SECRET na Vercel.' };
  if (!checkPassword(form.get('senha'))) return { erro: 'Senha incorreta.' };
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
  redirect('/');
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect('/login');
}

function refresh() {
  revalidatePath('/', 'layout');
}

// Tarefas

export async function addTask(form: FormData) {
  await requireAuth();
  const titulo = String(form.get('titulo') ?? '').trim();
  if (!titulo) return;
  const quando = String(form.get('quando') ?? 'hoje');
  const data = quando === 'hoje' ? today() : quando === 'amanha' ? addDays(today(), 1) : null;
  await db().from('tasks').insert({ titulo, data });
  refresh();
}

export async function toggleTask(id: string, feita: boolean) {
  await requireAuth();
  await db().from('tasks').update({ feita, feita_em: feita ? new Date().toISOString() : null }).eq('id', id);
  refresh();
}

export async function moveTask(id: string, data: string | null) {
  await requireAuth();
  await db().from('tasks').update({ data }).eq('id', id);
  refresh();
}

export async function deleteTask(id: string) {
  await requireAuth();
  await db().from('tasks').delete().eq('id', id);
  refresh();
}

// Rotina de tráfego

export async function toggleRoutine(clientId: string, tipo: string, feita: boolean) {
  await requireAuth();
  const data = today();
  if (feita) {
    await db().from('routine_checks').upsert({ client_id: clientId, tipo, data }, { onConflict: 'client_id,tipo,data' });
  } else {
    await db().from('routine_checks').delete().match({ client_id: clientId, tipo, data });
  }
  refresh();
}

// Prospecção

export async function markSent(id: string, passo: Passo) {
  await requireAuth();
  const espera = ESPERA[passo];
  await db()
    .from('leads')
    .update({ status: passo, proxima_acao: espera ? addDays(today(), espera) : null, updated_at: new Date().toISOString() })
    .eq('id', id);
  refresh();
}

export async function setLeadStatus(id: string, status: LeadStatus) {
  await requireAuth();
  const proxima_acao = status === 'respondeu' || status === 'call' ? today() : null;
  await db().from('leads').update({ status, proxima_acao, updated_at: new Date().toISOString() }).eq('id', id);
  refresh();
}

export async function saveLeadNotes(id: string, notas: string) {
  await requireAuth();
  await db().from('leads').update({ notas, updated_at: new Date().toISOString() }).eq('id', id);
  refresh();
}

export async function addLead(form: FormData) {
  await requireAuth();
  const nome = String(form.get('nome') ?? '').trim();
  if (!nome) return;
  const whatsapp = normalizeWhatsapp(String(form.get('whatsapp') ?? ''));
  const instagram = String(form.get('instagram') ?? '').trim().replace(/^@/, '') || null;
  const { data: last } = await db().from('leads').select('ordem').order('ordem', { ascending: false }).limit(1);
  await db().from('leads').insert({
    nome,
    cidade: String(form.get('cidade') ?? '').trim() || null,
    nicho: String(form.get('nicho') ?? 'outro'),
    whatsapp,
    whatsapp_confirmado: !!whatsapp,
    instagram,
    ordem: (last?.[0]?.ordem ?? 0) + 1,
  });
  refresh();
}

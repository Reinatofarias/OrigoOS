'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkPassword, createSessionToken, isLoginConfigured, requireAuth, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth';
import { db, type Charge, type LeadStatus, type Prioridade, type TaskStatus } from '@/lib/db';
import { addDays, monthRange, today } from '@/lib/dates';
import { ESPERA, NICHO, normalizeWhatsapp, type Passo } from '@/lib/prospeccao';

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

function texto(form: FormData, campo: string) {
  const v = String(form.get(campo) ?? '').trim();
  return v || null;
}

function numero(form: FormData, campo: string) {
  const raw = String(form.get(campo) ?? '').trim();
  if (!raw) return null;
  // Aceita "2.000,50", "2000,50" e "2000.50".
  const n = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
  return Number.isFinite(n) ? n : null;
}

// Tarefas

export async function addTask(form: FormData) {
  await requireAuth();
  const titulo = texto(form, 'titulo');
  if (!titulo) return;
  const quando = String(form.get('quando') ?? '');
  const data = quando === 'hoje' ? today() : quando === 'amanha' ? addDays(today(), 1) : quando === 'sem' ? null : texto(form, 'data');
  const status = (texto(form, 'status') ?? 'todo') as TaskStatus;
  await db()
    .from('tasks')
    .insert({
      titulo,
      data,
      status,
      feita: status === 'done',
      feita_em: status === 'done' ? new Date().toISOString() : null,
      client_id: texto(form, 'client_id'),
      prioridade: (texto(form, 'prioridade') ?? 'normal') as Prioridade,
    });
  refresh();
}

export async function updateTask(
  id: string,
  campos: Partial<{ titulo: string; data: string | null; client_id: string | null; prioridade: Prioridade; status: TaskStatus; descricao: string | null }>,
) {
  await requireAuth();
  const extra =
    campos.status === undefined
      ? {}
      : { feita: campos.status === 'done', feita_em: campos.status === 'done' ? new Date().toISOString() : null };
  await db().from('tasks').update({ ...campos, ...extra }).eq('id', id);
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

// Comercial

const agora = () => new Date().toISOString();

export async function markSent(id: string, passo: Passo) {
  await requireAuth();
  const espera = ESPERA[passo];
  await db()
    .from('leads')
    .update({ status: passo, proxima_acao: espera ? addDays(today(), espera) : null, updated_at: agora() })
    .eq('id', id);
  refresh();
}

export async function setLeadStatus(id: string, status: LeadStatus) {
  await requireAuth();
  const espera = ESPERA[status as Passo];
  const proxima_acao =
    status === 'respondeu' || status === 'call' || status === 'proposta'
      ? today()
      : espera
        ? addDays(today(), espera)
        : null;
  await db().from('leads').update({ status, proxima_acao, updated_at: agora() }).eq('id', id);
  refresh();
}

export async function updateLead(
  id: string,
  campos: Partial<{ notas: string | null; valor: number; contato: string | null; proxima_acao: string | null; cidade: string | null }>,
) {
  await requireAuth();
  await db().from('leads').update({ ...campos, updated_at: agora() }).eq('id', id);
  refresh();
}

export async function addLead(form: FormData) {
  await requireAuth();
  const nome = texto(form, 'nome');
  if (!nome) return;
  const whatsapp = normalizeWhatsapp(String(form.get('whatsapp') ?? ''));
  const instagram = texto(form, 'instagram')?.replace(/^@/, '') ?? null;
  const { data: last } = await db().from('leads').select('ordem').order('ordem', { ascending: false }).limit(1);
  await db()
    .from('leads')
    .insert({
      nome,
      cidade: texto(form, 'cidade'),
      contato: texto(form, 'contato'),
      nicho: String(form.get('nicho') ?? 'outro'),
      valor: numero(form, 'valor') ?? 2000,
      whatsapp,
      whatsapp_confirmado: !!whatsapp,
      instagram,
      ordem: (last?.[0]?.ordem ?? 0) + 1,
    });
  refresh();
}

// Negócio ganho vira cliente, já com a mensalidade do negócio.
export async function convertLead(id: string) {
  await requireAuth();
  const { data: lead } = await db().from('leads').select('*').eq('id', id).single();
  if (!lead) return;
  if (lead.client_id) redirect(`/clientes/${lead.client_id}`);
  const { data: cliente } = await db()
    .from('clients')
    .insert({
      nome: lead.nome,
      cidade: lead.cidade,
      segmento: NICHO[lead.nicho as keyof typeof NICHO],
      plataforma: lead.nicho === 'odonto' ? 'google_meta' : 'google',
      mensalidade: lead.valor,
      responsavel: lead.contato,
      telefone: lead.whatsapp,
      inicio: today(),
    })
    .select('id')
    .single();
  if (!cliente) return;
  await db().from('leads').update({ status: 'fechou', client_id: cliente.id, updated_at: agora() }).eq('id', id);
  refresh();
  redirect(`/clientes/${cliente.id}`);
}

// Clientes

function dadosCliente(form: FormData) {
  return {
    nome: texto(form, 'nome') ?? 'Sem nome',
    segmento: texto(form, 'segmento'),
    cidade: texto(form, 'cidade'),
    plataforma: String(form.get('plataforma') ?? 'google'),
    mensalidade: numero(form, 'mensalidade'),
    dia_vencimento: Math.min(28, Math.max(1, numero(form, 'dia_vencimento') ?? 10)),
    responsavel: texto(form, 'responsavel'),
    email: texto(form, 'email'),
    telefone: texto(form, 'telefone'),
    documento: texto(form, 'documento'),
    inicio: texto(form, 'inicio'),
    observacoes: texto(form, 'observacoes'),
  };
}

export async function addClient(form: FormData) {
  await requireAuth();
  const { data } = await db()
    .from('clients')
    .insert({ ...dadosCliente(form), inicio: texto(form, 'inicio') ?? today() })
    .select('id')
    .single();
  refresh();
  if (data) redirect(`/clientes/${data.id}`);
}

export async function saveClient(id: string, form: FormData) {
  await requireAuth();
  await db()
    .from('clients')
    .update({ ...dadosCliente(form), ativo: form.get('ativo') === 'on' })
    .eq('id', id);
  refresh();
}

// Financeiro

export async function addCharge(form: FormData) {
  await requireAuth();
  const client_id = texto(form, 'client_id');
  const valor = numero(form, 'valor');
  const vencimento = texto(form, 'vencimento');
  if (!client_id || !valor || !vencimento) return;
  await db()
    .from('charges')
    .insert({ client_id, valor, vencimento, descricao: texto(form, 'descricao') ?? 'Cobrança avulsa' });
  refresh();
}

export async function setChargeStatus(id: string, status: Charge['status'], forma?: Charge['forma']) {
  await requireAuth();
  await db()
    .from('charges')
    .update({ status, pago_em: status === 'pago' ? today() : null, forma: status === 'pago' ? (forma ?? 'pix') : null })
    .eq('id', id);
  refresh();
}

export async function deleteCharge(id: string) {
  await requireAuth();
  await db().from('charges').delete().eq('id', id);
  refresh();
}

// Cria a mensalidade do mês para cada cliente ativo que ainda não tem.
export async function generateMonthly(ym: string) {
  await requireAuth();
  const { lastDay } = monthRange(ym);
  const { data: clientes } = await db().from('clients').select('id, mensalidade, dia_vencimento').eq('ativo', true).gt('mensalidade', 0);
  const rows = (clientes ?? []).map((c) => ({
    client_id: c.id,
    competencia: ym,
    descricao: `Mensalidade ${ym.slice(5, 7)}/${ym.slice(0, 4)}`,
    valor: c.mensalidade,
    vencimento: `${ym}-${String(Math.min(c.dia_vencimento ?? 10, lastDay)).padStart(2, '0')}`,
  }));
  if (rows.length) await db().from('charges').upsert(rows, { onConflict: 'client_id,competencia', ignoreDuplicates: true });
  refresh();
}

export async function addExpense(form: FormData) {
  await requireAuth();
  const descricao = texto(form, 'descricao');
  const valor = numero(form, 'valor');
  if (!descricao || !valor) return;
  await db()
    .from('expenses')
    .insert({ descricao, valor, categoria: texto(form, 'categoria') ?? 'outros', data: texto(form, 'data') ?? today() });
  refresh();
}

export async function deleteExpense(id: string) {
  await requireAuth();
  await db().from('expenses').delete().eq('id', id);
  refresh();
}

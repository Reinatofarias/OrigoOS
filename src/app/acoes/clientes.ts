'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { today } from '@/lib/dates';
import { PEDIDOS_PADRAO } from '@/lib/pedidos';
import { metaConfigurado, so, sincronizarMeta, somaDoMes } from '@/lib/anuncios';

const refresh = () => revalidatePath('/', 'layout');
const texto = (form: FormData, campo: string) => String(form.get(campo) ?? '').trim() || null;

export async function registrarContato(clientId: string) {
  await requireAuth();
  await db().from('clients').update({ ultimo_contato: today() }).eq('id', clientId);
  refresh();
}

// Contas de anúncio do cliente (pra puxar os números sozinho).
export async function salvarContas(clientId: string, form: FormData) {
  await requireAuth();
  const meta = so(texto(form, 'meta_conta'));
  const google = so(texto(form, 'google_conta'));
  await db()
    .from('clients')
    .update({
      meta_conta: meta || null,
      google_conta: google ? google.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') : null,
      meta_conversoes: texto(form, 'meta_conversoes'),
    })
    .eq('id', clientId);
  refresh();
}

export async function sincronizarAgora() {
  await requireAuth();
  if (!metaConfigurado()) return { erro: 'Falta o META_ACCESS_TOKEN na Vercel.' };
  const r = await sincronizarMeta(db(), 35);
  refresh();
  return { ok: true, ...r };
}

// No editor do relatório: troca os números pelos que vieram do Meta/Google no mês.
export async function puxarNumeros(reportId: string) {
  await requireAuth();
  const supa = db();
  const { data: r } = await supa.from('reports').select('client_id, competencia').eq('id', reportId).maybeSingle();
  if (!r) return { erro: 'Relatório não encontrado.' };
  const soma = await somaDoMes(supa, r.client_id, r.competencia);
  if (!soma.tem) return { erro: 'Ainda não chegou nenhum número das contas de anúncio desse mês.' };
  return { ok: true, numeros: soma.total, plataformas: soma.plataformas };
}

// Pedidos do portal

export async function adicionarPedido(clientId: string, form: FormData) {
  await requireAuth();
  const titulo = texto(form, 'titulo');
  if (!titulo) return;
  const supa = db();
  const { data: last } = await supa.from('client_requests').select('ordem').eq('client_id', clientId).order('ordem', { ascending: false }).limit(1);
  await supa.from('client_requests').insert({ client_id: clientId, titulo, descricao: texto(form, 'descricao'), ordem: (last?.[0]?.ordem ?? 0) + 1 });
  refresh();
}

export async function adicionarPedidosPadrao(clientId: string) {
  await requireAuth();
  const supa = db();
  const { data: existentes } = await supa.from('client_requests').select('titulo').eq('client_id', clientId);
  const ja = new Set((existentes ?? []).map((e) => e.titulo));
  const novos = PEDIDOS_PADRAO.filter((p) => !ja.has(p.titulo)).map((p, i) => ({ client_id: clientId, ...p, ordem: i + 1 }));
  if (novos.length) await supa.from('client_requests').insert(novos);
  refresh();
}

export async function setPedidoStatus(id: string, status: 'pendente' | 'enviado' | 'ok') {
  await requireAuth();
  await db().from('client_requests').update({ status }).eq('id', id);
  refresh();
}

export async function excluirPedido(id: string) {
  await requireAuth();
  await db().from('client_requests').delete().eq('id', id);
  refresh();
}

// Gera um link novo do portal (o antigo para de funcionar).
export async function novoLinkPortal(clientId: string) {
  await requireAuth();
  await db().from('clients').update({ portal_token: randomBytes(16).toString('hex') }).eq('id', clientId);
  refresh();
}

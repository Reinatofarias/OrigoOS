'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { enviarParaTodos } from '@/lib/push';

// Cliente marca, pelo portal, que mandou o que foi pedido.
export async function responderPedido(token: string, pedidoId: string, _: unknown, form: FormData): Promise<{ ok?: boolean; erro?: string } | null> {
  if (!/^[a-f0-9]{32}$/.test(token) || !/^[0-9a-f-]{36}$/.test(pedidoId)) return { erro: 'Link inválido.' };
  const supa = db();
  const { data: cliente } = await supa.from('clients').select('id, nome').eq('portal_token', token).maybeSingle();
  if (!cliente) return { erro: 'Link inválido.' };
  const resposta = String(form.get('resposta') ?? '').trim().slice(0, 2000) || null;
  const { data: pedido } = await supa
    .from('client_requests')
    .update({ status: 'enviado', resposta, respondido_em: new Date().toISOString() })
    .eq('id', pedidoId)
    .eq('client_id', cliente.id)
    .eq('status', 'pendente')
    .select('titulo')
    .maybeSingle();
  if (!pedido) return { erro: 'Esse item já foi marcado.' };
  await enviarParaTodos(supa, { title: `${cliente.nome} mandou: ${pedido.titulo}`, body: resposta ?? 'Marcou como enviado no portal.', url: `/clientes/${cliente.id}?tab=portal` }).catch(() => null);
  revalidatePath(`/portal/${token}`);
  revalidatePath('/', 'layout');
  return { ok: true };
}

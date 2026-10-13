import { timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { camposDoPagamento, type AsaasPayment } from '@/lib/asaas';
import { avisarPagamento } from '@/lib/avisos';

// Webhook do Asaas: quando o cliente paga (ou a cobrança vence, é estornada...), o Asaas avisa aqui
// e a cobrança muda sozinha no Origo OS. O token configurado no Asaas precisa ser igual a ASAAS_WEBHOOK_TOKEN.

function tokenValido(recebido: string | null) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!tokenValido(request.headers.get('asaas-access-token'))) {
    return Response.json({ erro: 'token inválido' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { event?: string; payment?: AsaasPayment } | null;
  const p = body?.payment;
  // Eventos que não são de cobrança: responde 200 pra o Asaas não pausar a fila.
  if (!p?.id) return Response.json({ ok: true });

  const supa = db();
  let { data: ch } = await supa.from('charges').select('id, status').eq('asaas_id', p.id).maybeSingle();
  if (!ch && p.externalReference) {
    ({ data: ch } = await supa.from('charges').select('id, status').eq('id', p.externalReference).maybeSingle());
  }
  if (!ch) return Response.json({ ok: true, ignorado: true });

  const campos = camposDoPagamento(p);
  await supa
    .from('charges')
    .update({ ...campos, asaas_id: p.id, ...(p.invoiceUrl && { asaas_url: p.invoiceUrl }) })
    .eq('id', ch.id);
  // Aviso no celular quando o pagamento cai (uma vez só por cobrança).
  if (campos.status === 'pago' && ch.status !== 'pago') await avisarPagamento(supa, ch.id).catch((e) => console.error('aviso de pagamento:', e));
  revalidatePath('/', 'layout');
  return Response.json({ ok: true });
}

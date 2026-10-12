import { db } from '@/lib/db';
import { today, weekday } from '@/lib/dates';
import { garantirRecorrentes } from '@/lib/modelos';
import { enviarParaTodos, resumoDoDia } from '@/lib/push';
import { cronAutorizado } from '@/lib/cron';

// Chamado pela Vercel Cron às 7h51 (horário de Recife), de segunda a sexta. Ver vercel.json.
export async function GET(request: Request) {
  if (!cronAutorizado(request)) return Response.json({ erro: 'não autorizado' }, { status: 401 });
  const hoje = today();
  if (weekday(hoje) === 0 || weekday(hoje) === 6) return Response.json({ ok: true, pulado: 'fim de semana' });

  const supa = db();
  // No máximo um lembrete por dia, mesmo se o Cron chamar duas vezes.
  const { data: ultimo } = await supa.from('settings').select('valor').eq('chave', 'lembrete_ultimo').maybeSingle();
  if (ultimo?.valor === hoje) return Response.json({ ok: true, pulado: 'já enviado hoje' });
  await supa.from('settings').upsert({ chave: 'lembrete_ultimo', valor: hoje });

  await garantirRecorrentes(supa);
  const r = await enviarParaTodos(supa, await resumoDoDia(supa));
  return Response.json({ ok: true, ...r });
}

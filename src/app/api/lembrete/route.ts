import { db } from '@/lib/db';
import { today, weekday } from '@/lib/dates';
import { cronAutorizado } from '@/lib/cron';
import { avisarResumo } from '@/lib/avisos';

// Chamado pela Vercel Cron às 7h51 (horário de Recife), de segunda a sexta. Ver vercel.json.
// O relógio do Supabase (/api/avisos) também manda o resumo; quem chegar primeiro manda, o outro pula.
export async function GET(request: Request) {
  if (!cronAutorizado(request)) return Response.json({ erro: 'não autorizado' }, { status: 401 });
  const hoje = today();
  if (weekday(hoje) === 0 || weekday(hoje) === 6) return Response.json({ ok: true, pulado: 'fim de semana' });
  const enviado = await avisarResumo(db(), hoje);
  return Response.json({ ok: true, enviado });
}

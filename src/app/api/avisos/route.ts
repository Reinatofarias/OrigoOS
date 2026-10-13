import { db } from '@/lib/db';
import { cronAutorizado } from '@/lib/cron';
import { relogioAutorizado, rodarAvisos } from '@/lib/avisos';

// Chamado de 5 em 5 minutos pelo relógio do Supabase (pg_cron, ver supabase/atualizar-v8.sql).
export const maxDuration = 30;

export async function GET(request: Request) {
  const supa = db();
  if (!cronAutorizado(request) && !(await relogioAutorizado(supa, request))) return Response.json({ erro: 'não autorizado' }, { status: 401 });
  return Response.json({ ok: true, ...(await rodarAvisos(supa)) });
}

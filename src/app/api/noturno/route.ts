import { db } from '@/lib/db';
import { today, weekday } from '@/lib/dates';
import { cronAutorizado } from '@/lib/cron';
import { metaConfigurado, sincronizarMeta } from '@/lib/anuncios';
import { salvarBackup } from '@/lib/backup';
import { rascunhosDoMesPassado } from '@/lib/relatorios-auto';

// Roda toda madrugada (3h de Recife, ver vercel.json): puxa os números do Meta, deixa pronto o rascunho
// do relatório do mês passado de cada cliente e, no domingo, faz o backup.
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronAutorizado(request)) return Response.json({ erro: 'não autorizado' }, { status: 401 });
  const supa = db();
  const hoje = today();
  const resultado: Record<string, unknown> = {};
  if (metaConfigurado()) resultado.meta = await sincronizarMeta(supa);
  resultado.relatorios = await rascunhosDoMesPassado(supa, hoje).catch((e: Error) => ({ erro: e.message || 'falhou' }));
  if (weekday(hoje) === 0 || new URL(request.url).searchParams.has('backup')) {
    resultado.backup = await salvarBackup(supa, hoje).catch((e: Error) => ({ erro: e.message || String(e) || 'falhou' }));
  }
  await supa.from('settings').upsert({ chave: 'noturno_ultimo', valor: { em: new Date().toISOString(), ...resultado } });
  return Response.json({ ok: true, ...resultado });
}

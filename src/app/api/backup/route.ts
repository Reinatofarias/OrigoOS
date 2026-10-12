import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { today } from '@/lib/dates';
import { gerarBackup } from '@/lib/backup';
import { quemPediu, registrar } from '@/lib/seguranca';

// Botão "Baixar backup" em Configurações > Segurança.
export async function GET() {
  if (!(await isAuthenticated())) return Response.json({ erro: 'não autorizado' }, { status: 401 });
  const supa = db();
  const backup = await gerarBackup(supa);
  await registrar(supa, 'backup_baixado', await quemPediu());
  return new Response(JSON.stringify(backup, null, 1), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="origo-os-backup-${today()}.json"`,
      'cache-control': 'no-store',
    },
  });
}

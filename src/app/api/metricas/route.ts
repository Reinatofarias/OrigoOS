import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { receberGoogle, type PacoteGoogle } from '@/lib/anuncios';

// O script do Google Ads (Configurações > Meta e Google) manda os números do dia pra cá.
export async function POST(request: Request) {
  const supa = db();
  const { data } = await supa.from('settings').select('valor').eq('chave', 'integracoes').maybeSingle();
  const esperado = (data?.valor as { google_token?: string } | null)?.google_token;
  const recebido = request.headers.get('x-origo-token') ?? '';
  if (!esperado || recebido.length !== esperado.length || !timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))) {
    return Response.json({ erro: 'token inválido' }, { status: 401 });
  }
  const texto = await request.text();
  if (texto.length > 2_000_000) return Response.json({ erro: 'grande demais' }, { status: 413 });
  let pacote: PacoteGoogle;
  try {
    pacote = JSON.parse(texto);
  } catch {
    return Response.json({ erro: 'JSON inválido' }, { status: 400 });
  }
  const r = await receberGoogle(supa, pacote);
  return Response.json({ ok: true, ...r });
}

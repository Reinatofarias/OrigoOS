import { db } from '@/lib/db';
import { contextoSquad, receberDoSquad, squadAutorizado } from '@/lib/squad';

// Ponte com o Origo Squad (Configurações > Integrações). GET: o que já existe. POST: leads e tarefas novas.
export async function GET(request: Request) {
  const supa = db();
  if (!(await squadAutorizado(supa, request))) return Response.json({ erro: 'token inválido' }, { status: 401 });
  await supa.from('settings').upsert({ chave: 'squad_ultimo', valor: { em: new Date().toISOString() } });
  return Response.json(await contextoSquad(supa));
}

export async function POST(request: Request) {
  const supa = db();
  if (!(await squadAutorizado(supa, request))) return Response.json({ erro: 'token inválido' }, { status: 401 });
  const texto = await request.text();
  if (texto.length > 500_000) return Response.json({ erro: 'grande demais' }, { status: 413 });
  let pacote;
  try {
    pacote = JSON.parse(texto);
  } catch {
    return Response.json({ erro: 'JSON inválido' }, { status: 400 });
  }
  if (!pacote || typeof pacote !== 'object') return Response.json({ erro: 'JSON inválido' }, { status: 400 });
  try {
    const r = await receberDoSquad(supa, pacote);
    await supa.from('settings').upsert({ chave: 'squad_ultimo', valor: { em: new Date().toISOString(), ...r } });
    return Response.json({ ok: true, ...r });
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : 'falhou' }, { status: 500 });
  }
}

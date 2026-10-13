import 'server-only';
import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, today } from './dates';
import type { Task } from './db';
import { saudeDosClientes } from './saude';
import { hora, listarEventos, situacaoAgenda } from './google-agenda';

// Lembrete no celular (Web Push). As chaves VAPID são geradas na primeira vez e ficam guardadas no banco,
// então não precisa configurar nada na Vercel.

type Vapid = { publicKey: string; privateKey: string };

export async function chavesPush(supa: SupabaseClient): Promise<Vapid> {
  const { data } = await supa.from('settings').select('valor').eq('chave', 'vapid').maybeSingle();
  if (data?.valor?.publicKey) return data.valor as Vapid;
  const novas = webpush.generateVAPIDKeys();
  await supa.from('settings').upsert({ chave: 'vapid', valor: novas }, { onConflict: 'chave', ignoreDuplicates: true });
  // Se dois pedidos geraram ao mesmo tempo, vale a que ficou gravada.
  const { data: gravada } = await supa.from('settings').select('valor').eq('chave', 'vapid').single();
  return gravada!.valor as Vapid;
}

// tag: avisos com tags diferentes ficam todos na tela; com a mesma tag, o novo substitui o anterior.
export type Aviso = { title: string; body: string; url: string; tag?: string };

export async function enviarParaTodos(supa: SupabaseClient, aviso: Aviso) {
  const vapid = await chavesPush(supa);
  webpush.setVapidDetails('mailto:contato@origocompany.com.br', vapid.publicKey, vapid.privateKey);
  const { data: subs } = await supa.from('push_subscriptions').select('*');
  let enviados = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(aviso), { TTL: 60 * 60 * 6 });
      enviados++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // Celular desinstalou ou revogou: apaga a inscrição.
      if (status === 404 || status === 410) await supa.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
    }
  }
  return { enviados, total: subs?.length ?? 0 };
}

const PESO = { urgente: 0, alta: 1, normal: 2, baixa: 3 } as const;

// "3 coisas de hoje": as tarefas mais importantes, mais o que tem de prospecção e cobrança.
export async function resumoDoDia(supa: SupabaseClient): Promise<Aviso> {
  const hoje = today();
  const [{ data: ts }, { data: fu }, { data: novos }, { data: ch }] = await Promise.all([
    supa.from('tasks').select('titulo, data, prioridade, status').neq('status', 'done').lte('data', hoje),
    supa.from('leads').select('id').in('status', ['m1', 'm2', 'm3', 'respondeu', 'call', 'proposta']).lte('proxima_acao', hoje),
    supa.from('leads').select('id').eq('status', 'novo').limit(5),
    supa.from('charges').select('vencimento').eq('status', 'pendente').lte('vencimento', addDays(hoje, 1)),
  ]);
  const tarefas = ((ts ?? []) as Pick<Task, 'titulo' | 'data' | 'prioridade'>[]).sort(
    (a, b) => Number(b.data! < hoje) - Number(a.data! < hoje) || PESO[a.prioridade] - PESO[b.prioridade],
  );
  const tres = tarefas.slice(0, 3).map((t, i) => `${i + 1}. ${t.titulo}`);
  const extra: string[] = [];
  const prosp = (fu?.length ?? 0) + (novos?.length ?? 0);
  if (prosp) extra.push(`${prosp} contato${prosp > 1 ? 's' : ''} de prospecção`);
  const vencidas = (ch ?? []).filter((c) => c.vencimento < hoje).length;
  if (vencidas) extra.push(`${vencidas} cobrança${vencidas > 1 ? 's' : ''} vencida${vencidas > 1 ? 's' : ''}`);
  else if (ch?.length) extra.push(`${ch.length} cobrança${ch.length > 1 ? 's' : ''} vencendo`);
  // Agenda do dia (se estiver ligada): quantos compromissos e o primeiro.
  const agenda = await situacaoAgenda(supa).catch(() => null);
  if (agenda?.ve) {
    const evs = (await listarEventos(supa, hoje, hoje).catch(() => [])).filter((e) => !e.diaInteiro && new Date(e.fim).getTime() > Date.now());
    if (evs.length) extra.unshift(`${evs.length} compromisso${evs.length > 1 ? 's' : ''} (${hora(evs[0].inicio)} ${evs[0].titulo})`);
  }
  const risco = (await saudeDosClientes(supa, hoje)).filter((c) => c.nivel === 'risco');
  if (risco.length) extra.push(`${risco.length} cliente${risco.length > 1 ? 's' : ''} em risco: ${risco.map((c) => c.nome).join(', ')}`);
  const corpo = [...(tres.length ? tres : ['Nenhuma tarefa marcada pra hoje.']), ...(extra.length ? [extra.join(' · ')] : [])].join('\n');
  return { title: tarefas.length > 3 ? `Bom dia, Renato! ${tarefas.length} tarefas hoje` : 'Bom dia, Renato! Suas 3 coisas de hoje', body: corpo, url: '/' };
}


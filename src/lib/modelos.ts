import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, today, weekday } from './dates';
import type { Client, TaskTemplate } from './db';

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// O modelo vale pra esse cliente? "google" só pra quem anuncia no Google, "meta" só pra quem anuncia na Meta.
export function serveParaCliente(t: Pick<TaskTemplate, 'plataforma'>, c: Pick<Client, 'plataforma'>) {
  if (t.plataforma === 'todas') return true;
  return c.plataforma === 'google_meta' || c.plataforma === t.plataforma;
}

export function caiNoDia(t: TaskTemplate, iso: string) {
  if (t.frequencia === 'mensal') {
    // Dia do mês; se cair no fim de semana, passa pra segunda.
    const alvo = `${iso.slice(0, 8)}${String(t.dia_mes ?? 1).padStart(2, '0')}`;
    const wd = weekday(alvo);
    const util = wd === 6 ? addDays(alvo, 2) : wd === 0 ? addDays(alvo, 1) : alvo;
    return util === iso;
  }
  return weekday(iso) === t.dia_semana;
}

export function quandoRepete(t: TaskTemplate) {
  return t.frequencia === 'mensal' ? `Todo dia ${t.dia_mes ?? 1} do mês` : `Toda ${DIAS_SEMANA[t.dia_semana ?? 1].toLowerCase()}`;
}

// Cria as tarefas de onboarding de um cliente novo, contando os dias a partir do início.
export async function criarOnboarding(supa: SupabaseClient, cliente: Pick<Client, 'id' | 'plataforma' | 'inicio'>) {
  const { data } = await supa.from('task_templates').select('*').eq('tipo', 'onboarding').eq('ativo', true).order('ordem');
  const inicio = cliente.inicio ?? today();
  const rows = ((data ?? []) as TaskTemplate[])
    .filter((t) => serveParaCliente(t, cliente))
    .map((t) => ({
      titulo: t.titulo,
      descricao: t.descricao,
      prioridade: t.prioridade,
      data: addDays(inicio, t.dias),
      client_id: cliente.id,
      origem: 'onboarding',
      template_id: t.id,
    }));
  if (rows.length) await supa.from('tasks').insert(rows);
  return rows.length;
}

// Garante as tarefas recorrentes desta semana até daqui a 7 dias, pra cada cliente ativo.
// O registro em task_runs impede duplicar, e uma tarefa apagada não volta.
export async function garantirRecorrentes(supa: SupabaseClient) {
  const hoje = today();
  const wd = weekday(hoje);
  const de = addDays(hoje, wd === 0 ? -6 : 1 - wd); // segunda desta semana
  const ate = addDays(hoje, 7);
  const [{ data: ts, error }, { data: cs }] = await Promise.all([
    supa.from('task_templates').select('*').eq('tipo', 'recorrente').eq('ativo', true),
    supa.from('clients').select('id, plataforma, inicio').eq('ativo', true).eq('recorrentes', true),
  ]);
  if (error || !ts?.length || !cs?.length) return;
  const modelos = ts as TaskTemplate[];
  const dias: string[] = [];
  for (let d = de; d <= ate; d = addDays(d, 1)) dias.push(d);

  const runs: { template_id: string; client_id: string; data: string }[] = [];
  for (const c of cs as Pick<Client, 'id' | 'plataforma' | 'inicio'>[]) {
    for (const t of modelos) {
      if (!serveParaCliente(t, c)) continue;
      for (const d of dias) if (caiNoDia(t, d) && (!c.inicio || d >= c.inicio)) runs.push({ template_id: t.id, client_id: c.id, data: d });
    }
  }
  if (!runs.length) return;
  const { data: novos } = await supa
    .from('task_runs')
    .upsert(runs, { onConflict: 'template_id,client_id,data', ignoreDuplicates: true })
    .select();
  if (!novos?.length) return;
  const porId = Object.fromEntries(modelos.map((t) => [t.id, t]));
  await supa.from('tasks').insert(
    novos.map((r) => ({
      titulo: porId[r.template_id].titulo,
      descricao: porId[r.template_id].descricao,
      prioridade: porId[r.template_id].prioridade,
      data: r.data,
      client_id: r.client_id,
      origem: 'recorrente',
      template_id: r.template_id,
    })),
  );
}

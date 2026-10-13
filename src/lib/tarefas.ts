import type { Prioridade, TaskStatus } from '@/lib/db';
import type { SupabaseClient } from '@supabase/supabase-js';

export const STATUS: Record<TaskStatus, { label: string; cor: string }> = {
  todo: { label: 'A fazer', cor: '#87909e' },
  doing: { label: 'Em andamento', cor: '#5b5bff' },
  done: { label: 'Concluído', cor: '#0f9a64' },
};

export const PRIORIDADE: Record<Prioridade, { label: string; cor: string }> = {
  urgente: { label: 'Urgente', cor: '#dc3a40' },
  alta: { label: 'Alta', cor: '#e0a100' },
  normal: { label: 'Normal', cor: '#3a6bff' },
  baixa: { label: 'Baixa', cor: '#9a9cb5' },
};

// Progresso das subtarefas e quantidade de comentários, para mostrar na lista.
export type ResumoTarefa = { itens: number; feitos: number; comentarios: number };

// Busca os resumos de várias tarefas de uma vez. Sem as tabelas da v6, volta vazio.
export async function resumosDas(supa: SupabaseClient, ids: string[]): Promise<Record<string, ResumoTarefa>> {
  const resumos: Record<string, ResumoTarefa> = {};
  if (!ids.length) return resumos;
  // Em blocos, para a URL da consulta não ficar grande demais.
  const blocos = Array.from({ length: Math.ceil(ids.length / 150) }, (_, i) => ids.slice(i * 150, i * 150 + 150));
  const respostas = await Promise.all(
    blocos.flatMap((b) => [
      supa.from('task_items').select('task_id, feita').in('task_id', b),
      supa.from('task_comments').select('task_id').eq('tipo', 'comentario').in('task_id', b),
    ]),
  );
  const itens = respostas.filter((_, i) => i % 2 === 0).flatMap((r) => r.data ?? []);
  const comentarios = respostas.filter((_, i) => i % 2 === 1).flatMap((r) => r.data ?? []);
  const de = (id: string) => (resumos[id] ??= { itens: 0, feitos: 0, comentarios: 0 });
  for (const i of itens as { task_id: string; feita: boolean }[]) {
    de(i.task_id).itens++;
    if (i.feita) de(i.task_id).feitos++;
  }
  for (const c of comentarios as { task_id: string }[]) de(c.task_id).comentarios++;
  return resumos;
}

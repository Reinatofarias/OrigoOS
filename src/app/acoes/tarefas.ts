'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

// Detalhes da tarefa: subtarefas (checklist) e comentários.

function refresh() {
  revalidatePath('/', 'layout');
}

export async function addItem(taskId: string, titulo: string) {
  await requireAuth();
  const t = titulo.trim().slice(0, 300);
  if (!t) return;
  const { data: ultimo } = await db().from('task_items').select('ordem').eq('task_id', taskId).order('ordem', { ascending: false }).limit(1).maybeSingle();
  await db().from('task_items').insert({ task_id: taskId, titulo: t, ordem: (ultimo?.ordem ?? -1) + 1 });
  refresh();
}

export async function updateItem(id: string, campos: Partial<{ titulo: string; feita: boolean }>) {
  await requireAuth();
  const c = { ...campos, ...(campos.titulo !== undefined && { titulo: campos.titulo.trim().slice(0, 300) }) };
  if (c.titulo === '') return;
  await db().from('task_items').update(c).eq('id', id);
  refresh();
}

export async function deleteItem(id: string) {
  await requireAuth();
  await db().from('task_items').delete().eq('id', id);
  refresh();
}

export async function addComment(taskId: string, texto: string) {
  await requireAuth();
  const t = texto.trim().slice(0, 5000);
  if (!t) return;
  await db().from('task_comments').insert({ task_id: taskId, texto: t, tipo: 'comentario' });
  refresh();
}

export async function deleteComment(id: string) {
  await requireAuth();
  await db().from('task_comments').delete().eq('id', id).eq('tipo', 'comentario');
  refresh();
}

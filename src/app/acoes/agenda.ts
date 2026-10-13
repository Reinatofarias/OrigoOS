'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatShort } from '@/lib/dates';
import { criarEvento, desconectar, excluirEvento } from '@/lib/google-agenda';

// Google Agenda: criar e apagar compromissos e desconectar a conta.

export type Resultado = { erro?: string; link?: string | null } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function novoCompromisso(fd: FormData): Promise<Resultado> {
  await requireAuth();
  const titulo = String(fd.get('titulo') ?? '').trim().slice(0, 200);
  const dia = String(fd.get('dia') ?? '');
  const hora = String(fd.get('hora') ?? '').trim() || null;
  const minutos = Math.min(Math.max(Number(fd.get('minutos')) || 60, 5), 24 * 60);
  const meet = fd.get('meet') === 'on';
  const taskId = String(fd.get('task_id') ?? '') || null;
  const convidados = String(fd.get('convidados') ?? '')
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  if (!titulo) return { erro: 'Coloque um título.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { erro: 'Escolha o dia.' };
  if (hora && !/^\d{2}:\d{2}$/.test(hora)) return { erro: 'Hora inválida.' };
  const invalido = convidados.find((e) => !EMAIL.test(e));
  if (invalido) return { erro: `E-mail inválido: ${invalido}` };

  const supa = db();
  try {
    const ev = await criarEvento(supa, {
      titulo,
      dia,
      hora,
      minutos,
      meet,
      convidados,
      descricao: String(fd.get('descricao') ?? '').trim().slice(0, 5000) || null,
      local: String(fd.get('local') ?? '').trim().slice(0, 300) || null,
    });
    if (taskId) {
      const quando = `${formatShort(dia)}${hora ? ` às ${hora}` : ''}`;
      await supa.from('task_comments').insert({ task_id: taskId, tipo: 'atividade', texto: `Agendou no Google Agenda: ${quando}${ev.meet ? ' (com Meet)' : ''}` });
      if (fd.get('prazo') === 'on') await supa.from('tasks').update({ data: dia }).eq('id', taskId);
    }
    revalidatePath('/', 'layout');
    return { link: ev.meet ?? ev.link };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'Não consegui criar o evento.' };
  }
}

export async function apagarCompromisso(id: string): Promise<Resultado> {
  await requireAuth();
  try {
    await excluirEvento(db(), id);
    revalidatePath('/', 'layout');
    return null;
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'Não consegui apagar o evento.' };
  }
}

export async function desconectarAgenda() {
  await requireAuth();
  await desconectar(db());
  revalidatePath('/', 'layout');
}

// Modo iCal: o compromisso é salvo no próprio Google Agenda; aqui só fica o registro na tarefa.
export async function registrarAgendamento(taskId: string, dia: string, hora: string | null, usarComoPrazo: boolean) {
  await requireAuth();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return;
  const supa = db();
  await supa.from('task_comments').insert({ task_id: taskId, tipo: 'atividade', texto: `Abriu no Google Agenda: ${formatShort(dia)}${hora && /^\d{2}:\d{2}$/.test(hora) ? ` às ${hora}` : ''}` });
  if (usarComoPrazo) await supa.from('tasks').update({ data: dia }).eq('id', taskId);
  revalidatePath('/', 'layout');
}

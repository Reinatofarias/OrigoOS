'use client';

import { useTransition } from 'react';
import { Trash2, ArrowRight } from 'lucide-react';
import { deleteTask, moveTask, toggleTask } from '@/app/actions';
import type { Task } from '@/lib/db';

export default function TaskItem({ task, amanha, atrasada }: { task: Task; amanha: string; atrasada?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <li className={`flex items-center gap-3 py-2 ${pending ? 'opacity-50' : ''}`}>
      <input
        id={`t-${task.id}`}
        type="checkbox"
        checked={task.feita}
        onChange={(e) => start(() => toggleTask(task.id, e.target.checked))}
        className="size-5 accent-[var(--accent)]"
      />
      <label htmlFor={`t-${task.id}`} className={`min-w-0 flex-1 ${task.feita ? 'text-muted line-through' : ''}`}>
        {task.titulo}
        {atrasada && <span className="ml-2 rounded bg-warn-soft px-1.5 py-0.5 text-xs font-semibold text-warn">atrasada</span>}
      </label>
      {!task.feita && (
        <button
          type="button"
          title="Passar para amanhã"
          aria-label="Passar para amanhã"
          onClick={() => start(() => moveTask(task.id, amanha))}
          className="text-muted"
        >
          <ArrowRight size={18} />
        </button>
      )}
      <button type="button" title="Apagar" aria-label="Apagar" onClick={() => start(() => deleteTask(task.id))} className="text-muted">
        <Trash2 size={18} />
      </button>
    </li>
  );
}

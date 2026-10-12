'use client';

import { useRef } from 'react';
import { addTask } from '@/app/actions';

export default function QuickAdd() {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      action={async (data) => {
        await addTask(data);
        form.current?.reset();
      }}
      className="flex flex-wrap gap-2"
    >
      <label htmlFor="nova-tarefa" className="sr-only">
        Nova tarefa
      </label>
      <input
        id="nova-tarefa"
        name="titulo"
        placeholder="Jogar uma tarefa aqui…"
        required
        className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-base"
      />
      <select name="quando" aria-label="Quando" className="rounded-xl border border-line bg-surface px-3 py-3 text-sm">
        <option value="hoje">Hoje</option>
        <option value="amanha">Amanhã</option>
        <option value="sem">Sem data</option>
      </select>
      <button className="rounded-xl bg-accent px-4 py-3 font-semibold text-accent-ink">Adicionar</button>
    </form>
  );
}

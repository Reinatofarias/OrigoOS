'use client';

import { useTransition } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import { deleteExpense, generateMonthly } from '@/app/actions';
import { btn } from '@/components/ui';

export function GenerateButton({ ym, faltam }: { ym: string; faltam: number }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => generateMonthly(ym))} className={btn.primary}>
      <Sparkles size={15} /> {pending ? 'Gerando…' : `Gerar ${faltam} mensalidade${faltam > 1 ? 's' : ''}`}
    </button>
  );
}

export function DeleteExpense({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => confirm('Apagar esta despesa?') && start(() => deleteExpense(id))}
      aria-label="Apagar despesa"
      className="rounded-md p-1.5 text-faint opacity-0 hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
    >
      <Trash2 size={14} />
    </button>
  );
}

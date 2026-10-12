'use client';

import { useOptimistic, useTransition } from 'react';
import { Check } from 'lucide-react';
import { toggleRoutine } from '@/app/actions';

export default function RoutineToggle({ clientId, tipo, label, feito, sub }: { clientId: string; tipo: string; label: string; feito: boolean; sub?: string }) {
  const [otimista, setOtimista] = useOptimistic(feito);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          setOtimista(!otimista);
          await toggleRoutine(clientId, tipo, !otimista);
        })
      }
      aria-pressed={otimista}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2"
    >
      <span
        className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] ${otimista ? 'border-success bg-success text-white' : 'border-faint'}`}
      >
        {otimista && <Check size={12} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className={`block truncate text-[13.5px] font-medium ${otimista ? 'text-muted line-through' : ''}`}>{label}</span>
        {sub && <span className="block truncate text-[12px] text-muted">{sub}</span>}
      </span>
    </button>
  );
}

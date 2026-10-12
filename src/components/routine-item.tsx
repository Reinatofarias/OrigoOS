'use client';

import { useTransition } from 'react';
import { toggleRoutine } from '@/app/actions';

export default function RoutineItem({ clientId, tipo, label, feita }: { clientId: string; tipo: string; label: string; feita: boolean }) {
  const [pending, start] = useTransition();
  const id = `r-${clientId}-${tipo}`;
  return (
    <li className={`flex items-center gap-3 py-2 ${pending ? 'opacity-50' : ''}`}>
      <input
        id={id}
        type="checkbox"
        checked={feita}
        onChange={(e) => start(() => toggleRoutine(clientId, tipo, e.target.checked))}
        className="size-5 accent-[var(--accent)]"
      />
      <label htmlFor={id} className={feita ? 'text-muted line-through' : ''}>
        {label}
      </label>
    </li>
  );
}

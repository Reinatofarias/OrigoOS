'use client';

import { LogOut } from 'lucide-react';
import { btn } from './ui';

export function SairDeTodos({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action} onSubmit={(e) => !confirm('Sair de todos os aparelhos, inclusive deste? Você vai precisar entrar de novo.') && e.preventDefault()}>
      <button className={btn.ghost}>
        <LogOut size={14} /> Sair de todos os aparelhos
      </button>
    </form>
  );
}

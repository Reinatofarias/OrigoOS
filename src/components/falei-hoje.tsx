'use client';

import { useState, useTransition } from 'react';
import { MessageSquareCheck } from 'lucide-react';
import { registrarContato } from '@/app/acoes/clientes';

// "Falei com ele hoje" direto no card de Saúde dos clientes, sem abrir a ficha.
export function FaleiHoje({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition();
  const [feito, setFeito] = useState(false);
  return (
    <button
      type="button"
      disabled={pending || feito}
      onClick={() =>
        start(async () => {
          await registrarContato(clientId);
          setFeito(true);
        })
      }
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold text-brand transition hover:bg-brand-soft disabled:text-success disabled:hover:bg-transparent"
    >
      <MessageSquareCheck size={13} />
      {feito ? 'Contato anotado' : pending ? 'Anotando…' : 'Falei com ele hoje'}
    </button>
  );
}

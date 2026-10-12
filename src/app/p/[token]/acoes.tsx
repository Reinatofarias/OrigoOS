'use client';

import { useEffect, useTransition } from 'react';
import { Check, Download } from 'lucide-react';
import { aceitarProposta } from '@/app/actions';

export function ImprimirBotao({ auto }: { auto?: boolean }) {
  useEffect(() => {
    if (auto) setTimeout(() => window.print(), 400);
  }, [auto]);
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl border border-[#d9dbe8] bg-white px-4 py-3 text-[14px] font-semibold text-[#14152e] hover:bg-[#f5f6fa]"
    >
      <Download size={16} /> Baixar PDF
    </button>
  );
}

export function AceitarBotao({ token }: { token: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => confirm('Confirmar o aceite desta proposta?') && start(() => aceitarProposta(token))}
      className="bg-grad inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold text-white shadow-lg disabled:opacity-60"
    >
      <Check size={16} /> {pending ? 'Enviando…' : 'Aceitar proposta'}
    </button>
  );
}

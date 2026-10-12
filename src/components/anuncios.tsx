'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { sincronizarAgora } from '@/app/acoes/clientes';
import { btn } from './ui';

export function SincronizarMeta() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await sincronizarAgora();
            setMsg(r.erro ?? (r.erros?.length ? `Puxei ${r.dias} dias. Problemas: ${r.erros.join(' · ')}` : `Pronto: ${r.dias} dias de ${r.contas} conta(s) do Meta.`));
          })
        }
        className={btn.secondary}
      >
        <RefreshCw size={14} className={pending ? 'animate-spin' : ''} /> {pending ? 'Puxando…' : 'Puxar do Meta agora'}
      </button>
      {msg && <span className="text-[12.5px] text-muted">{msg}</span>}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { avisar, Check } from './toast';

// Botão de enviar de formulário com retorno: "Salvando…" com rodinha e, ao terminar,
// fica verde com um check por um instante e sobe o aviso no rodapé.
export function SalvarBotao({ children, className, aviso = 'Alterações salvas' }: { children: React.ReactNode; className: string; aviso?: string | false }) {
  const { pending } = useFormStatus();
  const [ok, setOk] = useState(false);
  const antes = useRef(false);
  useEffect(() => {
    if (antes.current && !pending) {
      setOk(true);
      if (aviso) avisar(aviso);
      const t = setTimeout(() => setOk(false), 1800);
      antes.current = pending;
      return () => clearTimeout(t);
    }
    antes.current = pending;
  }, [pending, aviso]);
  return (
    <button disabled={pending} className={`${className} relative transition-all ${ok ? '!bg-success !text-white !border-success' : ''}`}>
      {pending ? (
        <>
          <Rodinha /> Salvando…
        </>
      ) : ok ? (
        <span className="animate-pop inline-flex items-center gap-1.5">
          <Check size={16} /> Salvo
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export function Rodinha() {
  return <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80" />;
}

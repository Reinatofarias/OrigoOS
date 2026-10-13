'use client';

import { useEffect, useState } from 'react';

type Aviso = { id: number; texto: string; tipo: 'ok' | 'erro' };
const EVENTO = 'origo-aviso';

// Avisinho que sobe no rodapé ("Alterações salvas ✓"). Pode ser chamado de qualquer componente do cliente.
export function avisar(texto: string, tipo: Aviso['tipo'] = 'ok') {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { texto, tipo } }));
}

export function Avisos() {
  const [lista, setLista] = useState<Aviso[]>([]);
  useEffect(() => {
    let id = 0;
    const novo = (e: Event) => {
      const { texto, tipo } = (e as CustomEvent<Omit<Aviso, 'id'>>).detail;
      const a = { id: ++id, texto, tipo };
      setLista((l) => [...l.filter((x) => x.texto !== texto), a].slice(-3));
      setTimeout(() => setLista((l) => l.filter((x) => x.id !== a.id)), 2600);
    };
    window.addEventListener(EVENTO, novo);
    return () => window.removeEventListener(EVENTO, novo);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-8 md:pl-60">
      {lista.map((a) => (
        <div
          key={a.id}
          className={`animate-aviso flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-[13.5px] font-semibold shadow-xl backdrop-blur-xl ${
            a.tipo === 'ok' ? 'border-success/25 bg-surface/90 text-ink' : 'border-danger/30 bg-danger-soft text-danger'
          }`}
        >
          {a.tipo === 'ok' ? <Check /> : <span aria-hidden>!</span>}
          {a.texto}
        </div>
      ))}
    </div>
  );
}

// Check que "se desenha" (o traço anima de 0 até completo).
export function Check({ size = 18 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-success text-white" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size * 0.7} height={size * 0.7} fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12.5l4.5 4.5L19 7.5" className="animate-traco" pathLength={1} />
      </svg>
    </span>
  );
}

'use client';

import { useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

export type Tema = 'auto' | 'claro' | 'escuro';
const CHAVE = 'origo-tema';
const EVENTO = 'origo-tema';

// Roda no <head> antes da tela aparecer, pra não piscar claro antes de ficar escuro.
export const SCRIPT_TEMA = `try{var t=localStorage.getItem('${CHAVE}');if(t==='claro'||t==='escuro')document.documentElement.dataset.tema=t}catch(e){}`;

function ler(): Tema {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === 'claro' || t === 'escuro' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

function assinar(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener('storage', cb);
  };
}

function aplicar(t: Tema) {
  try {
    if (t === 'auto') localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, t);
  } catch {}
  if (t === 'auto') delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = t;
  window.dispatchEvent(new Event(EVENTO));
}

const OPCOES: { v: Tema; label: string; icon: typeof Sun }[] = [
  { v: 'auto', label: 'Automático', icon: Monitor },
  { v: 'claro', label: 'Claro', icon: Sun },
  { v: 'escuro', label: 'Escuro', icon: Moon },
];

// Escolha de aparência. "compacto" = só ícones (menu lateral escuro); senão, ícone + nome.
export function EscolhaTema({ compacto, escuro }: { compacto?: boolean; escuro?: boolean }) {
  const atual = useSyncExternalStore(assinar, ler, () => 'auto' as Tema);
  const base = escuro ? 'bg-white/[0.05] border-white/10' : 'bg-surface-2 border-line';
  const on = escuro ? 'bg-white/15 text-white' : 'bg-surface text-ink shadow-sm';
  const off = escuro ? 'text-sidebar-ink hover:text-white' : 'text-muted hover:text-ink';
  return (
    <div role="radiogroup" aria-label="Aparência" className={`grid grid-cols-3 gap-0.5 rounded-lg border p-0.5 ${base}`}>
      {OPCOES.map(({ v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={atual === v}
          title={label}
          aria-label={label}
          onClick={() => aplicar(v)}
          className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition ${atual === v ? on : off}`}
        >
          <Icon size={15} strokeWidth={1.9} />
          {!compacto && label}
        </button>
      ))}
    </div>
  );
}

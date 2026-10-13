'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, FileSignature, KanbanSquare, ListChecks, Search, CornerDownLeft, Compass } from 'lucide-react';
import { buscar, type ResultadoBusca } from '@/app/acoes/busca';

const PAGINAS: ResultadoBusca[] = [
  ['Início', '/'],
  ['Tarefas', '/tarefas'],
  ['Agenda', '/agenda'],
  ['Comercial', '/comercial'],
  ['Clientes', '/clientes'],
  ['Contratos', '/contratos'],
  ['Novo contrato', '/contratos/novo'],
  ['Financeiro', '/financeiro'],
  ['Metas', '/metas'],
  ['Configurações', '/configuracoes'],
].map(([titulo, href]) => ({ tipo: 'pagina' as const, titulo, sub: 'Ir para', href }));

const ICONE = { cliente: Building2, tarefa: ListChecks, lead: KanbanSquare, contrato: FileSignature } as const;
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Busca rápida: Ctrl+K (ou ⌘K) em qualquer tela, ou pelo botão de lupa.
export function Busca({ aberta, setAberta }: { aberta: boolean; setAberta: (v: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [itens, setItens] = useState<ResultadoBusca[]>([]);
  const [sel, setSel] = useState(0);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAberta(!aberta);
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberta, setAberta]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => start(async () => setItens(await buscar(q))), 180);
    return () => clearTimeout(t);
  }, [q]);

  const paginas = q.trim() ? PAGINAS.filter((p) => sem(p.titulo).includes(sem(q.trim()))) : PAGINAS.slice(0, 6);
  const lista = [...paginas, ...(q.trim().length >= 2 ? itens : [])];

  function fechar() {
    setAberta(false);
    setQ('');
    setItens([]);
    setSel(0);
  }
  function ir(r?: ResultadoBusca) {
    if (!r) return;
    fechar();
    router.push(r.href);
  }

  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-[rgb(10_11_26/0.4)] px-3 pt-[12vh] backdrop-blur-[6px]" onClick={fechar}>
      <div
        role="dialog"
        aria-label="Busca rápida"
        onClick={(e) => e.stopPropagation()}
        className="animate-subir mx-auto w-full max-w-[560px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') fechar();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, lista.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === 'Enter') ir(lista[sel]);
            }}
            placeholder="Buscar cliente, tarefa, lead ou contrato…"
            aria-label="Buscar"
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
            style={{ outline: 'none' }}
          />
          {pending && <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-brand" aria-hidden />}
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[11px] text-muted sm:block">Esc</kbd>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto p-1.5">
          {lista.map((r, i) => {
            const Icon = r.tipo in ICONE ? ICONE[r.tipo as keyof typeof ICONE] : Compass;
            return (
              <li key={`${r.tipo}-${r.href}`}>
                <button
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => ir(r)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${i === sel ? 'bg-brand-soft' : ''}`}
                >
                  <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${i === sel ? 'bg-surface text-brand' : 'bg-surface-2 text-muted'}`}>
                    <Icon size={16} strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{r.titulo}</span>
                    {r.sub && <span className="block truncate text-[12px] text-muted">{r.sub}</span>}
                  </span>
                  {i === sel && <CornerDownLeft size={14} className="shrink-0 text-muted" />}
                </button>
              </li>
            );
          })}
          {q.trim().length >= 2 && !pending && !itens.length && !paginas.length && <li className="px-3 py-6 text-center text-[13px] text-muted">Nada encontrado pra &quot;{q.trim()}&quot;.</li>}
        </ul>
      </div>
    </div>
  );
}

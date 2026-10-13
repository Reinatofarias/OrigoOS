'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, CalendarDays, KanbanSquare, Building2, FileSignature, Wallet, LogOut, Activity, Target, Settings, LayoutGrid, X, Search } from 'lucide-react';
import { logout } from '@/app/actions';
import { Logo } from './logo';
import { EscolhaTema } from './tema';
import { Busca } from './busca';

const LINKS = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/tarefas', label: 'Tarefas', icon: ListChecks },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/comercial', label: 'Comercial', icon: KanbanSquare },
  { href: '/clientes', label: 'Clientes', icon: Building2 },
  { href: '/contratos', label: 'Contratos', icon: FileSignature },
  { href: '/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/metas', label: 'Metas', icon: Target },
];

// Celular: os 4 do dia a dia ficam na barra de baixo; o resto abre no botão "Mais".
const NO_CELULAR = ['/', '/tarefas', '/agenda', '/clientes'];
const MAIS = [
  ...LINKS.filter((l) => !NO_CELULAR.includes(l.href)),
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
  { href: '/status', label: 'Status', icon: Activity },
];

function ativo(path: string, href: string) {
  return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
}

export default function Sidebar() {
  const path = usePathname();
  const [mais, setMais] = useState(false);
  const [busca, setBusca] = useState(false);
  const maisAtivo = MAIS.some((l) => ativo(path, l.href));
  const item = 'flex min-w-0 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted transition aria-[current=page]:text-brand';
  return (
    <>
      {/* Desktop: menu lateral escuro */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar px-3 py-5 md:flex">
        <div className="px-2">
          <Logo height={40} />
        </div>
        <button
          type="button"
          onClick={() => setBusca(true)}
          className="mt-6 flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-sidebar-ink transition hover:bg-white/[0.08] hover:text-white"
        >
          <Search size={15} />
          <span className="flex-1 text-left">Buscar</span>
          <kbd className="rounded border border-white/15 px-1.5 text-[10.5px]">Ctrl K</kbd>
        </button>
        <p className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-ink/60">Workspace</p>
        <nav className="mt-2 grid gap-0.5" aria-label="Principal">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={ativo(path, href) ? 'page' : undefined}
              className="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium text-sidebar-ink transition hover:bg-sidebar-hover hover:text-white aria-[current=page]:bg-sidebar-hover aria-[current=page]:text-white"
            >
              <span className="bg-grad absolute inset-y-1.5 left-0 hidden w-[3px] rounded-full group-aria-[current=page]:block" />
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-2.5">
              <span className="bg-grad grid size-8 place-items-center rounded-full text-[13px] font-bold text-white">R</span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13px] font-semibold text-white">Renato Farias</p>
                <p className="truncate text-[12px] text-sidebar-ink">Origo Company</p>
              </div>
            </div>
          </div>
          <EscolhaTema compacto escuro />
          <div className="grid">
            <Link href="/configuracoes" aria-current={ativo(path, '/configuracoes') ? 'page' : undefined} className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-sidebar-ink hover:bg-sidebar-hover hover:text-white aria-[current=page]:text-white">
              <Settings size={16} /> Configurações
            </Link>
            <Link href="/status" className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-sidebar-ink hover:bg-sidebar-hover hover:text-white">
              <Activity size={16} /> Status da conexão
            </Link>
          </div>
          <form action={logout} className="-mt-3">
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-sidebar-ink hover:bg-sidebar-hover hover:text-white">
              <LogOut size={16} /> Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Celular: barra de cima só com a marca; módulos na barra de baixo */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 md:hidden">
        <Logo height={28} />
        <button type="button" onClick={() => setBusca(true)} className="rounded-lg p-2 text-sidebar-ink" aria-label="Buscar">
          <Search size={19} />
        </button>
      </header>
      <Busca aberta={busca} setAberta={setBusca} />

      {mais && (
        <div className="fixed inset-0 z-[45] bg-[rgb(10_11_26/0.35)] backdrop-blur-[3px] md:hidden" onClick={() => setMais(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-subir absolute inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] rounded-2xl border border-line/60 bg-surface/80 p-2 shadow-2xl backdrop-blur-xl"
          >
            <div className="grid grid-cols-3 gap-1">
              {MAIS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMais(false)}
                  aria-current={ativo(path, href) ? 'page' : undefined}
                  className="flex flex-col items-center gap-1.5 rounded-xl py-3 text-[12px] font-medium text-ink transition hover:bg-surface-2 aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand"
                >
                  <Icon size={20} strokeWidth={1.8} />
                  {label}
                </Link>
              ))}
              <form action={logout}>
                <button className="flex w-full flex-col items-center gap-1.5 rounded-xl py-3 text-[12px] font-medium text-danger transition hover:bg-surface-2">
                  <LogOut size={20} strokeWidth={1.8} />
                  Sair
                </button>
              </form>
            </div>
            <div className="mt-2 border-t border-line/60 px-1 pt-2">
              <EscolhaTema />
            </div>
          </div>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-[46] grid grid-cols-5 border-t border-line/70 bg-surface/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        aria-label="Principal"
      >
        {LINKS.filter((l) => NO_CELULAR.includes(l.href)).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} onClick={() => setMais(false)} aria-current={ativo(path, href) && !mais ? 'page' : undefined} className={item}>
            <Icon size={21} strokeWidth={1.8} />
            {label}
          </Link>
        ))}
        <button type="button" onClick={() => setMais((m) => !m)} aria-expanded={mais} aria-current={maisAtivo || mais ? 'page' : undefined} className={item}>
          {mais ? <X size={21} strokeWidth={1.8} /> : <LayoutGrid size={21} strokeWidth={1.8} />}
          Mais
        </button>
      </nav>
    </>
  );
}

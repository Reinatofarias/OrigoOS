'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, CalendarDays, KanbanSquare, Building2, Wallet, LogOut, Activity, Target, Settings } from 'lucide-react';
import { logout } from '@/app/actions';
import { Logo } from './logo';

const LINKS = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/tarefas', label: 'Tarefas', icon: ListChecks },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/comercial', label: 'Comercial', icon: KanbanSquare },
  { href: '/clientes', label: 'Clientes', icon: Building2 },
  { href: '/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/metas', label: 'Metas', icon: Target },
];

function ativo(path: string, href: string) {
  return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
}

export default function Sidebar() {
  const path = usePathname();
  return (
    <>
      {/* Desktop: menu lateral escuro */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar px-3 py-5 md:flex">
        <div className="px-2">
          <Logo height={40} />
        </div>
        <p className="mt-8 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-ink/60">Workspace</p>
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

      {/* Celular: barra de cima com a marca e barra de baixo com os módulos */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 md:hidden">
        <Logo height={28} />
        <span className="flex items-center">
        <Link href="/configuracoes" className="rounded-lg p-2 text-sidebar-ink" aria-label="Configurações">
          <Settings size={18} />
        </Link>
        <form action={logout}>
          <button className="rounded-lg p-2 text-sidebar-ink" aria-label="Sair">
            <LogOut size={18} />
          </button>
        </form>
        </span>
      </header>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Principal"
      >
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={ativo(path, href) ? 'page' : undefined}
            className="flex min-w-0 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted aria-[current=page]:text-brand"
          >
            <Icon size={20} strokeWidth={1.8} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}

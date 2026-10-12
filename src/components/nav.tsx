'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, Target, Users, LogOut } from 'lucide-react';
import { logout } from '@/app/actions';

const LINKS = [
  { href: '/', label: 'Hoje', icon: CalendarCheck },
  { href: '/prospeccao', label: 'Prospecção', icon: Target },
  { href: '/clientes', label: 'Clientes', icon: Users },
];

export default function Nav() {
  const path = usePathname();
  return (
    <>
      <header className="mb-6 flex items-center justify-between gap-4">
        <span className="font-display text-xl font-extrabold">Origo OS</span>
        <nav className="hidden gap-1 md:flex" aria-label="Principal">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? 'page' : undefined}
              className="rounded-full px-4 py-2 text-sm font-semibold text-muted aria-[current=page]:bg-accent aria-[current=page]:text-accent-ink"
            >
              {label}
            </Link>
          ))}
        </nav>
        <form action={logout}>
          <button className="flex items-center gap-1 text-sm text-muted" aria-label="Sair">
            <LogOut size={16} /> Sair
          </button>
        </form>
      </header>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? 'page' : undefined}
            className="flex flex-col items-center gap-1 py-3 text-xs font-semibold text-muted aria-[current=page]:text-accent"
          >
            <Icon size={22} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}

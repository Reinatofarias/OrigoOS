import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export const btn = {
  primary:
    'inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-brand-ink shadow-sm transition hover:bg-brand-hover disabled:opacity-60',
  secondary:
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink transition hover:bg-surface-2 disabled:opacity-60',
  ghost:
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted transition hover:bg-surface-2 hover:text-ink',
  success:
    'inline-flex items-center justify-center gap-1.5 rounded-lg bg-success px-3.5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60',
  danger:
    'inline-flex items-center justify-center gap-1.5 rounded-lg bg-danger px-3.5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60',
  wa: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-wa px-3.5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90',
};

export function PageHeader({
  title,
  subtitle,
  trail,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trail?: { href: string; label: string }[];
  children?: React.ReactNode;
}) {
  return (
    <header className="border-b border-line bg-surface px-4 py-4 md:px-8 md:py-5">
      {trail && (
        <nav className="mb-1.5 flex items-center gap-1 text-[12px] text-muted" aria-label="Caminho">
          {trail.map((t) => (
            <span key={t.href} className="flex items-center gap-1">
              <Link href={t.href} className="hover:text-ink">
                {t.label}
              </Link>
              <ChevronRight size={12} />
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold tracking-tight md:text-[22px]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}

export function Body({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <main className={`mx-auto grid w-full grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 md:px-8 ${wide ? '' : 'max-w-[1280px]'}`}>{children}</main>;
}

export function Card({
  title,
  aside,
  children,
  className = '',
  flush,
}: {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(20,21,46,0.04)] ${className}`}>
      {(title || aside) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          {title && <h2 className="text-[14px] font-semibold">{title}</h2>}
          {aside && <div className="text-[12px] text-muted">{aside}</div>}
        </div>
      )}
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'info';

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${TONE[tone]}`}>
      {children}
    </span>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'success' | 'warn' | 'danger' | 'brand' | 'info';
  icon?: React.ReactNode;
}) {
  const cor = tone ? { success: 'text-success', warn: 'text-warn', danger: 'text-danger', brand: 'text-brand', info: 'text-info' }[tone] : '';
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(20,21,46,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[12.5px] font-medium text-muted">{label}</p>
        {icon && <span className="text-faint">{icon}</span>}
      </div>
      <p className={`mt-1.5 truncate text-[22px] font-bold tracking-tight ${cor}`}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

const AVATAR = ['#6a4cff', '#1aa7e8', '#d63fbf', '#0f9a64', '#e0761a', '#3a6bff'];

export function Avatar({ nome, size = 32 }: { nome: string; size?: number }) {
  const iniciais = nome
    .replace(/^(Dra?\.|Delegada)\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  const cor = AVATAR[[...nome].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR.length];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg font-bold text-white"
      style={{ width: size, height: size, background: cor, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {iniciais}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-[13px] text-muted">{children}</p>;
}

export function Tabs({ items, active }: { items: { href: string; label: string; count?: number; key: string }[]; active: string }) {
  return (
    <nav className="-mb-px flex gap-5 overflow-x-auto" aria-label="Seções">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? 'page' : undefined}
          className="flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent pb-2.5 text-[13.5px] font-medium text-muted hover:text-ink aria-[current=page]:border-brand aria-[current=page]:text-ink"
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-surface-2 px-1.5 text-[11px] text-muted">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

// Marca da Origo: círculo escuro com anel em gradiente (ciano → violeta → magenta), como no logo.
export function LogoMark({ size = 32, id = 'origo-g' }: { size?: number; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22c7ff" />
          <stop offset="0.45" stopColor="#5b5bff" />
          <stop offset="0.72" stopColor="#a23cff" />
          <stop offset="1" stopColor="#e340c8" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill="#0b0c24" />
      <circle cx="20" cy="20" r="17.5" fill="none" stroke={`url(#${id})`} strokeWidth="2" />
      <circle cx="20" cy="20" r="8.5" fill="none" stroke={`url(#${id})`} strokeWidth="3.4" />
      <circle cx="20" cy="20" r="3.2" fill="none" stroke={`url(#${id})`} strokeWidth="1.6" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-none">
        <span className="block text-[17px] font-bold tracking-tight text-white">origo</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-ink">Company · OS</span>
      </span>
    </span>
  );
}

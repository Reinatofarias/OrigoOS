import Link from 'next/link';
import { db, type Lead, type LeadStatus } from '@/lib/db';
import { COLUNAS } from '@/lib/prospeccao';
import LeadCard from '@/components/lead-card';
import AddLeadForm from '@/components/add-lead-form';

export default async function ProspeccaoPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const { data } = await db().from('leads').select('*').order('ordem');
  const leads = (data ?? []) as Lead[];
  const atual = (COLUNAS.some((c) => c.status === s) ? s : 'novo') as LeadStatus;
  const contagem = Object.fromEntries(COLUNAS.map((c) => [c.status, leads.filter((l) => l.status === c.status).length]));
  const lista = leads.filter((l) => l.status === atual);
  const fechados = contagem.fechou;

  return (
    <main className="grid gap-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold">Prospecção</h1>
        <p className="text-muted">
          {leads.length} leads no funil · {fechados} {fechados === 1 ? 'fechado' : 'fechados'} · meta: chegar a 15 clientes
        </p>
      </header>

      <nav aria-label="Etapas do funil" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {COLUNAS.map((c) => (
          <Link
            key={c.status}
            href={`/prospeccao?s=${c.status}`}
            aria-current={c.status === atual ? 'page' : undefined}
            className="shrink-0 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-semibold aria-[current=page]:border-accent aria-[current=page]:bg-accent aria-[current=page]:text-accent-ink"
          >
            {c.titulo} <span className="tabular-nums opacity-70">{contagem[c.status]}</span>
          </Link>
        ))}
      </nav>

      <div className="grid gap-4">
        {lista.length ? lista.map((l) => <LeadCard key={`${l.id}-${l.status}`} lead={l} />) : <p className="text-muted">Nenhum lead nesta etapa.</p>}
      </div>

      <AddLeadForm />
    </main>
  );
}

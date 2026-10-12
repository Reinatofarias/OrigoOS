import { db, type Client } from '@/lib/db';
import { CHECKLIST, PLATAFORMA } from '@/lib/rotina';

const SEMANA = [
  ['Segunda', 'Feedback semanal com os números da semana'],
  ['Terça', 'Otimização 1'],
  ['Quinta', 'Otimização 2 + ajustes maiores e criativos'],
  ['Sexta', 'Fechamento: conferir se tudo rodou'],
  ['1ª semana do mês', 'Relatório mensal (fazer seg/ter, enviar até quarta)'],
];

export default async function ClientesPage() {
  const { data } = await db().from('clients').select('*').eq('ativo', true).order('nome');
  const clientes = (data ?? []) as Client[];
  return (
    <main className="grid gap-8">
      <header>
        <h1 className="font-display text-3xl font-extrabold">Clientes</h1>
        <p className="text-muted">
          {clientes.length} ativos · faltam {Math.max(0, 15 - clientes.length)} para a meta de 15
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {clientes.map((c) => (
          <li key={c.id} className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="font-semibold">{c.nome}</h2>
            <p className="text-sm text-muted">{[c.segmento, c.cidade].filter(Boolean).join(' · ')}</p>
            <span className="mt-2 inline-block rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent">
              {PLATAFORMA[c.plataforma]}
            </span>
          </li>
        ))}
      </ul>

      <section className="grid gap-3">
        <h2 className="font-display text-lg font-semibold">A semana do tráfego</h2>
        <ul className="grid gap-1 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
          {SEMANA.map(([dia, tarefa]) => (
            <li key={dia} className="flex gap-3">
              <span className="w-32 shrink-0 font-semibold">{dia}</span>
              {tarefa}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {(['google', 'meta'] as const).map((p) => (
          <div key={p} className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="font-display text-lg font-semibold">Checklist {p === 'google' ? 'Google Ads' : 'Meta Ads'}</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {CHECKLIST[p].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        ))}
      </section>
    </main>
  );
}

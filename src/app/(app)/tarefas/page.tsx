import Link from 'next/link';
import { db, type Task } from '@/lib/db';
import { addDays, today } from '@/lib/dates';
import { Body, PageHeader } from '@/components/ui';
import { TaskGroups } from '@/components/tasks';
import ClientFilter from './client-filter';
import { garantirRecorrentes } from '@/lib/modelos';
import { resumosDas } from '@/lib/tarefas';

const FILTROS = [
  { key: 'todas', label: 'Todas' },
  { key: 'hoje', label: 'Hoje e atrasadas' },
  { key: 'semana', label: 'Próximos 7 dias' },
  { key: 'sem-prazo', label: 'Sem prazo' },
];

export default async function TarefasPage({ searchParams }: PageProps<'/tarefas'>) {
  const sp = await searchParams;
  const f = typeof sp.f === 'string' ? sp.f : 'todas';
  const cliente = typeof sp.cliente === 'string' ? sp.cliente : '';
  const hoje = today();
  const supa = db();
  await garantirRecorrentes(supa);

  let q = supa.from('tasks').select('*').order('data', { nullsFirst: false }).order('created_at');
  if (cliente) q = q.eq('client_id', cliente);
  if (f === 'hoje') q = q.lte('data', hoje);
  if (f === 'semana') q = q.lte('data', addDays(hoje, 7));
  if (f === 'sem-prazo') q = q.is('data', null);

  const [{ data: tasks }, { data: clientes }] = await Promise.all([q, supa.from('clients').select('id, nome').order('nome')]);
  const lista = (tasks ?? []) as Task[];
  // Concluídas: só as dos últimos 14 dias, para a lista não crescer pra sempre.
  const limite = addDays(hoje, -14);
  const visiveis = lista.filter((t) => t.status !== 'done' || (t.feita_em ?? '').slice(0, 10) >= limite);
  const abertas = visiveis.filter((t) => t.status !== 'done').length;
  const resumos = await resumosDas(supa, visiveis.map((t) => t.id));

  const href = (k: string) => `/tarefas?${new URLSearchParams({ ...(k !== 'todas' && { f: k }), ...(cliente && { cliente }) })}`;

  return (
    <>
      <PageHeader title="Tarefas" subtitle={`${abertas} abertas`}>
        <ClientFilter clientes={clientes ?? []} value={cliente} f={f} />
      </PageHeader>
      <div className="border-b border-line bg-surface px-4 md:px-8">
        <nav className="flex gap-1 overflow-x-auto py-2" aria-label="Filtros">
          {FILTROS.map((x) => (
            <Link
              key={x.key}
              href={href(x.key)}
              aria-current={f === x.key ? 'page' : undefined}
              className="whitespace-nowrap rounded-md px-2.5 py-1 text-[13px] font-medium text-muted hover:bg-surface-2 aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand"
            >
              {x.label}
            </Link>
          ))}
        </nav>
      </div>
      <Body>
        <TaskGroups tasks={visiveis} clientes={clientes ?? []} hoje={hoje} clientId={cliente || undefined} ocultarConcluidas resumos={resumos} />
      </Body>
    </>
  );
}

import { db, type Client, type Lead, type Task } from '@/lib/db';
import { addDays, formatDay, formatShort, today } from '@/lib/dates';
import { DIA_BASE, notaDoDia, tarefasDeTrafego } from '@/lib/rotina';
import QuickAdd from '@/components/quick-add';
import TaskItem from '@/components/task-item';
import RoutineItem from '@/components/routine-item';
import LeadCard from '@/components/lead-card';
import Section from '@/components/section';

const META_DIA = 5;

export default async function HojePage() {
  const hoje = today();
  const amanha = addDays(hoje, 1);
  const supa = db();

  const [{ data: tarefas }, { data: feitasHoje }, { data: clientes }, { data: checks }, { data: followups }, { data: novos }] =
    await Promise.all([
      supa.from('tasks').select('*').eq('feita', false).or(`data.is.null,data.lte.${hoje}`).order('data', { nullsFirst: false }).order('created_at'),
      supa.from('tasks').select('*').eq('feita', true).gte('feita_em', `${hoje}T00:00:00-03:00`).order('feita_em'),
      supa.from('clients').select('*').eq('ativo', true).order('nome'),
      supa.from('routine_checks').select('client_id, tipo').eq('data', hoje),
      supa.from('leads').select('*').in('status', ['m1', 'm2', 'm3', 'respondeu', 'call']).lte('proxima_acao', hoje).order('proxima_acao'),
      supa.from('leads').select('*').eq('status', 'novo').order('ordem').limit(META_DIA),
    ]);

  const abertas = (tarefas ?? []) as Task[];
  const comData = abertas.filter((t) => t.data);
  const semData = abertas.filter((t) => !t.data);
  const trafego = tarefasDeTrafego(hoje);
  const feito = new Set((checks ?? []).map((c) => `${c.client_id}:${c.tipo}`));

  return (
    <main className="grid gap-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">{formatDay(hoje)}</p>
        <h1 className="font-display text-3xl font-extrabold">Bom dia, Renato</h1>
        <p className="text-muted">{notaDoDia(hoje)}</p>
      </header>

      <QuickAdd />

      <Section title="Tarefas de hoje" aside={`${comData.length} abertas`}>
        {comData.length ? (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
            {comData.map((t) => (
              <TaskItem key={t.id} task={t} amanha={amanha} atrasada={!!t.data && t.data < hoje} />
            ))}
          </ul>
        ) : (
          <p className="text-muted">Nada pendente para hoje. Use o campo acima para jogar uma tarefa.</p>
        )}
        {semData.length > 0 && (
          <details className="rounded-2xl border border-line bg-surface px-4 py-2">
            <summary className="cursor-pointer py-1 text-sm font-semibold">Sem data ({semData.length})</summary>
            <ul className="divide-y divide-line">
              {semData.map((t) => (
                <TaskItem key={t.id} task={t} amanha={amanha} />
              ))}
            </ul>
          </details>
        )}
        {(feitasHoje ?? []).length > 0 && (
          <details className="px-1 text-sm text-muted">
            <summary className="cursor-pointer">Feitas hoje ({feitasHoje!.length})</summary>
            <ul>
              {(feitasHoje as Task[]).map((t) => (
                <TaskItem key={t.id} task={t} amanha={amanha} />
              ))}
            </ul>
          </details>
        )}
      </Section>

      {trafego.length > 0 && (
        <Section title="Tráfego de hoje">
          <div className="grid gap-3 sm:grid-cols-2">
            {trafego.map((r) => (
              <div key={r.tipo} className="rounded-2xl border border-line bg-surface px-4 py-3">
                <h3 className="font-semibold">{r.titulo}</h3>
                <ul>
                  {((clientes ?? []) as Client[]).map((c) => (
                    <RoutineItem key={c.id} clientId={c.id} tipo={r.tipo} label={c.nome} feita={feito.has(`${c.id}:${r.tipo}`)} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Prospecção de hoje" aside="13h30 às 14h30">
        {(followups ?? []).length > 0 && <p className="text-sm font-semibold text-warn">Follow-ups pendentes</p>}
        {((followups ?? []) as Lead[]).map((l) => (
          <LeadCard key={`${l.id}-${l.status}`} lead={l} destaque={l.proxima_acao && l.proxima_acao < hoje ? `atrasado desde ${formatShort(l.proxima_acao)}` : 'hoje'} />
        ))}
        <p className="text-sm font-semibold text-muted">Novas abordagens (meta: {META_DIA} por dia)</p>
        {((novos ?? []) as Lead[]).map((l) => (
          <LeadCard key={`${l.id}-${l.status}`} lead={l} />
        ))}
        {!(novos ?? []).length && <p className="text-muted">Acabaram os leads novos. Hora de montar a próxima lista.</p>}
      </Section>

      <Section title="Rotina do dia">
        <ul className="grid gap-1 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
          {DIA_BASE.map((r) => (
            <li key={r.hora} className="flex gap-3">
              <span className="w-12 shrink-0 font-semibold tabular-nums text-muted">{r.hora}</span>
              {r.item}
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

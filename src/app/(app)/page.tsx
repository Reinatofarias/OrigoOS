import Link from 'next/link';
import { ArrowRight, MessageCircle, ListChecks, KanbanSquare, Wallet, Target } from 'lucide-react';
import { db, keyProblem, type Charge, type Client, type Lead, type Task } from '@/lib/db';
import { addDays, formatDay, formatShort, monthRange, today } from '@/lib/dates';
import { brl, situacao } from '@/lib/format';
import { DIA_BASE, notaDoDia, tarefasDeTrafego } from '@/lib/rotina';
import { NICHO, proximoPasso } from '@/lib/prospeccao';
import { Avatar, Badge, Body, Card, Empty, Kpi } from '@/components/ui';
import { TodayTasks } from '@/components/tasks';
import RoutineToggle from '@/components/routine';

const META_DIA = 5;

function saudacao() {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Recife', hour: 'numeric', hour12: false }).format(new Date()));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default async function InicioPage() {
  const hoje = today();
  const { start, end } = monthRange(hoje.slice(0, 7));
  const supa = db();
  const resultados = await Promise.all([
    supa.from('tasks').select('*').neq('status', 'done').lte('data', hoje).order('data').order('created_at'),
    supa.from('clients').select('*').eq('ativo', true).order('nome'),
    supa.from('routine_checks').select('client_id, tipo').eq('data', hoje),
    supa.from('leads').select('*').in('status', ['m1', 'm2', 'm3', 'respondeu', 'call', 'proposta']).lte('proxima_acao', hoje).order('proxima_acao'),
    supa.from('leads').select('*').eq('status', 'novo').order('ordem').limit(META_DIA),
    supa.from('leads').select('valor, status').not('status', 'in', '(fechou,perdido)'),
    supa.from('charges').select('*').eq('status', 'pendente').lte('vencimento', addDays(hoje, 7)).order('vencimento'),
    supa.from('charges').select('valor, status, vencimento').gte('vencimento', start).lte('vencimento', end).neq('status', 'cancelado'),
  ]);
  const [{ data: ts }, { data: cs }, { data: checks }, { data: fu }, { data: nv }, { data: abertos }, { data: proximas }, { data: mes }] = resultados;
  const erroBanco = keyProblem() ?? resultados.find((r) => r.error)?.error?.message;

  const tarefas = (ts ?? []) as Task[];
  const clientes = (cs ?? []) as Client[];
  const followups = (fu ?? []) as Lead[];
  const novos = (nv ?? []) as Lead[];
  const cobrancas = (proximas ?? []) as Charge[];
  const nomes = Object.fromEntries(clientes.map((c) => [c.id, c.nome]));
  const atrasadas = tarefas.filter((t) => t.data && t.data < hoje).length;
  const rotina = tarefasDeTrafego(hoje);
  const feito = new Set((checks ?? []).map((c) => `${c.client_id}:${c.tipo}`));
  const rotinaTotal = rotina.length * clientes.length;
  const rotinaFeita = clientes.reduce((s, c) => s + rotina.filter((r) => feito.has(`${c.id}:${r.tipo}`)).length, 0);
  const pipeline = (abertos ?? []).reduce((s, l) => s + Number(l.valor ?? 0), 0);
  const aReceber = (mes ?? []).filter((c) => c.status === 'pendente').reduce((s, c) => s + Number(c.valor), 0);
  const vencido = cobrancas.filter((c) => situacao(c, hoje) === 'vencido').reduce((s, c) => s + Number(c.valor), 0);

  return (
    <>
      <header className="relative overflow-hidden bg-sidebar px-4 pb-6 pt-6 text-white md:px-8 md:pt-8">
        <div className="bg-grad pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-30 blur-3xl" />
        <div className="relative mx-auto max-w-[1280px]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sidebar-ink">{formatDay(hoje)}</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight">
            {saudacao()}, <span className="text-grad">Renato</span>
          </h1>
          <p className="mt-0.5 text-[13.5px] text-sidebar-ink">{notaDoDia(hoje)}</p>
        </div>
      </header>

      <Body>
        {erroBanco && <p className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-[13px] text-danger">Não consegui ler o banco: {erroBanco}</p>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Tarefas pra hoje" value={tarefas.length} hint={atrasadas ? `${atrasadas} atrasada(s)` : 'Nenhuma atrasada'} tone={atrasadas ? 'danger' : undefined} icon={<ListChecks size={16} />} />
          <Kpi label="Prospecção de hoje" value={followups.length + novos.length} hint={`${followups.length} follow-ups · ${novos.length} novos`} icon={<Target size={16} />} />
          <Kpi label="Em negociação" value={brl(pipeline, false)} hint={`${abertos?.length ?? 0} negócios no funil`} tone="brand" icon={<KanbanSquare size={16} />} />
          <Kpi label="A receber no mês" value={brl(aReceber, false)} hint={vencido ? `${brl(vencido)} vencido` : 'Nada vencido'} tone={vencido ? 'danger' : 'warn'} icon={<Wallet size={16} />} />
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-6">
            <Card flush title="Minhas tarefas de hoje" aside={<Link href="/tarefas" className="font-semibold text-brand">Ver todas</Link>}>
              <TodayTasks tasks={tarefas} clientes={clientes} hoje={hoje} />
            </Card>

            <Card title="Prospecção de hoje" aside="13h30 às 14h30">
              {followups.length + novos.length === 0 ? (
                <Empty>
                  Sem leads pra hoje. <Link href="/comercial" className="font-semibold text-brand">Abrir o funil</Link>
                </Empty>
              ) : (
                <ul className="grid divide-y divide-line">
                  {[...followups, ...novos].map((l) => {
                    const passo = proximoPasso(l.status);
                    return (
                      <li key={l.id} className="flex items-center gap-3 py-2.5">
                        <Avatar nome={l.nome} size={30} />
                        <Link href={`/comercial/${l.id}`} className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold hover:text-brand">{l.nome}</span>
                          <span className="block truncate text-[12px] text-muted">{[l.cidade, NICHO[l.nicho]].filter(Boolean).join(' · ')}</span>
                        </Link>
                        {passo ? (
                          <Badge tone={l.status === 'novo' ? 'info' : 'warn'}>Mandar {passo.toUpperCase()}</Badge>
                        ) : (
                          <Badge tone="brand">Retornar</Badge>
                        )}
                        {l.whatsapp && (
                          <a href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${l.nome}`} className="grid size-8 place-items-center rounded-lg text-wa hover:bg-success-soft">
                            <MessageCircle size={16} />
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-6">
            {rotina.length > 0 && (
              <Card title="Rotina de tráfego" aside={`${rotinaFeita}/${rotinaTotal}`}>
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="bg-grad h-full" style={{ width: `${rotinaTotal ? (rotinaFeita / rotinaTotal) * 100 : 0}%` }} />
                </div>
                {rotina.map((r) => (
                  <div key={r.tipo} className="mb-2 last:mb-0">
                    <p className="mb-1 px-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted">{r.titulo}</p>
                    {clientes.map((c) => (
                      <RoutineToggle key={c.id} clientId={c.id} tipo={r.tipo} label={c.nome} feito={feito.has(`${c.id}:${r.tipo}`)} />
                    ))}
                  </div>
                ))}
              </Card>
            )}

            <Card title="Cobranças da semana" aside={<Link href="/financeiro" className="font-semibold text-brand">Financeiro</Link>} flush>
              {cobrancas.length ? (
                <ul className="divide-y divide-line">
                  {cobrancas.map((c) => {
                    const s = situacao(c, hoje);
                    return (
                      <li key={c.id}>
                        <Link href={`/clientes/${c.client_id}?tab=cobrancas`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2/60">
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold">{nomes[c.client_id] ?? 'Cliente'}</span>
                            <span className={`block text-[12px] ${s === 'vencido' ? 'font-semibold text-danger' : 'text-muted'}`}>
                              {s === 'vencido' ? 'Venceu' : 'Vence'} {formatShort(c.vencimento)}
                            </span>
                          </span>
                          <span className="text-[13px] font-semibold tabular-nums">{brl(c.valor)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <Empty>Nenhuma cobrança vencendo nos próximos 7 dias.</Empty>
              )}
            </Card>

            <Card title="Meu dia">
              <ol className="grid gap-2">
                {DIA_BASE.map((d) => (
                  <li key={d.hora} className="grid grid-cols-[52px_minmax(0,1fr)] text-[13px]">
                    <span className="font-semibold tabular-nums text-muted">{d.hora}</span>
                    <span>{d.item}</span>
                  </li>
                ))}
              </ol>
              <Link href="/tarefas" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand">
                Planejar a semana <ArrowRight size={13} />
              </Link>
            </Card>
          </div>
        </div>
      </Body>
    </>
  );
}

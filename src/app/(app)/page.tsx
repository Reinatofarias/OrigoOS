import Link from 'next/link';
import { ArrowRight, ListChecks, KanbanSquare, Wallet, Target } from 'lucide-react';
import { db, keyProblem, type Charge, type Client, type Lead, type Task } from '@/lib/db';
import { addDays, formatDay, formatShort, monthRange, today } from '@/lib/dates';
import { brl, situacao } from '@/lib/format';
import { DIA_BASE, notaDoDia } from '@/lib/rotina';
import { garantirRecorrentes } from '@/lib/modelos';
import { lerMetas } from '@/lib/metas';
import { mensagem, NICHO, proximoPasso } from '@/lib/prospeccao';
import { lerModelos } from '@/lib/mensagens';
import { NIVEL, saudeDosClientes } from '@/lib/saude';
import ProspeccaoHoje from '@/components/prospeccao-hoje';
import { Badge, Body, Card, Empty, Kpi } from '@/components/ui';
import { TodayTasks } from '@/components/tasks';
import { resumosDas } from '@/lib/tarefas';
import RoutineToggle from '@/components/routine';
import { listarEventos, situacaoAgenda, type Evento } from '@/lib/google-agenda';
import { NovoCompromisso } from '@/components/agenda';
import { ItensDoDia } from '@/components/agenda-dia';

const META_DIA = 5;

function saudacao() {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Recife', hour: 'numeric', hour12: false }).format(new Date()));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default async function InicioPage() {
  const hoje = today();
  const { start, end } = monthRange(hoje.slice(0, 7));
  const supa = db();
  await garantirRecorrentes(supa);
  const resultados = await Promise.all([
    supa.from('tasks').select('*').lte('data', hoje).or(`status.neq.done,data.eq.${hoje}`).order('data').order('created_at'),
    supa.from('clients').select('*').eq('ativo', true).order('nome'),
    lerMetas(supa).then((m) => ({ data: m, error: null })),
    lerModelos(supa).then((m) => ({ data: m, error: null })),
    saudeDosClientes(supa, hoje).then((m) => ({ data: m, error: null })),
    supa.from('leads').select('*').in('status', ['m1', 'm2', 'm3', 'respondeu', 'call', 'proposta']).lte('proxima_acao', hoje).order('proxima_acao'),
    supa.from('leads').select('*').eq('status', 'novo').order('ordem').limit(META_DIA),
    supa.from('leads').select('valor, status').not('status', 'in', '(fechou,perdido)'),
    supa.from('charges').select('*').eq('status', 'pendente').lte('vencimento', addDays(hoje, 7)).order('vencimento'),
    supa.from('charges').select('valor, status, vencimento').gte('vencimento', start).lte('vencimento', end).neq('status', 'cancelado'),
  ]);
  const [{ data: ts }, { data: cs }, { data: metas }, { data: modelos }, { data: saude }, { data: fu }, { data: nv }, { data: abertos }, { data: proximas }, { data: mes }] = resultados;
  const erroBanco = keyProblem() ?? resultados.find((r) => r.error)?.error?.message;

  const todas = (ts ?? []) as Task[];
  const tarefas = todas.filter((t) => t.origem !== 'recorrente' && t.status !== 'done');
  const resumos = await resumosDas(supa, tarefas.map((t) => t.id));
  const rotina = todas.filter((t) => t.origem === 'recorrente');
  const clientes = (cs ?? []) as Client[];
  const followups = (fu ?? []) as Lead[];
  const novos = (nv ?? []) as Lead[];
  const cobrancas = (proximas ?? []) as Charge[];
  const nomes = Object.fromEntries(clientes.map((c) => [c.id, c.nome]));
  const abertasHoje = todas.filter((t) => t.status !== 'done');
  const atrasadas = abertasHoje.filter((t) => t.data && t.data < hoje).length;
  const rotinaFeita = rotina.filter((t) => t.status === 'done').length;
  const grupos = [...new Set(rotina.map((t) => t.titulo))];
  const pipeline = (abertos ?? []).reduce((s, l) => s + Number(l.valor ?? 0), 0);
  const aReceber = (mes ?? []).filter((c) => c.status === 'pendente').reduce((s, c) => s + Number(c.valor), 0);
  // Agenda de hoje: só aparece com o Google Agenda conectado. Se o Google falhar, o Início segue normal.
  const agenda = await situacaoAgenda(supa).catch(() => null);
  const eventos: Evento[] | null = agenda?.conectada ? await listarEventos(supa, hoje, hoje).catch(() => null) : null;
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
          {metas && (
            <Link href="/metas" className="mt-4 flex max-w-sm items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 hover:bg-white/[0.07]">
              <span className="text-[12.5px] text-sidebar-ink">Meta</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <span className="bg-grad block h-full rounded-full" style={{ width: `${Math.min(100, (clientes.length / metas.clientes) * 100)}%` }} />
              </span>
              <span className="text-[12.5px] font-semibold">
                {clientes.length} de {metas.clientes} clientes
              </span>
            </Link>
          )}
        </div>
      </header>

      <Body>
        {erroBanco && <p className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-[13px] text-danger">Não consegui ler o banco: {erroBanco}</p>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Tarefas pra hoje" value={abertasHoje.length} hint={atrasadas ? `${atrasadas} atrasada(s)` : 'Nenhuma atrasada'} tone={atrasadas ? 'danger' : undefined} icon={<ListChecks size={16} />} />
          <Kpi label="Prospecção de hoje" value={followups.length + novos.length} hint={`${followups.length} follow-ups · ${novos.length} novos`} icon={<Target size={16} />} />
          <Kpi label="Em negociação" value={brl(pipeline, false)} hint={`${abertos?.length ?? 0} negócios no funil`} tone="brand" icon={<KanbanSquare size={16} />} />
          <Kpi label="A receber no mês" value={brl(aReceber, false)} hint={vencido ? `${brl(vencido)} vencido` : 'Nada vencido'} tone={vencido ? 'danger' : 'warn'} icon={<Wallet size={16} />} />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
            <Card flush title="Minhas tarefas de hoje" aside={<Link href="/tarefas" className="font-semibold text-brand">Ver todas</Link>}>
              <TodayTasks tasks={tarefas} clientes={clientes} hoje={hoje} resumos={resumos} />
            </Card>

            <Card title="Prospecção de hoje" aside="13h30 às 14h30">
              {followups.length + novos.length === 0 ? (
                <Empty>
                  Sem leads pra hoje. <Link href="/comercial" className="font-semibold text-brand">Abrir o funil</Link>
                </Empty>
              ) : (
                <ProspeccaoHoje
                  leads={[...followups, ...novos].map((l) => {
                    const passo = proximoPasso(l.status);
                    return { id: l.id, nome: l.nome, whatsapp: l.whatsapp, status: l.status, sub: [l.cidade, NICHO[l.nicho]].filter(Boolean).join(' · '), passo, texto: passo ? mensagem(passo, l, modelos) : null };
                  })}
                />
              )}
            </Card>
          </div>

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
            {agenda?.conectada && (
              <Card title="Agenda de hoje" aside={<Link href="/agenda" className="font-semibold text-brand">Ver semana</Link>}>
                {eventos === null ? (
                  <p className="text-[13px] text-danger">Não consegui ler o Google Agenda agora.</p>
                ) : eventos.length ? (
                  <ItensDoDia eventos={eventos} tarefas={[]} />
                ) : (
                  <p className="text-[13px] text-muted">Nenhum compromisso hoje.</p>
                )}
                <div className="mt-3">
                  <NovoCompromisso dia={hoje} variant="secondary" />
                </div>
              </Card>
            )}
            <Card title="Saúde dos clientes" aside={<Link href="/clientes" className="hover:text-ink">{saude.filter((c) => c.nivel === 'ok').length}/{saude.length} em dia</Link>}>
              {saude.every((c) => c.nivel === 'ok') ? (
                <Empty>Todos os clientes em dia.</Empty>
              ) : (
                <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
                  {saude
                    .filter((c) => c.nivel !== 'ok')
                    .map((c) => (
                      <li key={c.client_id}>
                        <Link href={`/clientes/${c.client_id}`} className="group flex items-center gap-2">
                          <span className="size-2 shrink-0 rounded-full" style={{ background: NIVEL[c.nivel].cor }} />
                          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold group-hover:text-brand">{c.nome}</span>
                          <Badge tone={NIVEL[c.nivel].tone}>{NIVEL[c.nivel].label}</Badge>
                        </Link>
                        <ul className="mt-1 grid gap-0.5 pl-4">
                          {c.alertas.slice(0, 3).map((a) => (
                            <li key={a.texto} className={`text-[12.5px] ${a.nivel === 'risco' ? 'text-danger' : 'text-muted'}`}>
                              {a.texto}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                </ul>
              )}
            </Card>
            {rotina.length > 0 && (
              <Card title="Rotina de tráfego" aside={<Link href="/configuracoes?tab=rotina" className="hover:text-ink">{rotinaFeita}/{rotina.length}</Link>}>
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="bg-grad h-full" style={{ width: `${(rotinaFeita / rotina.length) * 100}%` }} />
                </div>
                {grupos.map((g) => (
                  <div key={g} className="mb-2 last:mb-0">
                    <p className="mb-1 px-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted">{g}</p>
                    {rotina
                      .filter((t) => t.titulo === g)
                      .map((t) => (
                        <RoutineToggle
                          key={`${t.id}-${t.status}`}
                          taskId={t.id}
                          label={nomes[t.client_id ?? ''] ?? 'Cliente'}
                          feito={t.status === 'done'}
                          sub={t.data && t.data < hoje ? `Atrasada desde ${formatShort(t.data)}` : undefined}
                          atrasada
                        />
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

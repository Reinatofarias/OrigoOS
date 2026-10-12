import { notFound } from 'next/navigation';
import { Mail, Phone, FileText, CalendarDays } from 'lucide-react';
import { db, type Charge, type Client, type Task } from '@/lib/db';
import { addDays, formatShort, today } from '@/lib/dates';
import { brl, situacao } from '@/lib/format';
import { CHECKLIST, PLATAFORMA, tarefasDeTrafego } from '@/lib/rotina';
import { Avatar, Badge, Body, Card, Empty, Kpi, PageHeader, Tabs, btn } from '@/components/ui';
import { ChargeTable } from '@/components/charges';
import { TaskGroups, TaskRow } from '@/components/tasks';
import RoutineToggle from '@/components/routine';
import FormDialog, { Field } from '@/components/dialog';
import ClientFields from '@/components/client-form';
import { addCharge, saveClient } from '@/app/actions';

const TABS = ['geral', 'cobrancas', 'tarefas', 'dados'] as const;

export default async function ClientePage({ params, searchParams }: PageProps<'/clientes/[id]'>) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.find((t) => t === sp.tab) ?? 'geral';
  const hoje = today();
  const supa = db();
  const [{ data: c }, { data: ch }, { data: ts }, { data: checks }, { data: todos }] = await Promise.all([
    supa.from('clients').select('*').eq('id', id).maybeSingle(),
    supa.from('charges').select('*').eq('client_id', id).order('vencimento', { ascending: false }),
    supa.from('tasks').select('*').eq('client_id', id).order('data', { nullsFirst: false }).order('created_at'),
    supa.from('routine_checks').select('tipo').eq('client_id', id).eq('data', hoje),
    supa.from('clients').select('id, nome').order('nome'),
  ]);
  if (!c) notFound();
  const cliente = c as Client;
  const cobrancas = (ch ?? []) as Charge[];
  const tarefas = (ts ?? []) as Task[];
  const abertas = tarefas.filter((t) => t.status !== 'done');
  const recebido = cobrancas.filter((x) => x.status === 'pago').reduce((s, x) => s + Number(x.valor), 0);
  const emAberto = cobrancas.filter((x) => x.status === 'pendente').reduce((s, x) => s + Number(x.valor), 0);
  const vencidas = cobrancas.filter((x) => situacao(x, hoje) === 'vencido');
  const feitos = new Set((checks ?? []).map((x) => x.tipo));
  const rotinaHoje = tarefasDeTrafego(hoje);
  const plataformas = cliente.plataforma === 'google_meta' ? (['google', 'meta'] as const) : [cliente.plataforma];
  const base = `/clientes/${id}`;

  return (
    <>
      <PageHeader
        trail={[{ href: '/clientes', label: 'Clientes' }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar nome={cliente.nome} size={40} />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                {cliente.nome}
                {cliente.ativo ? <Badge tone="success">Ativo</Badge> : <Badge>Inativo</Badge>}
                {vencidas.length > 0 && <Badge tone="danger">{vencidas.length} vencida(s)</Badge>}
              </span>
              <span className="block text-[13px] font-medium text-muted">
                {[cliente.segmento, cliente.cidade, PLATAFORMA[cliente.plataforma]].filter(Boolean).join(' · ')}
              </span>
            </span>
          </span>
        }
      >
        <FormDialog label="Nova cobrança" title={`Nova cobrança para ${cliente.nome}`} action={addCharge} variant="secondary">
          <input type="hidden" name="client_id" value={id} />
          <Field label="Descrição">
            <input name="descricao" defaultValue="Cobrança avulsa" className="field" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Valor (R$)">
              <input name="valor" required inputMode="decimal" defaultValue={cliente.mensalidade ?? ''} className="field" />
            </Field>
            <Field label="Vencimento">
              <input name="vencimento" required type="date" defaultValue={addDays(hoje, 3)} className="field" />
            </Field>
          </div>
        </FormDialog>
      </PageHeader>

      <div className="border-b border-line bg-surface px-4 pt-3 md:px-8">
        <Tabs
          active={tab}
          items={[
            { key: 'geral', label: 'Visão geral', href: base },
            { key: 'cobrancas', label: 'Cobranças', href: `${base}?tab=cobrancas`, count: cobrancas.length },
            { key: 'tarefas', label: 'Tarefas', href: `${base}?tab=tarefas`, count: abertas.length },
            { key: 'dados', label: 'Dados cadastrais', href: `${base}?tab=dados` },
          ]}
        />
      </div>

      <Body>
        {tab === 'geral' && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Mensalidade" value={cliente.mensalidade ? brl(cliente.mensalidade) : '—'} hint={`Vence todo dia ${cliente.dia_vencimento}`} tone="brand" />
              <Kpi label="Total recebido" value={brl(recebido)} tone="success" />
              <Kpi label="Em aberto" value={brl(emAberto)} tone={vencidas.length ? 'danger' : 'warn'} hint={vencidas.length ? 'Tem cobrança vencida' : undefined} />
              <Kpi label="Cliente desde" value={cliente.inicio ? formatShort(cliente.inicio) + '/' + cliente.inicio.slice(2, 4) : '—'} />
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid gap-6">
                <Card title="Tarefas abertas" aside={<a href={`${base}?tab=tarefas`} className="font-semibold text-brand">Ver todas</a>} flush>
                  {abertas.length ? (
                    abertas.slice(0, 6).map((t) => <TaskRow key={`${t.id}-${t.status}-${t.titulo}`} task={t} clientes={todos ?? []} hoje={hoje} semCliente />)
                  ) : (
                    <Empty>Nenhuma tarefa aberta pra esse cliente.</Empty>
                  )}
                </Card>
                <Card title="Últimas cobranças" aside={<a href={`${base}?tab=cobrancas`} className="font-semibold text-brand">Ver todas</a>} flush>
                  <ChargeTable charges={cobrancas.slice(0, 4)} hoje={hoje} />
                </Card>
              </div>
              <div className="grid gap-6">
                <Card title="Rotina de tráfego de hoje">
                  {rotinaHoje.length ? (
                    rotinaHoje.map((r) => <RoutineToggle key={r.tipo} clientId={id} tipo={r.tipo} label={r.titulo} feito={feitos.has(r.tipo)} />)
                  ) : (
                    <p className="text-[13px] text-muted">Hoje não tem rotina fixa de tráfego.</p>
                  )}
                </Card>
                <Card title="Checklist de otimização">
                  {plataformas.map((p) => (
                    <div key={p} className="mb-3 last:mb-0">
                      <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted">{p === 'google' ? 'Google Ads' : 'Meta Ads'}</p>
                      <ol className="grid list-decimal gap-1 pl-5 text-[13px]">
                        {CHECKLIST[p].map((i) => (
                          <li key={i}>{i}</li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </Card>
                <Card title="Contato">
                  <ul className="grid gap-2 text-[13px]">
                    <li className="flex items-center gap-2"><Phone size={14} className="text-muted" />{cliente.telefone ?? <span className="text-muted">—</span>}</li>
                    <li className="flex items-center gap-2"><Mail size={14} className="text-muted" />{cliente.email ?? <span className="text-muted">—</span>}</li>
                    <li className="flex items-center gap-2"><FileText size={14} className="text-muted" />{cliente.documento ?? <span className="text-muted">—</span>}</li>
                    <li className="flex items-center gap-2"><CalendarDays size={14} className="text-muted" />Responsável: {cliente.responsavel ?? '—'}</li>
                  </ul>
                </Card>
              </div>
            </div>
          </>
        )}

        {tab === 'cobrancas' && (
          <Card flush title="Cobranças" aside={`Recebido ${brl(recebido)} · Em aberto ${brl(emAberto)}`}>
            <ChargeTable charges={cobrancas} hoje={hoje} />
          </Card>
        )}

        {tab === 'tarefas' && <TaskGroups tasks={tarefas} clientes={todos ?? []} hoje={hoje} clientId={id} ocultarConcluidas />}

        {tab === 'dados' && (
          <Card title="Dados cadastrais">
            <form action={saveClient.bind(null, id)} className="grid gap-4">
              <ClientFields c={cliente} />
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" name="ativo" defaultChecked={cliente.ativo} className="size-4 accent-[var(--brand)]" /> Cliente ativo
              </label>
              <div>
                <button className={btn.primary}>Salvar alterações</button>
              </div>
            </form>
          </Card>
        )}
      </Body>
    </>
  );
}

import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { Mail, Phone, FileText, CalendarDays, Rocket, FileSignature, BarChart3, Plus, HeartPulse, ListPlus, RefreshCcw } from 'lucide-react';
import { db, type AdMetric, type Charge, type Client, type ClientRequest, type Contract, type Report, type Task } from '@/lib/db';
import { NIVEL, saudeDosClientes } from '@/lib/saude';
import { CONVERSOES_META_PADRAO, metaConfigurado } from '@/lib/anuncios';
import { adicionarPedido, adicionarPedidosPadrao, novoLinkPortal, registrarContato, salvarContas } from '@/app/acoes/clientes';
import Pedidos from '@/components/pedidos';
import { SincronizarMeta } from '@/components/anuncios';
import { LinkAcoes } from '@/components/link-acoes';
import { STATUS_CONTRATO, numeroContrato } from '@/lib/contrato';
import { metricas } from '@/lib/relatorio';
import { addDays, addMonths, formatMonth, formatShort, prazo, today } from '@/lib/dates';
import { brl, situacao } from '@/lib/format';
import { CHECKLIST, PLATAFORMA } from '@/lib/rotina';
import { garantirRecorrentes } from '@/lib/modelos';
import { asaasConfigurado } from '@/lib/asaas';
import { Avatar, Badge, Body, Card, Empty, Kpi, PageHeader, Tabs, btn } from '@/components/ui';
import { ChargeTable } from '@/components/charges';
import { TaskGroups, TaskRow } from '@/components/tasks';
import { resumosDas } from '@/lib/tarefas';
import RoutineToggle from '@/components/routine';
import FormDialog, { Field } from '@/components/dialog';
import ClientFields from '@/components/client-form';
import { ExcluirCliente } from '@/components/excluir-cliente';
import { addCharge, aplicarOnboarding, novoRelatorio, saveClient } from '@/app/actions';

const TABS = ['geral', 'cobrancas', 'tarefas', 'relatorios', 'anuncios', 'portal', 'dados'] as const;

export default async function ClientePage({ params, searchParams }: PageProps<'/clientes/[id]'>) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.find((t) => t === sp.tab) ?? 'geral';
  const hoje = today();
  const supa = db();
  await garantirRecorrentes(supa);
  const [{ data: c }, { data: ch }, { data: ts }, { data: todos }, { data: cts }, { data: rps }, { data: ads }, { data: peds }, saudes] = await Promise.all([
    supa.from('clients').select('*').eq('id', id).maybeSingle(),
    supa.from('charges').select('*').eq('client_id', id).order('vencimento', { ascending: false }),
    supa.from('tasks').select('*').eq('client_id', id).order('data', { nullsFirst: false }).order('created_at'),
    supa.from('clients').select('id, nome').order('nome'),
    supa.from('contracts').select('*').eq('client_id', id).neq('status', 'cancelado').order('created_at', { ascending: false }),
    supa.from('reports').select('*').eq('client_id', id).order('competencia', { ascending: false }),
    supa.from('ad_metrics').select('*').eq('client_id', id).gte('data', addDays(hoje, -30)).order('data', { ascending: false }),
    supa.from('client_requests').select('*').eq('client_id', id).order('ordem'),
    saudeDosClientes(supa, hoje),
  ]);
  if (!c) notFound();
  const cliente = c as Client;
  const cobrancas = (ch ?? []) as Charge[];
  const tarefas = (ts ?? []) as Task[];
  const abertas = tarefas.filter((t) => t.status !== 'done');
  const resumos = await resumosDas(supa, tab === 'tarefas' ? tarefas.map((t) => t.id) : abertas.slice(0, 6).map((t) => t.id));
  const recebido = cobrancas.filter((x) => x.status === 'pago').reduce((s, x) => s + Number(x.valor), 0);
  const emAberto = cobrancas.filter((x) => x.status === 'pendente').reduce((s, x) => s + Number(x.valor), 0);
  const vencidas = cobrancas.filter((x) => situacao(x, hoje) === 'vencido');
  const onboarding = tarefas.filter((t) => t.origem === 'onboarding');
  const onbFeitas = onboarding.filter((t) => t.status === 'done').length;
  const rotina = tarefas.filter((t) => t.origem === 'recorrente' && t.data && t.data >= addDays(hoje, -6) && t.data <= addDays(hoje, 6) && (t.status !== 'done' || t.data >= hoje));
  const asaas = asaasConfigurado();
  const contratos = (cts ?? []) as Contract[];
  const relatorios = (rps ?? []) as Report[];
  const mesPassado = addMonths(hoje.slice(0, 7), -1);
  const plataformas = cliente.plataforma === 'google_meta' ? (['google', 'meta'] as const) : [cliente.plataforma];
  const base = `/clientes/${id}`;
  const saude = saudes.find((x) => x.client_id === id);
  const metricasAds = (ads ?? []) as AdMetric[];
  const pedidos = (peds ?? []) as ClientRequest[];
  const pedidosAbertos = pedidos.filter((p) => p.status !== 'ok').length;
  const ultimos7 = (plat: 'google' | 'meta') => {
    const l = metricasAds.filter((a) => a.plataforma === plat && a.data >= addDays(hoje, -7));
    const gasto = l.reduce((t, a) => t + Number(a.investimento), 0);
    const conv = l.reduce((t, a) => t + Number(a.conversoes), 0);
    return { tem: l.length > 0, gasto, conv, cpa: conv ? gasto / conv : null };
  };
  const h = await headers();
  const resumo30 = (['google', 'meta'] as const)
    .map((plat) => {
      const l = metricasAds.filter((x) => x.plataforma === plat);
      return { plat, tem: l.length > 0, gasto: l.reduce((t, x) => t + Number(x.investimento), 0), conv: l.reduce((t, x) => t + Number(x.conversoes), 0) };
    })
    .filter((r) => r.tem);
  const porDia = [...new Set(metricasAds.map((x) => x.data))]
    .slice(0, 14)
    .map((data) => {
      const l = metricasAds.filter((x) => x.data === data);
      return { data, gasto: l.reduce((t, x) => t + Number(x.investimento), 0), cliques: l.reduce((t, x) => t + x.cliques, 0), conv: l.reduce((t, x) => t + Number(x.conversoes), 0) };
    });
  const linkPortal = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}/portal/${cliente.portal_token}`;

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
            { key: 'relatorios', label: 'Relatórios', href: `${base}?tab=relatorios`, count: relatorios.length },
            { key: 'anuncios', label: 'Anúncios', href: `${base}?tab=anuncios` },
            { key: 'portal', label: 'Portal', href: `${base}?tab=portal`, count: pedidosAbertos },
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
            <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
                <Card title="Tarefas abertas" aside={<a href={`${base}?tab=tarefas`} className="font-semibold text-brand">Ver todas</a>} flush>
                  {abertas.length ? (
                    abertas.slice(0, 6).map((t) => <TaskRow key={`${t.id}-${t.status}-${t.titulo}`} task={t} clientes={todos ?? []} hoje={hoje} semCliente resumo={resumos[t.id]} />)
                  ) : (
                    <Empty>Nenhuma tarefa aberta pra esse cliente.</Empty>
                  )}
                </Card>
                <Card title="Últimas cobranças" aside={<a href={`${base}?tab=cobrancas`} className="font-semibold text-brand">Ver todas</a>} flush>
                  <ChargeTable charges={cobrancas.slice(0, 4)} hoje={hoje} asaas={asaas} />
                </Card>
              </div>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
                {saude && (
                  <Card title="Saúde do cliente" aside={<Badge tone={NIVEL[saude.nivel].tone}>{NIVEL[saude.nivel].label}</Badge>}>
                    {saude.alertas.length ? (
                      <ul className="grid gap-1.5 text-[13px]">
                        {saude.alertas.map((a) => (
                          <li key={a.texto} className="flex gap-2">
                            <HeartPulse size={14} className={`mt-0.5 shrink-0 ${a.nivel === 'risco' ? 'text-danger' : 'text-warn'}`} />
                            {a.texto}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-muted">Tudo em dia com esse cliente.</p>
                    )}
                    <form action={registrarContato.bind(null, id)} className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                      <span className="flex-1 text-[12.5px] text-muted">Último contato: {cliente.ultimo_contato ? prazo(cliente.ultimo_contato, hoje) : 'nunca registrado'}</span>
                      <button className={btn.secondary}>Falei com ele hoje</button>
                    </form>
                  </Card>
                )}
                {(ultimos7('meta').tem || ultimos7('google').tem) && (
                  <Card title="Anúncios nos últimos 7 dias" aside={<a href={`${base}?tab=anuncios`} className="font-semibold text-brand">Detalhes</a>}>
                    <ul className="grid gap-2 text-[13px]">
                      {(['google', 'meta'] as const).filter((p) => ultimos7(p).tem).map((p) => {
                        const u = ultimos7(p);
                        return (
                          <li key={p} className="flex justify-between gap-3">
                            <span className="font-medium">{p === 'google' ? 'Google Ads' : 'Meta Ads'}</span>
                            <span className="text-right tabular-nums text-muted">
                              {brl(u.gasto)} · {Math.round(u.conv)} contato{Math.round(u.conv) === 1 ? '' : 's'}
                              {u.cpa ? ` · ${brl(u.cpa)} cada` : ''}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                )}
                {onboarding.length > 0 ? (
                  <Card title="Onboarding" aside={`${onbFeitas}/${onboarding.length}`}>
                    <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="bg-grad h-full" style={{ width: `${(onbFeitas / onboarding.length) * 100}%` }} />
                    </div>
                    {onboarding.map((t) => (
                      <RoutineToggle
                        key={`${t.id}-${t.status}`}
                        taskId={t.id}
                        label={t.titulo}
                        feito={t.status === 'done'}
                        sub={t.data ? prazo(t.data, hoje) : undefined}
                        atrasada={!!t.data && t.data < hoje}
                      />
                    ))}
                  </Card>
                ) : (
                  <Card title="Onboarding">
                    <p className="text-[13px] text-muted">Esse cliente ainda não tem o checklist de entrada.</p>
                    <form action={aplicarOnboarding.bind(null, id)} className="mt-3">
                      <button className={btn.secondary}>
                        <Rocket size={14} /> Criar checklist de onboarding
                      </button>
                    </form>
                  </Card>
                )}
                <Card title="Rotina da semana" aside={cliente.recorrentes ? undefined : 'Desligada'}>
                  {rotina.length ? (
                    rotina.map((t) => (
                      <RoutineToggle
                        key={`${t.id}-${t.status}`}
                        taskId={t.id}
                        label={t.titulo}
                        feito={t.status === 'done'}
                        sub={t.data ? prazo(t.data, hoje) : undefined}
                        atrasada={!!t.data && t.data < hoje}
                      />
                    ))
                  ) : (
                    <p className="text-[13px] text-muted">{cliente.recorrentes ? 'Nenhuma tarefa recorrente nesta semana.' : 'A rotina automática está desligada pra esse cliente.'}</p>
                  )}
                </Card>
                <Card title="Contrato">
                  {contratos.length ? (
                    contratos.map((ct) => (
                      <Link key={ct.id} href={`/contratos/${ct.id}`} className="flex items-center gap-2 text-[13px] hover:text-brand">
                        <FileSignature size={15} className="text-brand" />
                        <span className="flex-1 font-medium">Contrato Nº {numeroContrato(ct.numero)}</span>
                        <Badge tone={STATUS_CONTRATO[ct.status].tone}>{STATUS_CONTRATO[ct.status].label}</Badge>
                      </Link>
                    ))
                  ) : (
                    <p className="text-[13px] text-muted">Nenhum contrato ainda. Ele é gerado sozinho quando o cliente aceita a proposta, ou pelo botão abaixo.</p>
                  )}
                  {!contratos.some((ct) => ct.status === 'aguardando') && (
                    <Link href={`/contratos/novo?cliente=${cliente.id}`} className={`${btn.secondary} mt-3`}>
                      <FileSignature size={15} /> {contratos.some((ct) => ct.status === 'assinado') ? 'Gerar novo contrato' : 'Gerar contrato'}
                    </Link>
                  )}
                </Card>
                {cliente.servicos?.length > 0 && (
                  <Card title="Serviços contratados">
                    <ul className="grid gap-2 text-[13px]">
                      {cliente.servicos.map((sv, n) => (
                        <li key={n} className="flex justify-between gap-3">
                          <span className="font-medium">{sv.nome}</span>
                          <span className="whitespace-nowrap tabular-nums text-muted">
                            {brl(sv.valor, false)}
                            {sv.cobranca === 'mensal' ? '/mês' : ' único'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
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
            <ChargeTable charges={cobrancas} hoje={hoje} asaas={asaas} />
          </Card>
        )}

        {tab === 'tarefas' && <TaskGroups tasks={tarefas} clientes={todos ?? []} hoje={hoje} clientId={id} ocultarConcluidas resumos={resumos} />}

        {tab === 'relatorios' && (
          <Card
            flush
            title="Relatórios mensais"
            aside={
              <form action={novoRelatorio.bind(null, id)} className="flex items-center gap-2">
                <input type="month" name="competencia" defaultValue={mesPassado} aria-label="Mês" className="field w-auto py-1.5" />
                <button className={btn.primary}>
                  <Plus size={14} /> Criar relatório
                </button>
              </form>
            }
          >
            {relatorios.length ? (
              <ul className="divide-y divide-line">
                {relatorios.map((r) => {
                  const m = metricas(r);
                  return (
                    <li key={r.id}>
                      <Link href={`/relatorios/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                        <BarChart3 size={18} className="text-brand" />
                        <span className="min-w-0 flex-1 text-[13.5px] font-semibold">{formatMonth(r.competencia)}</span>
                        <span className="text-[12.5px] text-muted">
                          {m.conversoes ?? '—'} {r.conversao_nome.toLowerCase()} · {m.cpa ? `${brl(m.cpa)} cada` : 'sem custo'}
                        </span>
                        <Badge tone={r.status === 'enviado' ? 'success' : 'neutral'}>{r.status === 'enviado' ? 'Enviado' : 'Rascunho'}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>Nenhum relatório ainda. Escolha o mês e crie o primeiro, com link pro cliente e PDF.</Empty>
            )}
          </Card>
        )}

        {tab === 'anuncios' && (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <Card title="Contas de anúncio">
              <form action={salvarContas.bind(null, id)} className="grid gap-3">
                <Field label="ID da conta do Meta Ads">
                  <input name="meta_conta" defaultValue={cliente.meta_conta ?? ''} placeholder="Ex.: 123456789012345" inputMode="numeric" className="field" />
                </Field>
                <Field label="ID da conta do Google Ads">
                  <input name="google_conta" defaultValue={cliente.google_conta ?? ''} placeholder="Ex.: 123-456-7890" className="field" />
                </Field>
                <details className="text-[12.5px] text-muted">
                  <summary className="cursor-pointer">O que conta como contato no Meta</summary>
                  <p className="mt-2">Por padrão: conversas iniciadas (WhatsApp e Direct) e leads. Pra mudar, escreva os tipos separados por vírgula.</p>
                  <input name="meta_conversoes" defaultValue={cliente.meta_conversoes ?? ''} placeholder={CONVERSOES_META_PADRAO.join(', ')} className="field mt-2 text-[12px]" />
                </details>
                <div>
                  <button className={btn.primary}>Salvar contas</button>
                </div>
              </form>
              <div className="mt-4 grid gap-2 border-t border-line pt-4 text-[12.5px] text-muted">
                <p>
                  <strong className="text-ink">Meta:</strong> {metaConfigurado() ? 'conectado. Os números chegam toda madrugada.' : 'falta conectar (Configurações > Meta e Google).'}
                </p>
                <p>
                  <strong className="text-ink">Google:</strong> os números chegam pelo script do Google Ads (Configurações &gt; Meta e Google).
                </p>
                {metaConfigurado() && cliente.meta_conta && <SincronizarMeta />}
              </div>
            </Card>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
              {resumo30.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {resumo30.map((r) => (
                    <Kpi key={r.plat} label={`${r.plat === 'google' ? 'Google Ads' : 'Meta Ads'} · 30 dias`} value={brl(r.gasto)} hint={`${Math.round(r.conv)} contatos${r.conv ? ` · ${brl(r.gasto / r.conv)} cada` : ''}`} tone="brand" />
                  ))}
                </div>
              )}
              <Card flush title="Dia a dia (últimos 14 dias)">
                {porDia.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-[13px]">
                      <thead className="text-left text-[11.5px] uppercase tracking-wide text-muted">
                        <tr className="border-b border-line">
                          <th className="px-4 py-2 font-semibold">Dia</th>
                          <th className="px-2 py-2 text-right font-semibold">Investido</th>
                          <th className="px-2 py-2 text-right font-semibold">Cliques</th>
                          <th className="px-2 py-2 text-right font-semibold">Contatos</th>
                          <th className="px-4 py-2 text-right font-semibold">Custo/contato</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {porDia.map((d) => (
                          <tr key={d.data}>
                            <td className="px-4 py-2 tabular-nums">{formatShort(d.data)}</td>
                            <td className={`px-2 py-2 text-right tabular-nums ${d.gasto === 0 ? 'font-semibold text-danger' : ''}`}>{brl(d.gasto)}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{d.cliques}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{Math.round(d.conv)}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{d.conv ? brl(d.gasto / d.conv) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>Nenhum número ainda. Coloque o ID das contas ao lado e conecte o Meta e o Google em Configurações &gt; Meta e Google.</Empty>
                )}
              </Card>
            </div>
          </div>
        )}

        {tab === 'portal' && (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card
              flush
              title="O que preciso do cliente"
              aside={
                <form action={adicionarPedidosPadrao.bind(null, id)}>
                  <button className={btn.ghost}>
                    <ListPlus size={14} /> Lista padrão
                  </button>
                </form>
              }
            >
              {pedidos.length ? <Pedidos pedidos={pedidos} /> : <Empty>Nada pedido ainda. Use a lista padrão (acessos, logo, fotos) ou adicione um item abaixo.</Empty>}
              <form action={adicionarPedido.bind(null, id)} className="flex flex-wrap gap-2 border-t border-line p-4">
                <input name="titulo" required placeholder="Novo pedido (ex.: fotos da equipe)" className="field min-w-[180px] flex-1" />
                <input name="descricao" placeholder="Detalhe (opcional)" className="field min-w-[180px] flex-1" />
                <button className={btn.primary}>
                  <Plus size={14} /> Adicionar
                </button>
              </form>
            </Card>
            <Card title="Link do portal">
              <p className="mb-3 text-[13px] text-muted">Um link só pro cliente ver o que você precisa dele, pagar as faturas, abrir os relatórios e o contrato. Quando ele marca &quot;Já enviei&quot;, você recebe no celular.</p>
              <LinkAcoes
                link={linkPortal}
                semPdf
                whatsapp={(cliente.telefone ?? '').replace(/\D/g, '')}
                mensagem={`Oi, ${(cliente.responsavel ?? cliente.nome).split(' ')[0]}! Esse é o seu portal da Origo: lá ficam as faturas, os relatórios, o contrato e o que eu preciso de você pra começar. Salva aí: ${linkPortal}`}
              />
              <form action={novoLinkPortal.bind(null, id)} className="mt-3 border-t border-line pt-3">
                <button className={btn.ghost}>
                  <RefreshCcw size={13} /> Gerar link novo (o antigo para de funcionar)
                </button>
              </form>
            </Card>
          </div>
        )}

        {tab === 'dados' && (
          <Card title="Dados cadastrais">
            <form action={saveClient.bind(null, id)} className="grid gap-4">
              <ClientFields c={cliente} />
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" name="ativo" defaultChecked={cliente.ativo} className="size-4 accent-[var(--brand)]" /> Cliente ativo
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" name="recorrentes" defaultChecked={cliente.recorrentes} className="size-4 accent-[var(--brand)]" /> Criar as tarefas recorrentes (rotina de tráfego) pra esse cliente
              </label>
              <div>
                <button className={btn.primary}>Salvar alterações</button>
              </div>
            </form>
          </Card>
        )}
        {tab === 'dados' && (
          <Card title="Excluir cliente">
            <p className="mb-3 text-[13px] text-muted">Pra testes ou cadastro errado. Apaga o cliente com cobranças, tarefas, contratos e relatórios. Se ele só parou, desmarque &quot;Cliente ativo&quot; acima.</p>
            <ExcluirCliente id={id} nome={cliente.nome} />
          </Card>
        )}
      </Body>
    </>
  );
}

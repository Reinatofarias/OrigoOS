import Link from 'next/link';
import { Building2, TrendingUp, Wallet, UserPlus, Target } from 'lucide-react';
import { db, type Charge, type Client, type Expense } from '@/lib/db';
import { addMonths, formatMonth, monthRange, today } from '@/lib/dates';
import { brl } from '@/lib/format';
import { lerMetas } from '@/lib/metas';
import { Body, Card, Kpi, PageHeader } from '@/components/ui';
import FormDialog, { Field } from '@/components/dialog';
import { salvarMetas } from '@/app/actions';

function Anel({ pct, children }: { pct: number; children: React.ReactNode }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[132px] shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <defs>
          <linearGradient id="anel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22c7ff" />
            <stop offset="0.5" stopColor="#6a4cff" />
            <stop offset="1" stopColor="#e340c8" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="11" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="url(#anel)" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(Math.min(pct, 100) / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

function Barra({ pct }: { pct: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
      <div className="bg-grad h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

function mesesAte(de: string, ate: string) {
  const [y1, m1] = de.split('-').map(Number);
  const [y2, m2] = ate.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

export default async function MetasPage() {
  const hoje = today();
  const mes = hoje.slice(0, 7);
  const meses = Array.from({ length: 6 }, (_, i) => addMonths(mes, i - 5));
  const inicio = monthRange(meses[0]).start;
  const fim = monthRange(mes).end;
  const supa = db();
  const [metas, { data: cs }, { data: ch }, { data: ex }, { data: ls }] = await Promise.all([
    lerMetas(supa),
    supa.from('clients').select('id, ativo, mensalidade'),
    supa.from('charges').select('valor, status, vencimento').gte('vencimento', inicio).lte('vencimento', fim),
    supa.from('expenses').select('valor, data').gte('data', inicio).lte('data', fim),
    supa.from('leads').select('status, valor'),
  ]);
  const clientes = (cs ?? []) as Pick<Client, 'id' | 'ativo' | 'mensalidade'>[];
  const cobrancas = (ch ?? []) as Pick<Charge, 'valor' | 'status' | 'vencimento'>[];
  const despesas = (ex ?? []) as Pick<Expense, 'valor' | 'data'>[];
  const leads = ls ?? [];

  const ativos = clientes.filter((c) => c.ativo);
  const faltam = Math.max(0, metas.clientes - ativos.length);
  const mrr = ativos.reduce((s, c) => s + Number(c.mensalidade ?? 0), 0);
  const comValor = ativos.filter((c) => Number(c.mensalidade) > 0);
  const ticket = comValor.length ? mrr / comValor.length : 2000;

  const serie = meses.map((m) => {
    const receita = cobrancas.filter((c) => c.status === 'pago' && c.vencimento.startsWith(m)).reduce((s, c) => s + Number(c.valor), 0);
    const gasto = despesas.filter((d) => d.data.startsWith(m)).reduce((s, d) => s + Number(d.valor), 0);
    return { m, receita, gasto, lucro: receita - gasto };
  });
  const atual = serie[serie.length - 1];
  const fechados = serie.slice(2, 5); // os 3 meses antes do atual
  const despesaMedia = fechados.some((x) => x.gasto) ? fechados.reduce((s, x) => s + x.gasto, 0) / 3 : atual.gasto;
  const lucroPrevisto = mrr - despesaMedia;
  const margem = mrr ? Math.round((lucroPrevisto / mrr) * 100) : 0;
  const maior = Math.max(1, ...serie.flatMap((x) => [x.receita, x.gasto]));

  const folga = metas.custo_contratacao * 1.5;
  const prontoPraContratar = lucroPrevisto >= folga && metas.custo_contratacao > 0;
  const clientesPraContratar = Math.max(0, Math.ceil((folga - lucroPrevisto) / ticket));

  const ganhos = leads.filter((l) => l.status === 'fechou').length;
  const perdidos = leads.filter((l) => l.status === 'perdido').length;
  const abertos = leads.filter((l) => !['fechou', 'perdido'].includes(l.status));
  const conversao = ganhos + perdidos >= 3 ? ganhos / (ganhos + perdidos) : null;
  const leadsNecessarios = conversao ? Math.ceil(faltam / conversao) : null;
  const mesesRestantes = metas.prazo ? Math.max(1, mesesAte(mes, metas.prazo.slice(0, 7))) : null;
  const porMes = mesesRestantes ? Math.ceil(faltam / mesesRestantes) : null;

  return (
    <>
      <PageHeader title="Metas e lucro" subtitle="Onde a Origo está e quanto falta pra crescer">
        <FormDialog label="Editar metas" title="Metas da Origo" action={salvarMetas} variant="secondary">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Meta de clientes">
              <input name="clientes" type="number" min={1} defaultValue={metas.clientes} className="field" />
            </Field>
            <Field label="Meta de receita mensal (R$)">
              <input name="receita" inputMode="decimal" defaultValue={metas.receita} className="field" />
            </Field>
            <Field label="Custo mensal da 1ª contratação (R$)">
              <input name="custo_contratacao" inputMode="decimal" defaultValue={metas.custo_contratacao} className="field" />
            </Field>
            <Field label="Prazo pra bater a meta">
              <input name="prazo" type="date" defaultValue={metas.prazo ?? ''} className="field" />
            </Field>
          </div>
        </FormDialog>
      </PageHeader>
      <Body>
        <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section className="relative overflow-hidden rounded-xl bg-sidebar p-6 text-white">
            <div className="bg-grad pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-25 blur-3xl" />
            <div className="relative flex flex-wrap items-center gap-6">
              <Anel pct={(ativos.length / metas.clientes) * 100}>
                <span>
                  <span className="block text-[30px] font-bold leading-none">{ativos.length}</span>
                  <span className="text-[12px] text-sidebar-ink">de {metas.clientes}</span>
                </span>
              </Anel>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sidebar-ink">Meta de clientes</p>
                <p className="mt-1 text-[24px] font-bold leading-tight">
                  {faltam ? (
                    <>
                      Faltam <span className="text-grad">{faltam} clientes</span>
                    </>
                  ) : (
                    <span className="text-grad">Meta batida!</span>
                  )}
                </p>
                <p className="mt-1.5 text-[13.5px] text-sidebar-ink">
                  {porMes
                    ? `Até ${formatMonth(metas.prazo!.slice(0, 7)).toLowerCase()}: ${porMes} cliente${porMes > 1 ? 's' : ''} novo${porMes > 1 ? 's' : ''} por mês.`
                    : 'Defina um prazo em "Editar metas" pra ver o ritmo por mês.'}
                </p>
                {leadsNecessarios !== null && faltam > 0 && (
                  <p className="mt-1 text-[13.5px] text-sidebar-ink">
                    Com sua conversão de {Math.round(conversao! * 100)}%, são uns <strong className="text-white">{leadsNecessarios} negócios</strong> no funil pra chegar lá.
                  </p>
                )}
              </div>
            </div>
          </section>

          <Card title="Pronto pra contratar?">
            <p className={`text-[20px] font-bold ${prontoPraContratar ? 'text-success' : 'text-warn'}`}>{prontoPraContratar ? 'Sim, com folga.' : 'Ainda não.'}</p>
            <p className="mt-1 text-[13.5px] text-muted">
              Pra contratar alguém de {brl(metas.custo_contratacao, false)} por mês com segurança, o lucro precisa ficar perto de {brl(folga, false)} (o custo mais 50% de folga). A previsão hoje é{' '}
              <strong className="text-ink">{brl(lucroPrevisto, false)}</strong>.
            </p>
            <div className="mt-3">
              <Barra pct={folga ? (lucroPrevisto / folga) * 100 : 0} />
            </div>
            {!prontoPraContratar && clientesPraContratar > 0 && (
              <p className="mt-2 text-[13px]">
                Faltam uns <strong>{clientesPraContratar} clientes</strong> no seu ticket médio de {brl(ticket, false)}.
              </p>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Receita recorrente (MRR)" value={brl(mrr, false)} hint={`Meta ${brl(metas.receita, false)}`} tone="brand" icon={<TrendingUp size={16} />} />
          <Kpi label="Ticket médio" value={brl(ticket, false)} hint={`${comValor.length} cliente(s) com mensalidade`} icon={<Building2 size={16} />} />
          <Kpi label="Lucro previsto por mês" value={brl(lucroPrevisto, false)} hint={`Margem de ${margem}%`} tone={lucroPrevisto >= 0 ? 'success' : 'danger'} icon={<Wallet size={16} />} />
          <Kpi label="Negócios em aberto" value={abertos.length} hint={`${brl(abertos.reduce((s, l) => s + Number(l.valor ?? 0), 0), false)}/mês em jogo`} icon={<UserPlus size={16} />} />
        </div>

        <Card title="Receita recorrente x meta" aside={`${metas.receita ? Math.round((mrr / metas.receita) * 100) : 0}%`}>
          <Barra pct={metas.receita ? (mrr / metas.receita) * 100 : 0} />
          <p className="mt-2 text-[13px] text-muted">
            {mrr >= metas.receita ? 'Meta de receita batida.' : `Faltam ${brl(metas.receita - mrr, false)} por mês, ou uns ${Math.ceil((metas.receita - mrr) / ticket)} clientes no ticket médio.`}
            {comValor.length < ativos.length && (
              <>
                {' '}
                <Link href="/clientes" className="font-semibold text-brand">
                  {ativos.length - comValor.length} cliente(s) estão sem mensalidade cadastrada
                </Link>
                .
              </>
            )}
          </p>
        </Card>

        <Card title="Últimos 6 meses" aside={<span className="flex gap-3"><span className="flex items-center gap-1"><span className="size-2 rounded-full bg-success" />Recebido</span><span className="flex items-center gap-1"><span className="size-2 rounded-full bg-danger" />Despesas</span></span>}>
          <div className="grid grid-cols-6 gap-2">
            {serie.map((x) => (
              <div key={x.m} className="grid gap-2 text-center">
                <div className="flex h-40 items-end justify-center gap-1.5 rounded-lg bg-surface-2/50 px-2 pt-2">
                  <div className="w-1/3 max-w-6 rounded-t bg-success" style={{ height: `${(x.receita / maior) * 100}%` }} title={`Recebido ${brl(x.receita)}`} />
                  <div className="w-1/3 max-w-6 rounded-t bg-danger/80" style={{ height: `${(x.gasto / maior) * 100}%` }} title={`Despesas ${brl(x.gasto)}`} />
                </div>
                <div>
                  <p className="text-[12px] font-semibold capitalize">{formatMonth(x.m).split(' ')[0].slice(0, 3)}</p>
                  <p className={`text-[11.5px] tabular-nums ${x.lucro < 0 ? 'text-danger' : 'text-muted'}`}>{brl(x.lucro, false)}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] text-muted">
            Lucro do mês = cobranças recebidas menos despesas lançadas no Financeiro. Em {formatMonth(mes).toLowerCase()}: {brl(atual.receita)} recebidos, {brl(atual.gasto)} de despesas.
          </p>
        </Card>

        <p className="flex items-center gap-2 text-[12.5px] text-muted">
          <Target size={14} /> A previsão usa a soma das mensalidades dos clientes ativos menos a média de despesas dos últimos 3 meses.
        </p>
      </Body>
    </>
  );
}

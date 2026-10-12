import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db, type Charge, type Expense } from '@/lib/db';
import { addMonths, formatMonth, formatShort, monthRange, today } from '@/lib/dates';
import { CATEGORIAS, brl, situacao } from '@/lib/format';
import { Body, Card, Empty, Kpi, PageHeader } from '@/components/ui';
import { ChargeTable } from '@/components/charges';
import FormDialog, { Field } from '@/components/dialog';
import { GenerateButton, DeleteExpense } from './buttons';
import { addExpense } from '@/app/actions';

export default async function FinanceiroPage({ searchParams }: PageProps<'/financeiro'>) {
  const sp = await searchParams;
  const hoje = today();
  const ym = typeof sp.m === 'string' && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : hoje.slice(0, 7);
  const { start, end } = monthRange(ym);
  const supa = db();
  const [{ data: ch, error }, { data: ex }, { data: cs }] = await Promise.all([
    supa.from('charges').select('*').gte('vencimento', start).lte('vencimento', end).order('vencimento'),
    supa.from('expenses').select('*').gte('data', start).lte('data', end).order('data'),
    supa.from('clients').select('id, nome, ativo, mensalidade'),
  ]);
  const cobrancas = ((ch ?? []) as Charge[]).filter((c) => c.status !== 'cancelado');
  const despesas = (ex ?? []) as Expense[];
  const nomes = Object.fromEntries((cs ?? []).map((c) => [c.id, c.nome]));
  const soma = (xs: { valor: number }[]) => xs.reduce((s, x) => s + Number(x.valor), 0);

  const previsto = soma(cobrancas);
  const recebido = soma(cobrancas.filter((c) => c.status === 'pago'));
  const aReceber = soma(cobrancas.filter((c) => situacao(c, hoje) === 'pendente'));
  const vencido = soma(cobrancas.filter((c) => situacao(c, hoje) === 'vencido'));
  const gastos = soma(despesas);
  const resultado = recebido - gastos;
  const comMensalidade = new Set(cobrancas.filter((c) => c.competencia === ym).map((c) => c.client_id));
  const faltam = (cs ?? []).filter((c) => c.ativo && Number(c.mensalidade) > 0 && !comMensalidade.has(c.id)).length;
  const pct = previsto ? Math.round((recebido / previsto) * 100) : 0;

  return (
    <>
      <PageHeader title="Financeiro" subtitle="Cobranças, recebimentos e despesas da Origo">
        <div className="flex items-center rounded-lg border border-line bg-surface">
          <Link href={`/financeiro?m=${addMonths(ym, -1)}`} aria-label="Mês anterior" className="p-2 text-muted hover:text-ink">
            <ChevronLeft size={16} />
          </Link>
          <span className="min-w-[132px] text-center text-[13px] font-semibold">{formatMonth(ym)}</span>
          <Link href={`/financeiro?m=${addMonths(ym, 1)}`} aria-label="Próximo mês" className="p-2 text-muted hover:text-ink">
            <ChevronRight size={16} />
          </Link>
        </div>
        {faltam > 0 && <GenerateButton ym={ym} faltam={faltam} />}
      </PageHeader>
      <Body>
        {error && <p className="rounded-xl bg-danger-soft p-4 text-[13px] text-danger">Não consegui ler o banco: {error.message}</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Previsto no mês" value={brl(previsto)} hint={`${cobrancas.length} cobranças`} />
          <Kpi label="Recebido" value={brl(recebido)} tone="success" hint={`${pct}% do previsto`} />
          <Kpi label="A receber" value={brl(aReceber)} tone="warn" />
          <Kpi label="Vencido" value={brl(vencido)} tone={vencido ? 'danger' : undefined} />
          <Kpi label="Resultado" value={brl(resultado)} tone={resultado >= 0 ? 'brand' : 'danger'} hint={`Despesas ${brl(gastos)}`} />
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-label={`${pct}% recebido`}>
          <div className="bg-grad h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>

        <Card flush title={`Cobranças de ${formatMonth(ym).toLowerCase()}`} aside={faltam > 0 ? `${faltam} cliente(s) sem mensalidade gerada` : 'Mensalidades geradas'}>
          <ChargeTable charges={cobrancas} hoje={hoje} nomes={nomes} />
        </Card>

        <Card
          flush
          title="Despesas"
          aside={
            <FormDialog label="Despesa" title="Nova despesa" action={addExpense} variant="secondary">
              <Field label="Descrição *">
                <input name="descricao" required className="field" placeholder="Ex.: Assinatura do Canva" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Valor (R$) *">
                  <input name="valor" required inputMode="decimal" className="field" />
                </Field>
                <Field label="Data">
                  <input name="data" type="date" defaultValue={ym === hoje.slice(0, 7) ? hoje : start} className="field" />
                </Field>
                <Field label="Categoria">
                  <select name="categoria" className="field">
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>
                        {c[0].toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </FormDialog>
          }
        >
          {despesas.length ? (
            <table className="w-full text-left text-[13px]">
              <tbody>
                {despesas.map((d) => (
                  <tr key={d.id} className="group border-b border-line last:border-b-0 hover:bg-surface-2/60">
                    <td className="px-4 py-2.5 font-medium">{d.descricao}</td>
                    <td className="px-4 py-2.5 capitalize text-muted">{d.categoria}</td>
                    <td className="px-4 py-2.5 text-muted">{formatShort(d.data)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-danger">- {brl(d.valor)}</td>
                    <td className="w-10 pr-2">
                      <DeleteExpense id={d.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Nenhuma despesa lançada nesse mês.</Empty>
          )}
        </Card>
      </Body>
    </>
  );
}

import Link from 'next/link';
import { ExcluirCliente } from '@/components/excluir-cliente';
import { ChevronRight, FileSignature } from 'lucide-react';
import { db, type Charge, type Client } from '@/lib/db';
import { monthRange, today } from '@/lib/dates';
import { brl, situacao } from '@/lib/format';
import { PLATAFORMA } from '@/lib/rotina';
import { Avatar, Badge, Body, Card, Empty, Kpi, PageHeader, btn } from '@/components/ui';
import FormDialog from '@/components/dialog';
import ClientFields from '@/components/client-form';
import { addClient } from '@/app/actions';

export default async function ClientesPage() {
  const hoje = today();
  const { start, end } = monthRange(hoje.slice(0, 7));
  const supa = db();
  const [{ data: cs, error }, { data: ch }, { data: ts }] = await Promise.all([
    supa.from('clients').select('*').order('nome'),
    supa.from('charges').select('*').or(`and(vencimento.gte.${start},vencimento.lte.${end}),and(status.eq.pendente,vencimento.lt.${start})`),
    supa.from('tasks').select('client_id').neq('status', 'done').not('client_id', 'is', null),
  ]);
  const clientes = (cs ?? []) as Client[];
  const cobrancas = (ch ?? []) as Charge[];
  const ativos = clientes.filter((c) => c.ativo);
  const inativos = clientes.filter((c) => !c.ativo);

  const doMes = cobrancas.filter((c) => c.vencimento >= start && c.status !== 'cancelado');
  const recebido = doMes.filter((c) => c.status === 'pago').reduce((s, c) => s + Number(c.valor), 0);
  const aReceber = doMes.filter((c) => situacao(c, hoje) === 'pendente').reduce((s, c) => s + Number(c.valor), 0);
  const vencido = cobrancas.filter((c) => situacao(c, hoje) === 'vencido').reduce((s, c) => s + Number(c.valor), 0);
  const mrr = ativos.reduce((s, c) => s + Number(c.mensalidade ?? 0), 0);
  const tarefas = (ts ?? []).reduce<Record<string, number>>((m, t) => ({ ...m, [t.client_id]: (m[t.client_id] ?? 0) + 1 }), {});

  function status(c: Client) {
    const minhas = cobrancas.filter((x) => x.client_id === c.id);
    if (minhas.some((x) => situacao(x, hoje) === 'vencido')) return <Badge tone="danger">Vencida</Badge>;
    const mes = minhas.find((x) => x.vencimento >= start && x.status !== 'cancelado');
    if (!mes) return <Badge>Sem cobrança no mês</Badge>;
    return mes.status === 'pago' ? <Badge tone="success">Em dia</Badge> : <Badge tone="warn">Aguardando pagamento</Badge>;
  }

  return (
    <>
      <PageHeader title="Clientes" subtitle={`${ativos.length} ativos`}>
        <Link href="/contratos" className={btn.secondary}>
          <FileSignature size={15} /> Contratos
        </Link>
        <FormDialog label="Novo cliente" title="Novo cliente" action={addClient}>
          <ClientFields />
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" name="onboarding" defaultChecked className="size-4 accent-[var(--brand)]" /> Criar o checklist de onboarding
          </label>
        </FormDialog>
      </PageHeader>
      <Body>
        {error && <p className="rounded-xl bg-danger-soft p-4 text-[13px] text-danger">Não consegui ler o banco: {error.message}</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Receita recorrente" value={brl(mrr, false)} hint={`${ativos.length} clientes ativos`} tone="brand" />
          <Kpi label="Recebido no mês" value={brl(recebido)} tone="success" />
          <Kpi label="A receber no mês" value={brl(aReceber)} tone="warn" />
          <Kpi label="Vencido" value={brl(vencido)} tone={vencido ? 'danger' : undefined} hint={vencido ? 'Cobrar hoje' : 'Nada vencido'} />
        </div>

        <Card flush title="Carteira de clientes" aside={`Faltam ${Math.max(0, 15 - ativos.length)} para a meta de 15`}>
          {clientes.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <thead className="border-b border-line bg-surface-2/50 text-[11.5px] text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Cliente</th>
                    <th className="px-4 py-2 font-medium">Serviço</th>
                    <th className="px-4 py-2 text-right font-medium">Mensalidade</th>
                    <th className="px-4 py-2 font-medium">Vence dia</th>
                    <th className="px-4 py-2 font-medium">Situação</th>
                    <th className="px-4 py-2 font-medium">Tarefas</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {[...ativos, ...inativos].map((c) => (
                    <tr key={c.id} className={`border-b border-line last:border-b-0 hover:bg-surface-2/60 ${c.ativo ? '' : 'opacity-55'}`}>
                      <td className="px-4 py-2.5">
                        <Link href={`/clientes/${c.id}`} className="flex items-center gap-3">
                          <Avatar nome={c.nome} />
                          <span className="min-w-0">
                            <span className="block font-semibold hover:text-brand">{c.nome}</span>
                            <span className="block text-[12px] text-muted">{[c.segmento, c.cidade].filter(Boolean).join(' · ')}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">{PLATAFORMA[c.plataforma]}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{c.mensalidade ? brl(c.mensalidade) : '—'}</td>
                      <td className="px-4 py-2.5">{c.dia_vencimento}</td>
                      <td className="px-4 py-2.5">{c.ativo ? status(c) : <Badge>Inativo</Badge>}</td>
                      <td className="px-4 py-2.5 text-muted">{tarefas[c.id] ? `${tarefas[c.id]} abertas` : '—'}</td>
                      <td className="pr-3">
                        <span className="flex items-center justify-end gap-1">
                          <ExcluirCliente id={c.id} nome={c.nome} compacto />
                          <Link href={`/clientes/${c.id}`} aria-label={`Abrir ${c.nome}`} className="text-faint hover:text-ink">
                            <ChevronRight size={16} />
                          </Link>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Nenhum cliente cadastrado ainda.</Empty>
          )}
        </Card>
      </Body>
    </>
  );
}

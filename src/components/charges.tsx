'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, RotateCcw, Trash2, Ban } from 'lucide-react';
import { deleteCharge, setChargeStatus } from '@/app/actions';
import type { Charge } from '@/lib/db';
import { FORMA, SITUACAO, brl, situacao } from '@/lib/format';
import { formatShort } from '@/lib/dates';
import { Badge, Empty } from './ui';

function Acoes({ c }: { c: Charge }) {
  const [forma, setForma] = useState<NonNullable<Charge['forma']>>('pix');
  const [pending, start] = useTransition();
  if (c.status === 'pago' || c.status === 'cancelado') {
    return (
      <span className={`flex items-center justify-end gap-1 ${pending ? 'opacity-60' : ''}`}>
        {c.status === 'pago' && c.forma && <span className="mr-1 text-[12px] text-muted">{FORMA[c.forma]}</span>}
        <button type="button" title="Voltar para aguardando" onClick={() => start(() => setChargeStatus(c.id, 'pendente'))} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink">
          <RotateCcw size={14} />
        </button>
      </span>
    );
  }
  return (
    <span className={`flex items-center justify-end gap-1 ${pending ? 'opacity-60' : ''}`}>
      <select aria-label="Forma de pagamento" value={forma} onChange={(e) => setForma(e.target.value as typeof forma)} className="cell-input fit">
        {Object.entries(FORMA).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => start(() => setChargeStatus(c.id, 'pago', forma))}
        className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-1 text-[12px] font-semibold text-success hover:opacity-80"
      >
        <CheckCircle2 size={13} /> Recebi
      </button>
      <button type="button" title="Cancelar cobrança" onClick={() => start(() => setChargeStatus(c.id, 'cancelado'))} className="rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-ink">
        <Ban size={14} />
      </button>
      <button
        type="button"
        title="Apagar cobrança"
        onClick={() => confirm('Apagar esta cobrança?') && start(() => deleteCharge(c.id))}
        className="rounded-md p-1.5 text-faint hover:bg-danger-soft hover:text-danger"
      >
        <Trash2 size={14} />
      </button>
    </span>
  );
}

export function ChargeTable({ charges, hoje, nomes }: { charges: Charge[]; hoje: string; nomes?: Record<string, string> }) {
  if (!charges.length) return <Empty>Nenhuma cobrança nesse período.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead className="border-b border-line bg-surface-2/50 text-[11.5px] text-muted">
          <tr>
            {nomes && <th className="px-4 py-2 font-medium">Cliente</th>}
            <th className="px-4 py-2 font-medium">Descrição</th>
            <th className="px-4 py-2 font-medium">Vencimento</th>
            <th className="px-4 py-2 text-right font-medium">Valor</th>
            <th className="px-4 py-2 font-medium">Situação</th>
            <th className="px-4 py-2 text-right font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {charges.map((c) => {
            const s = situacao(c, hoje);
            return (
              <tr key={c.id} className="border-b border-line last:border-b-0 hover:bg-surface-2/60">
                {nomes && (
                  <td className="px-4 py-2.5 font-semibold">
                    <Link href={`/clientes/${c.client_id}?tab=cobrancas`} className="hover:text-brand">
                      {nomes[c.client_id] ?? '—'}
                    </Link>
                  </td>
                )}
                <td className="px-4 py-2.5">{c.descricao}</td>
                <td className={`px-4 py-2.5 ${s === 'vencido' ? 'font-semibold text-danger' : ''}`}>{formatShort(c.vencimento)}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{brl(c.valor)}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={SITUACAO[s].tone}>{SITUACAO[s].label}</Badge>
                  {c.pago_em && <span className="ml-1.5 text-[11.5px] text-muted">em {formatShort(c.pago_em)}</span>}
                </td>
                <td className="px-4 py-2.5">
                  <Acoes c={c} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

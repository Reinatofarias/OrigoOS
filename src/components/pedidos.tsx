'use client';

import { useTransition } from 'react';
import { Check, RotateCcw, Trash2 } from 'lucide-react';
import { excluirPedido, setPedidoStatus } from '@/app/acoes/clientes';
import type { ClientRequest } from '@/lib/db';
import { STATUS_PEDIDO } from '@/lib/pedidos';
import { Badge } from './ui';

function Linha({ p }: { p: ClientRequest }) {
  const [pending, start] = useTransition();
  return (
    <li className={`flex flex-wrap items-start gap-3 px-4 py-3 ${pending ? 'opacity-50' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className={`text-[13.5px] font-semibold ${p.status === 'ok' ? 'text-muted line-through' : ''}`}>{p.titulo}</p>
        {p.descricao && <p className="text-[12.5px] text-muted">{p.descricao}</p>}
        {p.resposta && <p className="mt-1 rounded-md bg-info-soft px-2 py-1 text-[12.5px] text-info">Cliente: {p.resposta}</p>}
      </div>
      <Badge tone={STATUS_PEDIDO[p.status].tone}>{STATUS_PEDIDO[p.status].label}</Badge>
      <div className="flex gap-1">
        {p.status !== 'ok' ? (
          <button type="button" onClick={() => start(() => setPedidoStatus(p.id, 'ok'))} title="Recebi, tudo certo" aria-label="Marcar como concluído" className="grid size-8 place-items-center rounded-lg text-success hover:bg-success-soft">
            <Check size={16} />
          </button>
        ) : null}
        {p.status !== 'pendente' && (
          <button type="button" onClick={() => start(() => setPedidoStatus(p.id, 'pendente'))} title="Voltar pra pendente (faltou algo)" aria-label="Voltar pra pendente" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2">
            <RotateCcw size={15} />
          </button>
        )}
        <button type="button" onClick={() => confirm('Apagar este pedido?') && start(() => excluirPedido(p.id))} aria-label="Apagar" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger">
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}

export default function Pedidos({ pedidos }: { pedidos: ClientRequest[] }) {
  return (
    <ul className="divide-y divide-line">
      {pedidos.map((p) => (
        <Linha key={`${p.id}-${p.status}`} p={p} />
      ))}
    </ul>
  );
}

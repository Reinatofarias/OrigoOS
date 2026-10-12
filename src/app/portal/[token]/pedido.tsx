'use client';

import { useActionState, useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { responderPedido } from '@/app/acoes/portal';
import type { ClientRequest } from '@/lib/db';

export default function PedidoItem({ token, pedido }: { token: string; pedido: ClientRequest }) {
  const [state, action, pending] = useActionState(responderPedido.bind(null, token, pedido.id), null);
  const [aberto, setAberto] = useState(false);
  const enviado = pedido.status === 'enviado' || state?.ok;
  return (
    <li className="rounded-xl border border-[#e5e7f0] p-4">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${enviado ? 'bg-[#e7f7ef] text-[#0f7a50]' : 'bg-[#fff4e0] text-[#a5650a]'}`}>
          {enviado ? <Check size={14} /> : <Clock size={13} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold text-[#14152e]">{pedido.titulo}</p>
          {pedido.descricao && <p className="mt-0.5 text-[13px] leading-relaxed text-[#6b6e8a]">{pedido.descricao}</p>}
          {enviado ? (
            <p className="mt-2 text-[13px] font-medium text-[#0f7a50]">Enviado. Obrigado! Vou conferir e te aviso se faltar algo.</p>
          ) : aberto ? (
            <form action={action} className="mt-3 grid gap-2">
              <textarea
                name="resposta"
                rows={2}
                maxLength={2000}
                placeholder="Opcional: link da pasta, e-mail usado ou um recado"
                className="w-full rounded-xl border border-[#d9dbe8] px-3 py-2 text-[14px] text-[#14152e] outline-none focus:border-[#6a4cff]"
              />
              {state?.erro && <p className="text-[13px] text-[#b4232c]">{state.erro}</p>}
              <div className="flex gap-2">
                <button disabled={pending} className="bg-grad rounded-lg px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-60">
                  {pending ? 'Enviando…' : 'Confirmar envio'}
                </button>
                <button type="button" onClick={() => setAberto(false)} className="rounded-lg px-3 py-2 text-[13.5px] text-[#6b6e8a]">
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setAberto(true)} className="mt-3 rounded-lg border border-[#d9dbe8] px-3.5 py-2 text-[13.5px] font-semibold text-[#14152e] hover:border-[#6a4cff]">
              Já enviei
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

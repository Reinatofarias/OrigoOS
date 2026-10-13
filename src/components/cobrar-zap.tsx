'use client';

import { useTransition } from 'react';
import { MessageCircle } from 'lucide-react';
import type { Charge } from '@/lib/db';
import { linkCobranca, type ContatoCliente } from '@/lib/cobranca-zap';
import { registrarContato } from '@/app/acoes/clientes';

// Abre o WhatsApp do cliente com a mensagem de cobrança pronta e já marca o contato de hoje.
export function CobrarZap({ c, cliente, hoje, compacto }: { c: Charge; cliente: ContatoCliente; hoje: string; compacto?: boolean }) {
  const [, start] = useTransition();
  if (c.status !== 'pendente') return null;
  return (
    <a
      href={linkCobranca(c, cliente, hoje)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => start(() => registrarContato(c.client_id))}
      title={cliente.telefone ? 'Cobrar no WhatsApp (mensagem pronta)' : 'Cobrar no WhatsApp (cliente sem telefone: escolha o contato)'}
      aria-label={`Cobrar ${cliente.nome} no WhatsApp`}
      className={
        compacto
          ? 'grid size-8 shrink-0 place-items-center rounded-lg text-wa hover:bg-success-soft'
          : 'inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-1 text-[12px] font-semibold text-wa hover:opacity-80'
      }
    >
      <MessageCircle size={compacto ? 16 : 13} />
      {!compacto && 'Cobrar'}
    </a>
  );
}

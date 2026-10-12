'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { MessageCircle, Reply, Send } from 'lucide-react';
import { markSent, setLeadStatus } from '@/app/actions';
import type { Lead } from '@/lib/db';
import type { Passo } from '@/lib/prospeccao';
import { Avatar, Badge } from './ui';

export type LinhaProspeccao = Pick<Lead, 'id' | 'nome' | 'whatsapp' | 'status'> & { sub: string; passo: Passo | null; texto: string | null };

// Um toque: abre o WhatsApp com a mensagem pronta e já marca como enviada (o lead some da lista de hoje).
function Linha({ l }: { l: LinhaProspeccao }) {
  const [pending, start] = useTransition();
  const naCadencia = ['m1', 'm2', 'm3', 'm4'].includes(l.status);
  return (
    <li className={`flex items-center gap-3 py-2.5 ${pending ? 'opacity-50' : ''}`}>
      <Avatar nome={l.nome} size={30} />
      <Link href={`/comercial/${l.id}`} className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold hover:text-brand">{l.nome}</span>
        <span className="block truncate text-[12px] text-muted">{l.sub}</span>
      </Link>
      {naCadencia && (
        <button
          type="button"
          onClick={() => start(() => setLeadStatus(l.id, 'respondeu'))}
          title="Respondeu: tira da cadência e marca pra retornar"
          aria-label={`${l.nome} respondeu`}
          className="hidden items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-muted hover:bg-surface-2 hover:text-ink sm:inline-flex"
        >
          <Reply size={14} /> Respondeu
        </button>
      )}
      {l.passo && l.whatsapp && l.texto ? (
        <a
          href={`https://wa.me/${l.whatsapp}?text=${encodeURIComponent(l.texto)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => start(() => markSent(l.id, l.passo!))}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-wa px-2.5 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90"
        >
          <Send size={13} /> Mandar {l.passo.toUpperCase()}
        </a>
      ) : l.passo ? (
        <Link href={`/comercial/${l.id}`}>
          <Badge tone={l.status === 'novo' ? 'info' : 'warn'}>Mandar {l.passo.toUpperCase()}</Badge>
        </Link>
      ) : (
        <>
          <Badge tone="brand">Retornar</Badge>
          {l.whatsapp && (
            <a href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${l.nome}`} className="grid size-8 place-items-center rounded-lg text-wa hover:bg-success-soft">
              <MessageCircle size={16} />
            </a>
          )}
        </>
      )}
    </li>
  );
}

export default function ProspeccaoHoje({ leads }: { leads: LinhaProspeccao[] }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] divide-y divide-line">
      {leads.map((l) => (
        <Linha key={l.id} l={l} />
      ))}
    </ul>
  );
}

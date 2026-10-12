'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, MessageCircle, MapPin } from 'lucide-react';
import { setLeadStatus } from '@/app/actions';
import type { Lead, LeadStatus } from '@/lib/db';
import { ETAPAS, NICHO, etapaDe, type Etapa } from '@/lib/prospeccao';
import { brl } from '@/lib/format';
import { prazo } from '@/lib/dates';

function destino(lead: Lead, etapa: Etapa): LeadStatus {
  // Arrastar dentro da cadência não muda a mensagem em que o lead está.
  if (etapa.status.includes(lead.status)) return lead.status;
  return etapa.destino;
}

export default function Kanban({ leads: inicial, hoje }: { leads: Lead[]; hoje: string }) {
  const router = useRouter();
  const [leads, setLeads] = useState(inicial);
  const [base, setBase] = useState(inicial);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [, start] = useTransition();

  // Quando o servidor manda dados novos, eles substituem o estado local.
  if (inicial !== base) {
    setBase(inicial);
    setLeads(inicial);
  }

  function soltar(etapa: Etapa, id: string) {
    const lead = leads.find((l) => l.id === id);
    setArrastando(null);
    setSobre(null);
    if (!lead) return;
    const status = destino(lead, etapa);
    if (status === lead.status) return;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    start(() => setLeadStatus(lead.id, status));
  }

  return (
    <div className="scroll-thin flex min-h-[calc(100vh-190px)] gap-3 overflow-x-auto px-4 pb-6 pt-4 md:px-8">
      {ETAPAS.map((etapa) => {
        const lista = leads.filter((l) => etapa.status.includes(l.status));
        const total = lista.reduce((s, l) => s + Number(l.valor ?? 0), 0);
        return (
          <section
            key={etapa.id}
            onDragOver={(e) => {
              e.preventDefault();
              setSobre(etapa.id);
            }}
            onDragLeave={() => setSobre((s) => (s === etapa.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              soltar(etapa, e.dataTransfer.getData('text/plain') || arrastando || '');
            }}
            className={`flex w-[272px] shrink-0 flex-col rounded-xl border bg-surface-2/70 transition ${sobre === etapa.id ? 'border-brand bg-brand-soft/60' : 'border-transparent'}`}
          >
            <header className="rounded-t-xl border-t-[3px] bg-surface px-3 py-2.5" style={{ borderTopColor: etapa.cor }}>
              <div className="flex items-center justify-between">
                <h2 className="text-[13.5px] font-semibold">{etapa.titulo}</h2>
                <span className="rounded-full bg-surface-2 px-2 text-[11.5px] font-semibold text-muted">{lista.length}</span>
              </div>
              <p className="mt-0.5 text-[12px] text-muted">{brl(total, false)}</p>
            </header>
            <div className="grid content-start gap-2 p-2">
              {lista.map((l) => {
                const atrasado = l.proxima_acao && l.proxima_acao < hoje && l.status !== 'fechou';
                const hojeMesmo = l.proxima_acao === hoje;
                return (
                  <article
                    key={l.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', l.id);
                      setArrastando(l.id);
                    }}
                    onDragEnd={() => setArrastando(null)}
                    onClick={() => router.push(`/comercial/${l.id}`)}
                    className={`cursor-pointer rounded-lg border border-line bg-surface p-3 shadow-[0_1px_2px_rgba(20,21,46,0.06)] transition hover:border-brand/50 hover:shadow-md ${arrastando === l.id ? 'opacity-40' : ''}`}
                  >
                    <h3 className="text-[13.5px] font-semibold leading-snug">{l.nome}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
                      <MapPin size={11} /> {[l.cidade, NICHO[l.nicho]].filter(Boolean).join(' · ')}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold">{brl(l.valor, false)}</span>
                      <span className="flex items-center gap-1.5">
                        {etapaDe(l.status)?.id === 'cadencia' && (
                          <span className="rounded bg-info-soft px-1.5 py-0.5 text-[10.5px] font-bold text-info">{l.status.toUpperCase()}</span>
                        )}
                        {l.proxima_acao && (
                          <span
                            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${atrasado ? 'bg-danger-soft text-danger' : hojeMesmo ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-muted'}`}
                          >
                            <CalendarClock size={11} /> {prazo(l.proxima_acao, hoje)}
                          </span>
                        )}
                        {l.whatsapp && (
                          <a
                            href={`https://wa.me/${l.whatsapp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`WhatsApp de ${l.nome}`}
                            className="grid size-6 place-items-center rounded text-wa hover:bg-success-soft"
                          >
                            <MessageCircle size={14} />
                          </a>
                        )}
                      </span>
                    </div>
                  </article>
                );
              })}
              {!lista.length && <p className="py-6 text-center text-[12px] text-faint">Arraste negócios pra cá</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

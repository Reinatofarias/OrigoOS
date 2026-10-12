'use client';

import { useState, useTransition } from 'react';
import { MessageCircle, AtSign, Copy, Check } from 'lucide-react';
import { markSent, saveLeadNotes, setLeadStatus } from '@/app/actions';
import type { Lead, LeadStatus } from '@/lib/db';
import { COLUNAS, NICHO, PASSOS, formatWhatsapp, mensagem, proximoPasso, type Passo } from '@/lib/prospeccao';

// Remonte o card com key={`${lead.id}-${lead.status}`} para ele voltar à próxima mensagem quando o status muda.
export default function LeadCard({ lead, destaque }: { lead: Lead; destaque?: string }) {
  const sugerido = proximoPasso(lead.status) ?? 'm1';
  const [passo, setPasso] = useState<Passo>(sugerido);
  const [texto, setTexto] = useState(() => mensagem(sugerido, lead));
  const [copiado, setCopiado] = useState(false);
  const [notas, setNotas] = useState(lead.notas ?? '');
  const [pending, start] = useTransition();

  function escolher(p: Passo) {
    setPasso(p);
    setTexto(mensagem(p, lead));
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* sem permissão de clipboard: o texto continua visível para copiar à mão */
    }
  }

  const waHref = lead.whatsapp ? `https://wa.me/${lead.whatsapp}?text=${encodeURIComponent(texto)}` : null;
  const ativo = proximoPasso(lead.status) !== null;

  return (
    <article className={`grid min-w-0 gap-3 rounded-2xl border border-line bg-surface p-4 ${pending ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{lead.nome}</h3>
          <p className="text-sm text-muted">
            {[lead.cidade, lead.whatsapp && formatWhatsapp(lead.whatsapp), lead.instagram && `@${lead.instagram}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent">
            {NICHO[lead.nicho]}
          </span>
          {destaque && <span className="text-xs font-semibold text-warn">{destaque}</span>}
        </div>
      </div>

      {ativo && (
        <>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mensagem">
            {PASSOS.map((p) => (
              <button
                key={p.passo}
                type="button"
                aria-pressed={passo === p.passo}
                onClick={() => escolher(p.passo)}
                className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-muted aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent"
              >
                {p.titulo}
              </button>
            ))}
            <span className="self-center text-xs text-muted">{PASSOS.find((p) => p.passo === passo)?.quando}</span>
          </div>
          <label htmlFor={`msg-${lead.id}`} className="sr-only">
            Mensagem para {lead.nome}
          </label>
          <textarea
            id={`msg-${lead.id}`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            className="w-full resize-y rounded-xl border border-line bg-bg p-3 text-sm leading-relaxed"
          />
          {lead.whatsapp && !lead.whatsapp_confirmado && (
            <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
              Celular sem confirmação de WhatsApp. Se não abrir, use o Instagram ou ligue.
            </p>
          )}
          {!lead.whatsapp && (
            <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">Sem WhatsApp público. Mande pelo Instagram.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-wa px-3.5 py-2 text-sm font-semibold text-white"
              >
                <MessageCircle size={16} /> WhatsApp
              </a>
            )}
            {lead.instagram && (
              <a
                href={`https://www.instagram.com/${lead.instagram}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-sm font-semibold"
              >
                <AtSign size={16} /> Instagram
              </a>
            )}
            <button
              type="button"
              onClick={copiar}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-sm font-semibold"
            >
              {copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? 'Copiada' : 'Copiar'}
            </button>
            <button
              type="button"
              onClick={() => start(() => markSent(lead.id, passo))}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink"
            >
              Marcar {passo.toUpperCase()} como enviada
            </button>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`st-${lead.id}`} className="text-xs text-muted">
          Status
        </label>
        <select
          id={`st-${lead.id}`}
          value={lead.status}
          onChange={(e) => start(() => setLeadStatus(lead.id, e.target.value as LeadStatus))}
          className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
        >
          {COLUNAS.map((c) => (
            <option key={c.status} value={c.status}>
              {c.titulo}
            </option>
          ))}
        </select>
        <label htmlFor={`nota-${lead.id}`} className="sr-only">
          Notas
        </label>
        <input
          id={`nota-${lead.id}`}
          value={notas}
          placeholder="Nota rápida"
          onChange={(e) => setNotas(e.target.value)}
          onBlur={() => notas !== (lead.notas ?? '') && start(() => saveLeadNotes(lead.id, notas))}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
        />
      </div>
    </article>
  );
}

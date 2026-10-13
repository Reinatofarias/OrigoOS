'use client';

import { useState, useTransition } from 'react';
import { AtSign, Check, Copy, MessageCircle, Send } from 'lucide-react';
import { convertLead, markSent, setLeadStatus, updateLead } from '@/app/actions';
import type { Lead, LeadStatus } from '@/lib/db';
import { ETAPAS, PASSOS, etapaDe, mensagem, proximoPasso, type Modelos, type Passo } from '@/lib/prospeccao';
import { btn } from './ui';
import { avisar } from './toast';

export function StageBar({ lead }: { lead: Lead }) {
  const [pending, start] = useTransition();
  const atual = ETAPAS.findIndex((e) => e.id === etapaDe(lead.status)?.id);
  return (
    <div className={`flex overflow-x-auto ${pending ? 'opacity-60' : ''}`} role="group" aria-label="Etapa do negócio">
      {ETAPAS.map((e, i) => {
        const feito = lead.status !== 'perdido' && i <= atual;
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => !e.status.includes(lead.status) && start(() => setLeadStatus(lead.id, e.destino))}
            aria-pressed={i === atual}
            className={`stage -ml-1.5 min-w-[118px] flex-1 px-5 py-2 text-[12.5px] font-semibold first:ml-0 ${feito ? 'text-white' : 'bg-surface-2 text-muted hover:bg-line'}`}
            style={feito ? { background: i === atual ? 'var(--brand)' : '#0f9a64' } : undefined}
          >
            {e.titulo}
          </button>
        );
      })}
    </div>
  );
}

export function DealActions({ lead }: { lead: Lead }) {
  const [pending, start] = useTransition();
  const set = (s: LeadStatus) => start(async () => { await setLeadStatus(lead.id, s); avisar('Etapa atualizada'); });
  if (lead.status === 'perdido') {
    return (
      <button type="button" disabled={pending} onClick={() => set('novo')} className={btn.secondary}>
        Reabrir negócio
      </button>
    );
  }
  return (
    <>
      {lead.status === 'fechou' && !lead.client_id ? (
        <button type="button" disabled={pending} onClick={() => start(async () => { await convertLead(lead.id); avisar('Virou cliente 🎉'); })} className={btn.primary}>
          Transformar em cliente
        </button>
      ) : lead.status !== 'fechou' ? (
        <button type="button" disabled={pending} onClick={() => set('fechou')} className={btn.success}>
          Ganho
        </button>
      ) : null}
      {lead.status !== 'fechou' && (
        <button type="button" disabled={pending} onClick={() => set('perdido')} className={btn.danger}>
          Perdido
        </button>
      )}
    </>
  );
}

export function DealField({
  lead,
  campo,
  label,
  type = 'text',
}: {
  lead: Lead;
  campo: 'valor' | 'contato' | 'proxima_acao' | 'cidade';
  label: string;
  type?: string;
}) {
  const inicial = lead[campo] === null || lead[campo] === undefined ? '' : String(lead[campo]);
  const [v, setV] = useState(inicial);
  const [, start] = useTransition();
  function salvar() {
    if (v === inicial) return;
    const valor = campo === 'valor' ? Number(v.replace(/\./g, '').replace(',', '.')) || 0 : v.trim() || null;
    start(() => updateLead(lead.id, { [campo]: valor }));
  }
  return (
    <label className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2 py-1">
      <span className="text-[12.5px] text-muted">{label}</span>
      <input
        type={type}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        inputMode={campo === 'valor' ? 'decimal' : undefined}
        className="cell-input w-full text-[13.5px]"
        placeholder="—"
      />
    </label>
  );
}

export function DealNotes({ lead }: { lead: Lead }) {
  const [notas, setNotas] = useState(lead.notas ?? '');
  const [salvo, setSalvo] = useState(false);
  const [, start] = useTransition();
  return (
    <div className="grid gap-2">
      <textarea
        value={notas}
        onChange={(e) => {
          setNotas(e.target.value);
          setSalvo(false);
        }}
        onBlur={() =>
          notas !== (lead.notas ?? '') &&
          start(async () => {
            await updateLead(lead.id, { notas: notas.trim() || null });
            setSalvo(true);
            avisar('Anotações salvas');
          })
        }
        rows={6}
        placeholder="O que ele disse, objeções, combinados, próximos passos…"
        className="field resize-y leading-relaxed"
      />
      <p className="text-[12px] text-muted">{salvo ? 'Nota salva.' : 'Salva sozinha quando você sai do campo.'}</p>
    </div>
  );
}

// Mensagens M1 a M4 prontas, com envio pelo WhatsApp.
export function Cadence({ lead, modelos }: { lead: Lead; modelos?: Partial<Modelos> }) {
  const sugerido = proximoPasso(lead.status) ?? 'm1';
  const [passo, setPasso] = useState<Passo>(sugerido);
  const [texto, setTexto] = useState(() => mensagem(sugerido, lead, modelos));
  const [copiado, setCopiado] = useState(false);
  const [pending, start] = useTransition();

  function escolher(p: Passo) {
    setPasso(p);
    setTexto(mensagem(p, lead, modelos));
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* sem permissão: o texto continua visível pra copiar à mão */
    }
  }

  const waHref = lead.whatsapp ? `https://wa.me/${lead.whatsapp}?text=${encodeURIComponent(texto)}` : null;
  const enviados = (['m1', 'm2', 'm3', 'm4'] as Passo[]).slice(0, ['novo', 'm1', 'm2', 'm3', 'm4'].indexOf(lead.status));

  return (
    <div className={`grid gap-3 ${pending ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Mensagem">
        {PASSOS.map((p) => (
          <button
            key={p.passo}
            type="button"
            aria-pressed={passo === p.passo}
            onClick={() => escolher(p.passo)}
            className="rounded-lg border border-line px-2 py-2 text-left aria-pressed:border-brand aria-pressed:bg-brand-soft"
          >
            <span className="flex items-center gap-1 text-[12.5px] font-bold">
              {p.titulo} {enviados.includes(p.passo) && <Check size={13} className="text-success" />}
            </span>
            <span className="block truncate text-[11px] text-muted">{p.quando}</span>
          </button>
        ))}
      </div>
      <textarea
        aria-label="Mensagem"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={6}
        className="field resize-y leading-relaxed"
      />
      {lead.whatsapp && !lead.whatsapp_confirmado && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-[12px] text-warn">Celular sem confirmação de WhatsApp. Se não abrir, use o Instagram ou ligue.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" onClick={() => start(() => markSent(lead.id, passo))} className={btn.wa}>
            <MessageCircle size={15} /> Mandar {passo.toUpperCase()} no WhatsApp
          </a>
        )}
        {lead.instagram && (
          <a href={`https://www.instagram.com/${lead.instagram}/`} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
            <AtSign size={15} /> Instagram
          </a>
        )}
        <button type="button" onClick={copiar} className={btn.secondary}>
          {copiado ? <Check size={15} /> : <Copy size={15} />} {copiado ? 'Copiada' : 'Copiar'}
        </button>
        <button type="button" onClick={() => start(() => markSent(lead.id, passo))} className={btn.primary}>
          <Send size={15} /> Só marcar como enviada
        </button>
      </div>
    </div>
  );
}

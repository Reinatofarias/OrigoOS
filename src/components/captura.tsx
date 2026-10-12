'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { CalendarDays, Flag, Mic, MicOff, Plus, User, X } from 'lucide-react';
import { capturarLead, capturarTarefa } from '@/app/actions';
import { interpretar } from '@/lib/captura';
import { prazo } from '@/lib/dates';
import { PRIORIDADE } from './tasks';
import { btn } from './ui';

type Reconhecimento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function criarReconhecimento(): Reconhecimento | null {
  const w = window as unknown as { SpeechRecognition?: new () => Reconhecimento; webkitSpeechRecognition?: new () => Reconhecimento };
  const R = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return R ? new R() : null;
}

const semInscricao = () => () => {};
const temReconhecimento = () => {
  const w = window as unknown as Record<string, unknown>;
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
};

// Botão "+" em todas as telas: fala ou digita, e vira tarefa (ou lead) na hora.
export default function Captura({ clientes, hoje }: { clientes: { id: string; nome: string }[]; hoje: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const rec = useRef<Reconhecimento | null>(null);
  const [tipo, setTipo] = useState<'tarefa' | 'lead'>('tarefa');
  const [texto, setTexto] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [ouvindo, setOuvindo] = useState(false);
  const temVoz = useSyncExternalStore(semInscricao, temReconhecimento, () => false);
  const [ok, setOk] = useState('');
  const [pending, start] = useTransition();
  const [ajuste, setAjuste] = useState<{ client_id?: string | null; data?: string | null }>({});

  const lido = useMemo(() => interpretar(texto, clientes, hoje), [texto, clientes, hoje]);
  const final = { ...lido, ...ajuste };

  useEffect(() => {
    function atalho(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement;
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(alvo.tagName) && !alvo.isContentEditable) {
        e.preventDefault();
        abrir();
      }
    }
    window.addEventListener('keydown', atalho);
    return () => window.removeEventListener('keydown', atalho);
  }, []);

  function abrir() {
    setOk('');
    ref.current?.showModal();
  }

  function fechar() {
    rec.current?.stop();
    ref.current?.close();
  }

  function falar() {
    if (ouvindo) {
      rec.current?.stop();
      return;
    }
    const r = criarReconhecimento();
    if (!r) return;
    r.lang = 'pt-BR';
    r.continuous = false;
    r.interimResults = true;
    const base = texto ? `${texto.trim()} ` : '';
    r.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setTexto(base + t);
    };
    r.onend = () => setOuvindo(false);
    r.onerror = () => setOuvindo(false);
    rec.current = r;
    setOuvindo(true);
    r.start();
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    start(async () => {
      if (tipo === 'tarefa') {
        await capturarTarefa({ titulo: final.titulo, data: final.data ?? null, client_id: final.client_id ?? null, prioridade: final.prioridade });
        setOk(`Tarefa criada: ${final.titulo}`);
      } else {
        await capturarLead({ nome: texto.split('\n')[0].trim(), whatsapp, notas: texto.split('\n').slice(1).join('\n').trim() || null });
        setOk(`Lead criado: ${texto.split('\n')[0].trim()}`);
      }
      setTexto('');
      setWhatsapp('');
      setAjuste({});
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Captura rápida (atalho: N)"
        title="Captura rápida (atalho: N)"
        className="bg-grad fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-40 grid size-14 place-items-center rounded-full text-white shadow-[0_8px_24px_rgba(106,76,255,0.45)] transition hover:scale-105 md:bottom-6 md:right-6"
      >
        <Plus size={26} strokeWidth={2.4} />
      </button>
      <dialog ref={ref} onClose={() => rec.current?.stop()} className="m-auto w-[min(560px,calc(100vw-24px))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl">
        <form onSubmit={salvar}>
          <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div className="flex gap-1 rounded-lg bg-surface-2 p-1 text-[13px] font-semibold" role="group" aria-label="O que criar">
              {(['tarefa', 'lead'] as const).map((t) => (
                <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(t)} className="rounded-md px-3 py-1 text-muted aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-sm">
                  {t === 'tarefa' ? 'Tarefa' : 'Lead'}
                </button>
              ))}
            </div>
            <button type="button" onClick={fechar} aria-label="Fechar" className="rounded-md p-1 text-muted hover:bg-surface-2">
              <X size={18} />
            </button>
          </header>
          <div className="grid gap-3 px-5 py-4">
            <div className="relative">
              <textarea
                autoFocus
                rows={3}
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  setOk('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && tipo === 'tarefa') {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={tipo === 'tarefa' ? 'Ex.: ligar pro Matheus amanhã urgente' : 'Nome da empresa (na linha de baixo, o que você sabe dela)'}
                className="field resize-none pr-14 text-[15px] leading-relaxed"
                aria-label={tipo === 'tarefa' ? 'O que precisa fazer' : 'Nome do lead'}
              />
              {temVoz && (
                <button
                  type="button"
                  onClick={falar}
                  aria-label={ouvindo ? 'Parar de ouvir' : 'Falar'}
                  className={`absolute right-2 top-2 grid size-10 place-items-center rounded-full ${ouvindo ? 'animate-pulse bg-danger text-white' : 'bg-brand-soft text-brand hover:bg-brand hover:text-white'}`}
                >
                  {ouvindo ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
            </div>

            {tipo === 'tarefa' ? (
              texto.trim() && (
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="text-muted">Vai criar:</span>
                  <strong className="text-[13px]">{final.titulo}</strong>
                  <label className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1">
                    <CalendarDays size={12} className="text-muted" />
                    <input
                      type="date"
                      aria-label="Prazo"
                      value={final.data ?? ''}
                      onChange={(e) => setAjuste((a) => ({ ...a, data: e.target.value || null }))}
                      className="w-[118px] bg-transparent text-[12.5px] outline-none"
                    />
                    {final.data && <span className="font-semibold text-brand">{prazo(final.data, hoje)}</span>}
                  </label>
                  <label className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1">
                    <User size={12} className="text-muted" />
                    <select
                      aria-label="Cliente"
                      value={final.client_id ?? ''}
                      onChange={(e) => setAjuste((a) => ({ ...a, client_id: e.target.value || null }))}
                      className="max-w-[160px] bg-transparent text-[12.5px] outline-none"
                    >
                      <option value="">Sem cliente</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  {final.prioridade !== 'normal' && (
                    <span className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 font-semibold" style={{ color: PRIORIDADE[final.prioridade].cor }}>
                      <Flag size={12} /> {PRIORIDADE[final.prioridade].label}
                    </span>
                  )}
                </div>
              )
            ) : (
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="WhatsApp (opcional)" className="field" aria-label="WhatsApp" />
            )}
            {ok && <p className="rounded-lg bg-success-soft px-3 py-2 text-[13px] font-medium text-success">{ok}</p>}
            {tipo === 'tarefa' && !texto && (
              <p className="text-[12px] text-muted">Dica: fale ou escreva &quot;hoje&quot;, &quot;amanhã&quot;, &quot;sexta&quot;, &quot;dia 20&quot;, &quot;urgente&quot; ou o nome do cliente que o sistema entende.</p>
            )}
          </div>
          <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" onClick={fechar} className={btn.secondary}>
              Fechar
            </button>
            <button className={btn.primary} disabled={pending || !texto.trim()}>
              {pending ? 'Salvando…' : tipo === 'tarefa' ? 'Criar tarefa' : 'Criar lead'}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}

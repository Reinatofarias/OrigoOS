'use client';

import { useRef, useState, useTransition } from 'react';
import { CalendarPlus, Trash2, Video, X } from 'lucide-react';
import { apagarCompromisso, novoCompromisso } from '@/app/acoes/agenda';
import { Field } from './dialog';
import { btn } from './ui';

// Botão + modal pra criar um compromisso no Google Agenda (também usado na tarefa).
export function NovoCompromisso({
  label = 'Compromisso',
  dia,
  titulo = '',
  descricao = '',
  taskId,
  variant = 'primary',
}: {
  label?: string;
  dia: string;
  titulo?: string;
  descricao?: string;
  taskId?: string;
  variant?: 'primary' | 'secondary';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<string | null>(null);
  const fechar = () => {
    ref.current?.close();
    setErro(null);
    setPronto(null);
  };
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={btn[variant]}>
        <CalendarPlus size={15} /> {label}
      </button>
      <dialog ref={ref} onClose={() => (setErro(null), setPronto(null))} className="m-auto w-[min(520px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[16px] font-semibold">{taskId ? 'Agendar no Google Agenda' : 'Novo compromisso'}</h2>
          <button type="button" onClick={fechar} aria-label="Fechar" className="rounded-md p-1 text-muted hover:bg-surface-2">
            <X size={18} />
          </button>
        </header>
        {pronto !== null ? (
          <div className="grid gap-3 px-5 py-5 text-[14px]">
            <p className="font-semibold text-success">Pronto, está no seu Google Agenda.</p>
            {pronto && (
              <a href={pronto} target="_blank" rel="noreferrer" className="break-all text-brand underline">
                {pronto}
              </a>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={fechar} className={btn.primary}>
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <form
            ref={form}
            onSubmit={(e) => {
              e.preventDefault();
              // Sem o reset automático do React: se der erro, o que foi digitado continua no formulário.
              const fd = new FormData(e.currentTarget);
              start(async () => {
                const r = await novoCompromisso(fd);
                if (r?.erro) return setErro(r.erro);
                form.current?.reset();
                setErro(null);
                setPronto(r?.link ?? '');
              });
            }}
          >
            {taskId && <input type="hidden" name="task_id" value={taskId} />}
            <div className="grid max-h-[70vh] gap-3 overflow-y-auto px-5 py-4">
              <Field label="Título *">
                <input name="titulo" required defaultValue={titulo} className="field" />
              </Field>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Dia *">
                  <input name="dia" type="date" required defaultValue={dia} className="field" />
                </Field>
                <Field label="Hora">
                  <input name="hora" type="time" defaultValue="09:00" className="field" />
                </Field>
                <Field label="Duração" className="col-span-2 sm:col-span-1">
                  <select name="minutos" defaultValue={60} className="field">
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 hora</option>
                    <option value={90}>1h30</option>
                    <option value={120}>2 horas</option>
                    <option value={180}>3 horas</option>
                  </select>
                </Field>
              </div>
              <p className="-mt-1 text-[12px] text-muted">Deixe a hora vazia pra um compromisso de dia inteiro.</p>
              <label className="flex items-center gap-2 text-[13.5px]">
                <input type="checkbox" name="meet" className="size-4 accent-[var(--color-brand)]" />
                <Video size={15} className="text-muted" /> Criar link do Google Meet
              </label>
              <Field label="Convidados (e-mails separados por vírgula)">
                <input name="convidados" placeholder="cliente@empresa.com" className="field" />
              </Field>
              <Field label="Local">
                <input name="local" className="field" />
              </Field>
              <Field label="Descrição">
                <textarea name="descricao" rows={3} defaultValue={descricao} className="field" />
              </Field>
              {taskId && (
                <label className="flex items-center gap-2 text-[13.5px]">
                  <input type="checkbox" name="prazo" defaultChecked className="size-4 accent-[var(--color-brand)]" />
                  Usar esse dia como prazo da tarefa
                </label>
              )}
              {erro && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{erro}</p>}
            </div>
            <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
              <button type="button" onClick={fechar} className={btn.secondary}>
                Cancelar
              </button>
              <button className={btn.primary} disabled={pending}>
                {pending ? 'Salvando…' : 'Salvar na agenda'}
              </button>
            </footer>
          </form>
        )}
      </dialog>
    </>
  );
}

export function ApagarEvento({ id, titulo }: { id: string; titulo: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        confirm(`Apagar "${titulo}" do Google Agenda?`) &&
        start(async () => {
          const r = await apagarCompromisso(id);
          if (r?.erro) alert(r.erro);
        })
      }
      aria-label="Apagar do Google Agenda"
      className="rounded p-1 text-faint hover:text-danger disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100"
    >
      <Trash2 size={13} />
    </button>
  );
}

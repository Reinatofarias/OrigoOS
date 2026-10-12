'use client';

import { useRef, useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import { btn } from './ui';

// Botão que abre um formulário num modal. O formulário chama a server action e fecha.
export default function FormDialog({
  label,
  title,
  action,
  children,
  submit = 'Salvar',
  variant = 'primary',
}: {
  label: string;
  title: string;
  action: (fd: FormData) => Promise<void>;
  children: React.ReactNode;
  submit?: string;
  variant?: 'primary' | 'secondary';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={btn[variant]}>
        <Plus size={15} /> {label}
      </button>
      <dialog ref={ref} className="m-auto w-[min(520px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl">
        <form
          ref={form}
          action={(fd) =>
            start(async () => {
              await action(fd);
              form.current?.reset();
              ref.current?.close();
            })
          }
        >
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[16px] font-semibold">{title}</h2>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Fechar" className="rounded-md p-1 text-muted hover:bg-surface-2">
              <X size={18} />
            </button>
          </header>
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto px-5 py-4">{children}</div>
          <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" onClick={() => ref.current?.close()} className={btn.secondary}>
              Cancelar
            </button>
            <button className={btn.primary} disabled={pending}>
              {pending ? 'Salvando…' : submit}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}

export function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1 ${className}`}>
      <span className="text-[12.5px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

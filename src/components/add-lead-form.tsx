'use client';

import { useRef } from 'react';
import { addLead } from '@/app/actions';

export default function AddLeadForm() {
  const form = useRef<HTMLFormElement>(null);
  const field = 'rounded-xl border border-line bg-surface px-3 py-2.5 text-base';
  return (
    <details className="rounded-2xl border border-line bg-surface p-4">
      <summary className="cursor-pointer font-semibold">Adicionar lead</summary>
      <form
        ref={form}
        action={async (data) => {
          await addLead(data);
          form.current?.reset();
        }}
        className="mt-3 grid gap-3 sm:grid-cols-2"
      >
        <input name="nome" placeholder="Nome da empresa" aria-label="Nome da empresa" required className={field} />
        <input name="cidade" placeholder="Cidade" aria-label="Cidade" className={field} />
        <input name="whatsapp" placeholder="WhatsApp, ex.: (81) 99999-9999" aria-label="WhatsApp" inputMode="tel" className={field} />
        <input name="instagram" placeholder="@instagram" aria-label="Instagram" className={field} />
        <select name="nicho" aria-label="Nicho" className={field}>
          <option value="clima">Climatização</option>
          <option value="adv">Advocacia</option>
          <option value="odonto">Odontologia</option>
          <option value="outro">Outro</option>
        </select>
        <button className="rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-ink">Salvar lead</button>
      </form>
    </details>
  );
}

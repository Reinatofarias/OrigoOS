'use client';

import { useActionState } from 'react';
import { PenLine } from 'lucide-react';
import { assinarContrato } from '@/app/actions';
import type { Contratante } from '@/lib/db';

const campo = 'w-full rounded-xl border border-[#d9dbe8] bg-white px-3.5 py-2.5 text-[14px] text-[#14152e] outline-none focus:border-[#6a4cff]';

function F({ label, children, largo }: { label: string; children: React.ReactNode; largo?: boolean }) {
  return (
    <label className={`grid gap-1 ${largo ? 'sm:col-span-2' : ''}`}>
      <span className="text-[12.5px] font-medium text-[#6b6e8a]">{label}</span>
      {children}
    </label>
  );
}

export default function AssinarForm({ token, contratante }: { token: string; contratante: Contratante }) {
  const [state, action, pending] = useActionState(assinarContrato.bind(null, token), null);
  // Se der erro, o formulário volta com o que a pessoa já tinha digitado.
  const k = state?.valores ?? contratante;
  return (
    <form key={state?.tentativa ?? 0} action={action} className="grid gap-4 rounded-2xl border border-[#e5e7f0] bg-white p-6 text-[#14152e] shadow-xl">
      <div>
        <h2 className="text-[17px] font-bold">Assinar o contrato</h2>
        <p className="text-[13px] text-[#6b6e8a]">Confira e complete os dados. Eles entram no contrato assinado.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="Empresa ou nome do contratante *">
          <input name="nome" required defaultValue={k.nome} className={campo} />
        </F>
        <F label="CNPJ ou CPF do contratante *">
          <input name="documento" required inputMode="numeric" defaultValue={k.documento} className={campo} />
        </F>
        <F label="Endereço completo *" largo>
          <input name="endereco" required defaultValue={k.endereco} className={campo} />
        </F>
        <F label="E-mail">
          <input name="email" type="email" defaultValue={k.email} className={campo} />
        </F>
        <F label="Nome de quem assina *">
          <input name="representante" required defaultValue={k.representante} className={campo} />
        </F>
        <F label="CPF de quem assina *">
          <input name="representante_cpf" required inputMode="numeric" defaultValue={k.representante_cpf} className={campo} />
        </F>
        <input type="hidden" name="telefone" value={k.telefone ?? ''} />
      </div>
      <label className="flex items-start gap-2.5 text-[13.5px]">
        <input type="checkbox" name="aceite" required className="mt-0.5 size-4 accent-[#6a4cff]" />
        Li o contrato e concordo com todas as cláusulas. Sei que esta assinatura eletrônica tem validade jurídica.
      </label>
      {state?.erro && <p className="rounded-lg bg-[#fde8e9] px-3 py-2 text-[13px] text-[#c62f35]">{state.erro}</p>}
      <div>
        <button disabled={pending} className="bg-grad inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold text-white shadow-lg disabled:opacity-60">
          <PenLine size={16} /> {pending ? 'Assinando…' : 'Assinar contrato'}
        </button>
      </div>
    </form>
  );
}

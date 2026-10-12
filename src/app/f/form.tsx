'use client';

import { useActionState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { enviarContato } from '@/app/acoes/prospeccao';

const campo = 'w-full rounded-xl border border-[#d9dbe8] bg-white px-3.5 py-2.5 text-[15px] text-[#14152e] outline-none focus:border-[#6a4cff]';

export default function ContatoForm() {
  const [state, action, pending] = useActionState(enviarContato, null);
  if (state?.ok) {
    return (
      <div className="mt-5 flex items-start gap-3 rounded-xl bg-[#e7f7ef] p-4 text-[#0f7a50]">
        <CheckCircle2 size={22} className="mt-0.5 shrink-0" />
        <p className="text-[14px]">
          <strong className="block text-[15px]">Recebido!</strong>
          Em breve o Renato te chama no WhatsApp.
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="mt-5 grid gap-3">
      <label className="grid gap-1 text-[13px] font-medium text-[#6b6e8a]">
        Seu nome *
        <input name="nome" required maxLength={120} autoComplete="name" className={campo} />
      </label>
      <label className="grid gap-1 text-[13px] font-medium text-[#6b6e8a]">
        WhatsApp com DDD *
        <input name="whatsapp" required inputMode="tel" autoComplete="tel" placeholder="(81) 99999-9999" maxLength={30} className={campo} />
      </label>
      <label className="grid gap-1 text-[13px] font-medium text-[#6b6e8a]">
        Empresa
        <input name="empresa" maxLength={120} autoComplete="organization" className={campo} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-[13px] font-medium text-[#6b6e8a]">
          Cidade
          <input name="cidade" maxLength={80} autoComplete="address-level2" className={campo} />
        </label>
        <label className="grid gap-1 text-[13px] font-medium text-[#6b6e8a]">
          Ramo
          <select name="nicho" defaultValue="outro" className={campo}>
            <option value="clima">Climatização</option>
            <option value="adv">Advocacia</option>
            <option value="odonto">Odontologia</option>
            <option value="outro">Outro</option>
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-[13px] font-medium text-[#6b6e8a]">
        Como posso te ajudar?
        <textarea name="mensagem" rows={3} maxLength={1500} className={`${campo} resize-y`} />
      </label>
      {/* Armadilha pra robô: escondido de quem usa o site. */}
      <input name="site" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />
      {state?.erro && <p className="rounded-lg bg-[#fde8ea] px-3 py-2 text-[13px] text-[#b4232c]">{state.erro}</p>}
      <button disabled={pending} className="bg-grad mt-1 rounded-xl px-5 py-3 text-[15px] font-semibold text-white shadow-lg disabled:opacity-60">
        {pending ? 'Enviando…' : 'Quero ser chamado no WhatsApp'}
      </button>
      <p className="text-center text-[11.5px] text-[#9a9cb5]">Seus dados ficam só com a Origo Company e servem apenas pra esse contato.</p>
    </form>
  );
}

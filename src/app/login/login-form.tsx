'use client';

import { useActionState } from 'react';
import { login } from '../actions';

const campo = 'rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white outline-none focus:border-[#22c7ff]';

export default function LoginForm({ comCodigo }: { comCodigo: boolean }) {
  const [state, action, pending] = useActionState(login, null);
  const codigo = comCodigo || state?.pedirCodigo;
  return (
    <form action={action} className="grid gap-3">
      <label htmlFor="senha" className="text-sm font-semibold text-white">
        Senha
      </label>
      <input id="senha" name="senha" type="password" autoComplete="current-password" required className={campo} />
      {codigo && (
        <>
          <label htmlFor="codigo" className="mt-1 text-sm font-semibold text-white">
            Código do app autenticador
          </label>
          <input
            id="codigo"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            placeholder="000000"
            required
            className={`${campo} tracking-[0.3em]`}
          />
        </>
      )}
      {state?.erro && <p className="text-sm text-[#ff8fa3]">{state.erro}</p>}
      <button disabled={pending} className="bg-grad rounded-xl px-4 py-3 font-semibold text-white disabled:opacity-60">
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

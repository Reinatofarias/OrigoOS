'use client';

import { useActionState } from 'react';
import { login } from '../actions';

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="grid gap-3">
      <label htmlFor="senha" className="text-sm font-semibold text-white">
        Senha
      </label>
      <input
        id="senha"
        name="senha"
        type="password"
        autoComplete="current-password"
        required
        className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white outline-none focus:border-[#22c7ff]"
      />
      {state?.erro && <p className="text-sm text-[#ff8fa3]">{state.erro}</p>}
      <button disabled={pending} className="bg-grad rounded-xl px-4 py-3 font-semibold text-white disabled:opacity-60">
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

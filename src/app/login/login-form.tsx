'use client';

import { useActionState } from 'react';
import { login } from '../actions';

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="grid gap-3">
      <label htmlFor="senha" className="text-sm font-semibold">
        Senha
      </label>
      <input
        id="senha"
        name="senha"
        type="password"
        autoComplete="current-password"
        required
        className="rounded-xl border border-line bg-surface px-4 py-3 text-base"
      />
      {state?.erro && <p className="text-sm text-danger">{state.erro}</p>}
      <button disabled={pending} className="rounded-xl bg-accent px-4 py-3 font-semibold text-accent-ink disabled:opacity-60">
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

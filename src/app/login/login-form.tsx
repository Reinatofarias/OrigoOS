'use client';

import { useActionState, useState } from 'react';
import { login, type EstadoLogin } from '../actions';

const campo = 'rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white outline-none focus:border-[#22c7ff]';

// Primeiro a senha; se a verificação em duas etapas estiver ligada, a tela troca para o código do app.
export default function LoginForm() {
  const [voltou, setVoltou] = useState<EstadoLogin>(null);
  const [state, action, pending] = useActionState(login, null);
  const atual = voltou ?? state;
  const codigo = atual?.etapa === 'codigo';
  return (
    <form action={(fd) => (setVoltou(null), action(fd))} className="grid gap-3">
      {codigo ? (
        <>
          <input type="hidden" name="etapa" value="codigo" />
          <label htmlFor="codigo" className="text-sm font-semibold text-white">
            Código do app autenticador
          </label>
          <p className="-mt-1 text-[13px] text-sidebar-ink">Senha confirmada. Abra o app autenticador e digite os 6 números.</p>
          <input
            key="codigo"
            id="codigo"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            placeholder="000000"
            required
            autoFocus
            className={`${campo} tracking-[0.3em]`}
          />
        </>
      ) : (
        <>
          <label htmlFor="senha" className="text-sm font-semibold text-white">
            Senha
          </label>
          <input key="senha" id="senha" name="senha" type="password" autoComplete="current-password" required autoFocus className={campo} />
        </>
      )}
      {atual?.erro && <p className="text-sm text-[#ff8fa3]">{atual.erro}</p>}
      <button disabled={pending} className="bg-grad rounded-xl px-4 py-3 font-semibold text-white disabled:opacity-60">
        {pending ? 'Entrando…' : codigo ? 'Confirmar' : 'Entrar'}
      </button>
      {codigo && (
        <button type="button" onClick={() => setVoltou({ etapa: 'senha' })} className="text-[13px] text-sidebar-ink hover:text-white">
          Voltar para a senha
        </button>
      )}
    </form>
  );
}

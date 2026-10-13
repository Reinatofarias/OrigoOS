'use client';

import { useState, useTransition } from 'react';
import type { Preferencias } from '@/lib/avisos';
import { salvarAvisos } from '@/app/acoes/avisos';
import { btn } from './ui';

const ITENS: { k: keyof Preferencias; titulo: string; quando: string }[] = [
  { k: 'resumo', titulo: 'Resumo do dia', quando: 'Seg a sex, 7h51: 3 tarefas principais, agenda, prospecção e cobranças' },
  { k: 'agenda', titulo: 'Compromissos da agenda', quando: 'Antes de cada compromisso do Google Agenda (com o Meet no toque)' },
  { k: 'prospeccao', titulo: 'Prospecção', quando: 'Seg a sex, 13h25: quantos follow-ups e leads novos tem pra hoje' },
  { k: 'tarefas', titulo: 'Tarefas que faltam', quando: 'Seg a sex, 16h30: o que ainda está aberto hoje e as atrasadas' },
  { k: 'financeiro', titulo: 'Cobranças', quando: 'Todo dia, 9h: o que vence hoje e o que está vencido' },
  { k: 'pagamentos', titulo: 'Pagamento recebido', quando: 'Na hora em que o Asaas confirma o pagamento' },
  { k: 'saude', titulo: 'Saúde dos clientes', quando: 'Quando um cliente entra em risco (sem contato, pagamento atrasado, anúncio parado)' },
];

export default function AvisosForm({ prefs }: { prefs: Preferencias }) {
  const [pending, start] = useTransition();
  const [salvo, setSalvo] = useState(false);
  return (
    <form
      onChange={() => setSalvo(false)}
      action={(fd) =>
        start(async () => {
          await salvarAvisos(fd);
          setSalvo(true);
        })
      }
      className="grid gap-3"
    >
      <ul className="divide-y divide-line rounded-lg border border-line">
        {ITENS.map(({ k, titulo, quando }) => (
          <li key={k} className="flex items-start gap-3 px-3 py-2.5">
            <input type="checkbox" id={`aviso-${k}`} name={k} defaultChecked={!!prefs[k]} className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)]" />
            <label htmlFor={`aviso-${k}`} className="min-w-0 flex-1 cursor-pointer">
              <span className="block text-[13.5px] font-semibold">{titulo}</span>
              <span className="block text-[12.5px] text-muted">{quando}</span>
            </label>
            {k === 'agenda' && (
              <select name="antecedencia" defaultValue={prefs.antecedencia} aria-label="Quanto tempo antes" className="field w-auto py-1 text-[12.5px]">
                {[5, 10, 15, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    {m === 60 ? '1 hora' : `${m} min`} antes
                  </option>
                ))}
              </select>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-muted">Não incomodar das</span>
        <input type="time" name="silencio_de" defaultValue={prefs.silencio_de} className="field w-auto py-1" aria-label="Não incomodar a partir de" />
        <span className="text-muted">às</span>
        <input type="time" name="silencio_ate" defaultValue={prefs.silencio_ate} className="field w-auto py-1" aria-label="Não incomodar até" />
      </div>
      <div className="flex items-center gap-3">
        <button className={btn.primary} disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar notificações'}
        </button>
        {salvo && <span className="text-[13px] font-semibold text-success">Salvo.</span>}
      </div>
    </form>
  );
}

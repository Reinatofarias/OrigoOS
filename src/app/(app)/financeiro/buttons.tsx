'use client';

import { useTransition } from 'react';
import { RefreshCw, Send, Sparkles, Trash2 } from 'lucide-react';
import { deleteExpense, emitirMesNoAsaas, generateMonthly, sincronizarAsaas } from '@/app/actions';
import { btn } from '@/components/ui';

export function GenerateButton({ ym, faltam }: { ym: string; faltam: number }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => generateMonthly(ym))} className={btn.primary}>
      <Sparkles size={15} /> {pending ? 'Gerando…' : `Gerar ${faltam} mensalidade${faltam > 1 ? 's' : ''}`}
    </button>
  );
}

export function DeleteExpense({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => confirm('Apagar esta despesa?') && start(() => deleteExpense(id))}
      aria-label="Apagar despesa"
      className="rounded-md p-1.5 text-faint opacity-0 hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
    >
      <Trash2 size={14} />
    </button>
  );
}

export function EmitirMesButton({ ym, qtd }: { ym: string; qtd: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        confirm(`Emitir ${qtd} cobrança${qtd > 1 ? 's' : ''} no Asaas? O Asaas manda a fatura pros clientes.`) &&
        start(async () => {
          const r = await emitirMesNoAsaas(ym);
          alert(r.erros.length ? `Emiti ${r.emitidas}. Não deu pra emitir algumas:\n\n${r.erros.join('\n')}` : `Pronto: ${r.emitidas} cobrança(s) emitida(s) no Asaas.`);
        })
      }
      className={btn.secondary}
    >
      <Send size={15} /> {pending ? 'Emitindo…' : `Emitir ${qtd} no Asaas`}
    </button>
  );
}

export function SincronizarButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Buscar no Asaas quem já pagou"
      onClick={() =>
        start(async () => {
          const r = await sincronizarAsaas();
          if (r.erro) alert(`Não consegui atualizar: ${r.erro}`);
        })
      }
      className={btn.secondary}
    >
      <RefreshCw size={15} className={pending ? 'animate-spin' : ''} /> Atualizar do Asaas
    </button>
  );
}

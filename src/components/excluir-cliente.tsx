'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { excluirCliente } from '@/app/acoes/clientes';
import { btn } from './ui';

// Excluir de vez (pra testes ou cadastro errado). Cliente que só parou fica como inativo.
export function ExcluirCliente({ id, nome, compacto }: { id: string; nome: string; compacto?: boolean }) {
  const [pending, start] = useTransition();
  const excluir = () => {
    const ok = confirm(
      `Excluir "${nome}" de vez?\n\nApaga também as cobranças, tarefas, contratos e relatórios dele. Cobranças pendentes no Asaas são canceladas. Não dá pra desfazer.\n\nSe o cliente só parou, prefira desmarcar "Cliente ativo".`,
    );
    if (!ok) return;
    start(async () => {
      const r = await excluirCliente(id, !compacto);
      if (r?.erro) alert(r.erro);
    });
  };
  if (compacto)
    return (
      <button type="button" onClick={excluir} disabled={pending} aria-label={`Excluir ${nome}`} title="Excluir cliente" className="rounded-md p-1.5 text-faint hover:bg-danger-soft hover:text-danger disabled:opacity-50">
        <Trash2 size={15} />
      </button>
    );
  return (
    <button type="button" onClick={excluir} disabled={pending} className={btn.danger}>
      <Trash2 size={14} /> {pending ? 'Excluindo…' : 'Excluir cliente'}
    </button>
  );
}

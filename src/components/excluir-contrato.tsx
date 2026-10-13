'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { excluirContrato } from '@/app/actions';
import { btn } from './ui';
import { avisar } from './toast';

export function ExcluirContrato({ id, nome, assinado, compacto }: { id: string; nome: string; assinado: boolean; compacto?: boolean }) {
  const [pending, start] = useTransition();
  const excluir = () => {
    const aviso = assinado ? '\n\nAtenção: este contrato já foi ASSINADO. Ao excluir, some o registro da assinatura. Baixe o PDF antes, se precisar.' : '';
    if (!confirm(`Excluir o contrato de "${nome}" de vez?\n\nO link para de funcionar e não dá pra desfazer. O cliente continua cadastrado.${aviso}`)) return;
    start(async () => {
      const r = await excluirContrato(id, !compacto);
      if (r?.erro) alert(r.erro);
      else avisar('Contrato excluído');
    });
  };
  if (compacto)
    return (
      <button type="button" onClick={excluir} disabled={pending} aria-label={`Excluir contrato de ${nome}`} title="Excluir contrato" className="rounded-md p-1.5 text-faint hover:bg-danger-soft hover:text-danger disabled:opacity-50">
        <Trash2 size={15} />
      </button>
    );
  return (
    <button type="button" onClick={excluir} disabled={pending} className={btn.ghost}>
      <Trash2 size={14} /> {pending ? 'Excluindo…' : 'Excluir contrato'}
    </button>
  );
}

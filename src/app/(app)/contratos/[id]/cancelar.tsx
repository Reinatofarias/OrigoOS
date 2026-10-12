'use client';

import { useTransition } from 'react';
import { Ban } from 'lucide-react';
import { cancelarContrato } from '@/app/actions';
import { btn } from '@/components/ui';

export function CancelarContrato({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div>
      <button type="button" disabled={pending} onClick={() => confirm('Cancelar este contrato? O link deixa de aceitar assinatura.') && start(() => cancelarContrato(id))} className={btn.ghost}>
        <Ban size={14} /> Cancelar contrato
      </button>
    </div>
  );
}

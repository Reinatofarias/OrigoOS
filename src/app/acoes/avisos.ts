'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { PADRAO, salvarPreferencias, type Preferencias } from '@/lib/avisos';

const HHMM = /^\d{2}:\d{2}$/;

export async function salvarAvisos(fd: FormData) {
  await requireAuth();
  const liga = (k: keyof Preferencias) => fd.get(k) === 'on';
  const antecedencia = Number(fd.get('antecedencia'));
  const de = String(fd.get('silencio_de') ?? '');
  const ate = String(fd.get('silencio_ate') ?? '');
  await salvarPreferencias(db(), {
    resumo: liga('resumo'),
    agenda: liga('agenda'),
    antecedencia: [5, 10, 15, 30, 60].includes(antecedencia) ? antecedencia : PADRAO.antecedencia,
    tarefas: liga('tarefas'),
    prospeccao: liga('prospeccao'),
    financeiro: liga('financeiro'),
    pagamentos: liga('pagamentos'),
    saude: liga('saude'),
    silencio_de: HHMM.test(de) ? de : PADRAO.silencio_de,
    silencio_ate: HHMM.test(ate) ? ate : PADRAO.silencio_ate,
  });
  revalidatePath('/configuracoes');
}

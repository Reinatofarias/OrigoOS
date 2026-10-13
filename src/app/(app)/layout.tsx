import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { today } from '@/lib/dates';
import Sidebar from '@/components/sidebar';
import Captura from '@/components/captura';
import { Avisos } from '@/components/toast';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  const { data: clientes } = await db().from('clients').select('id, nome').eq('ativo', true).order('nome');
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="pb-[calc(152px+env(safe-area-inset-bottom))] md:pb-24 md:pl-60">{children}</div>
      <Captura clientes={clientes ?? []} hoje={today()} />
      <Avisos />
    </div>
  );
}

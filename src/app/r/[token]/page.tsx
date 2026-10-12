import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db, type Report } from '@/lib/db';
import { formatMonth } from '@/lib/dates';
import RelatorioDoc from '@/components/relatorio-doc';
import { ImprimirBotao } from '../../p/[token]/acoes';

// Página pública do relatório mensal. Só o token do link dá acesso.
async function carregar(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const { data } = await db().from('reports').select('*, clients(nome)').eq('token', token).maybeSingle();
  return data as (Report & { clients: { nome: string } }) | null;
}

export async function generateMetadata({ params }: PageProps<'/r/[token]'>): Promise<Metadata> {
  const r = await carregar((await params).token);
  return { title: r ? `Resultados de ${formatMonth(r.competencia).toLowerCase()} · ${r.clients.nome}` : 'Relatório', robots: { index: false, follow: false } };
}

export default async function RelatorioPublico({ params, searchParams }: PageProps<'/r/[token]'>) {
  const { token } = await params;
  const sp = await searchParams;
  const r = await carregar(token);
  if (!r) notFound();
  const { data: ant } = await db()
    .from('reports')
    .select('investimento, impressoes, cliques, conversoes')
    .eq('client_id', r.client_id)
    .lt('competencia', r.competencia)
    .order('competencia', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (
    <main className="min-h-screen bg-[#eceef6] px-3 py-6 print:bg-white print:p-0 sm:px-6 sm:py-10">
      <RelatorioDoc r={r} anterior={ant} cliente={r.clients.nome} />
      <div className="no-print mx-auto mt-5 w-full max-w-[820px]">
        <ImprimirBotao auto={sp.pdf === '1'} />
      </div>
    </main>
  );
}

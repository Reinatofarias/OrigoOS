import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db, type Proposal } from '@/lib/db';
import { today } from '@/lib/dates';
import { numeroProposta } from '@/lib/propostas';
import PropostaDoc from '@/components/proposta-doc';
import { AceitarBotao, ImprimirBotao } from './acoes';

// Página pública da proposta: o cliente abre pelo link, sem login. Só o token (32 caracteres aleatórios) dá acesso.
async function carregar(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const { data } = await db().from('proposals').select('*, leads(nome, contato, cidade), clients(nome, responsavel, cidade)').eq('token', token).maybeSingle();
  return data as (Proposal & { leads: { nome: string; contato: string | null; cidade: string | null } | null; clients: { nome: string; responsavel: string | null; cidade: string | null } | null }) | null;
}

export async function generateMetadata({ params }: PageProps<'/p/[token]'>): Promise<Metadata> {
  const p = await carregar((await params).token);
  return {
    title: p ? `Proposta ${numeroProposta(p.numero)} · ${p.leads?.nome ?? p.clients?.nome ?? 'Origo'}` : 'Proposta',
    robots: { index: false, follow: false },
  };
}

export default async function PropostaPublica({ params, searchParams }: PageProps<'/p/[token]'>) {
  const { token } = await params;
  const sp = await searchParams;
  const p = await carregar(token);
  if (!p) notFound();
  const para = p.leads ?? (p.clients ? { nome: p.clients.nome, contato: p.clients.responsavel, cidade: p.clients.cidade } : null);
  const vencida = !!p.validade && p.validade < today() && p.status !== 'aceita';

  return (
    <main className="min-h-screen bg-[#eceef6] px-3 py-6 print:bg-white print:p-0 sm:px-6 sm:py-10">
      <PropostaDoc p={p} para={para?.nome ?? 'Cliente'} contato={para?.contato} cidade={para?.cidade} />
      <div className="no-print mx-auto mt-5 flex w-full max-w-[820px] flex-wrap items-center justify-between gap-3">
        <ImprimirBotao auto={sp.pdf === '1'} />
        {p.status === 'aceita' ? (
          <p className="rounded-xl bg-[#e3f6ee] px-4 py-3 text-[14px] font-semibold text-[#0f7a50]">Proposta aceita. Obrigado! O Renato vai falar com você pra marcar o início.</p>
        ) : p.status === 'recusada' ? (
          <p className="text-[14px] text-[#6b6e8a]">Esta proposta foi encerrada.</p>
        ) : vencida ? (
          <p className="text-[14px] text-[#6b6e8a]">Esta proposta passou da validade. Fale com o Renato pra atualizar.</p>
        ) : (
          <AceitarBotao token={token} />
        )}
      </div>
    </main>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db, type Contract, type Empresa } from '@/lib/db';
import { clausulas, numeroContrato, type Clausula } from '@/lib/contrato';
import { lerEmpresa } from '@/lib/contratos';
import ContratoDoc from '@/components/contrato-doc';
import { ImprimirBotao } from '../../p/[token]/acoes';
import AssinarContrato from './assinar';

// Página pública do contrato: o cliente lê, preenche os dados e assina. Só o token do link dá acesso.
async function carregar(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const { data } = await db().from('contracts').select('*').eq('token', token).maybeSingle();
  return data as Contract | null;
}

export async function generateMetadata({ params }: PageProps<'/c/[token]'>): Promise<Metadata> {
  const c = await carregar((await params).token);
  return { title: c ? `Contrato ${numeroContrato(c.numero)} · ${c.contratante.nome || 'Origo'}` : 'Contrato', robots: { index: false, follow: false } };
}

export default async function ContratoPublico({ params, searchParams }: PageProps<'/c/[token]'>) {
  const { token } = await params;
  const sp = await searchParams;
  const c = await carregar(token);
  if (!c) notFound();
  // Assinado: mostra exatamente o texto que foi assinado.
  let empresa: Empresa;
  let itens: Clausula[];
  if (c.status === 'assinado' && c.conteudo) {
    ({ empresa, clausulas: itens } = JSON.parse(c.conteudo) as { empresa: Empresa; clausulas: Clausula[] });
  } else {
    empresa = await lerEmpresa(db());
    itens = clausulas(empresa, c);
  }

  return (
    <main className="min-h-screen bg-[#eceef6] px-3 py-6 print:bg-white print:p-0 sm:px-6 sm:py-10">
      {c.status === 'aguardando' ? <AssinarContrato token={token} c={c} empresa={empresa} /> : <ContratoDoc c={c} empresa={empresa} itens={itens} />}
      <div className="no-print mx-auto mt-5 grid w-full max-w-[820px] gap-4">
        {c.status === 'assinado' && <p className="rounded-xl bg-[#e3f6ee] px-4 py-3 text-[14px] text-[#0f7a50]">Contrato assinado. Obrigado! Você pode baixar uma cópia em PDF abaixo.</p>}
        {c.status === 'cancelado' && <p className="text-[14px] text-[#6b6e8a]">Este contrato foi cancelado.</p>}
        <div>
          <ImprimirBotao auto={sp.pdf === '1'} />
        </div>
      </div>
    </main>
  );
}

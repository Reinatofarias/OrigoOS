import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { db, type Contract, type Empresa } from '@/lib/db';
import { clausulas, numeroContrato, type Clausula } from '@/lib/contrato';
import { lerEmpresa } from '@/lib/contratos';
import ContratoDoc from '@/components/contrato-doc';
import { ImprimirBotao } from '../../p/[token]/acoes';
import { AssinarBotao, DadosForm } from './assinar';

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
  // Contrato assinado fora do sistema: aqui não tem texto, só o link do arquivo (se houver).
  if (c.modelo?.externo) {
    if (c.modelo.link) redirect(c.modelo.link);
    notFound();
  }
  // Passo 1: enquanto o cliente não manda os dados (ou pede pra corrigir), só aparece o formulário.
  const preencher = c.status === 'aguardando' && (!c.contratante.preenchido_em || sp.editar === '1');
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
      {preencher ? (
        <DadosForm token={token} contratante={c.contratante} />
      ) : (
        <>
          {c.status === 'aguardando' && (
            <p className="no-print mx-auto mb-4 w-full max-w-[820px] rounded-xl bg-[#ece8ff] px-4 py-3 text-[14px] text-[#3b2a99]">
              Seus dados foram enviados. Confira o contrato abaixo e assine no final da página.
            </p>
          )}
          <ContratoDoc c={c} empresa={empresa} itens={itens} />
          {c.status === 'aguardando' && (
            <div className="no-print mt-5">
              <AssinarBotao token={token} />
            </div>
          )}
        </>
      )}
      <div className="no-print mx-auto mt-5 grid w-full max-w-[820px] gap-4">
        {c.status === 'assinado' && <p className="rounded-xl bg-[#e3f6ee] px-4 py-3 text-[14px] text-[#0f7a50]">Contrato assinado. Obrigado! Você pode baixar uma cópia em PDF abaixo.</p>}
        {c.status === 'cancelado' && <p className="text-[14px] text-[#6b6e8a]">Este contrato foi cancelado.</p>}
        {!preencher && (
          <div>
            <ImprimirBotao auto={sp.pdf === '1'} />
          </div>
        )}
      </div>
    </main>
  );
}

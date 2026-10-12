import type { Metadata } from 'next';
import Image from 'next/image';
import ContatoForm from './form';

export const metadata: Metadata = { title: 'Fale com a Origo Company', robots: { index: false, follow: false } };

// Formulário de contato público. Dá pra pôr no site (link ou dentro de um quadro, "iframe").
export default async function Contato({ searchParams }: PageProps<'/f'>) {
  const sp = await searchParams;
  const embutido = sp.embed === '1';
  return (
    <main className={`flex min-h-screen items-start justify-center px-4 py-8 sm:items-center ${embutido ? 'bg-transparent' : 'bg-[radial-gradient(ellipse_at_top,#1a1450_0%,#05050f_60%)]'}`}>
      <div className="w-full max-w-md">
        {!embutido && (
          <div className="mb-6 flex items-center justify-center gap-3 text-white">
            <Image src="/brand/origo-marca.png" alt="" width={44} height={44} className="size-11" />
            <div>
              <p className="text-[20px] font-bold leading-none">Origo</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#b9bbdc]">Company</p>
            </div>
          </div>
        )}
        <div className="rounded-2xl border border-[#e5e7f0] bg-white p-6 text-[#14152e] shadow-2xl">
          <h1 className="text-[20px] font-bold">Quer mais clientes chegando pelo Google e pelo Instagram?</h1>
          <p className="mt-1 text-[14px] text-[#6b6e8a]">Deixe seu contato. O Renato te chama no WhatsApp ainda hoje (em horário comercial).</p>
          <ContatoForm />
        </div>
      </div>
    </main>
  );
}

import Image from 'next/image';
import type { Contract, Empresa } from '@/lib/db';
import { type Clausula, formatDoc, numeroContrato } from '@/lib/contrato';

function dataHora(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));
}

// O contrato como documento: na tela, no link do cliente e no PDF.
export default function ContratoDoc({ c, empresa, itens }: { c: Contract; empresa: Empresa; itens: Clausula[] }) {
  return (
    <article className="proposta mx-auto w-full max-w-[820px] overflow-hidden rounded-2xl border border-[#e5e7f0] bg-white text-[#14152e] shadow-xl print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[#0b0c24] px-8 py-6 text-white sm:px-10">
        <span className="flex items-center gap-3">
          <Image src="/brand/origo-marca.png" alt="" width={40} height={40} className="size-10" />
          <span className="leading-none">
            <span className="block text-[18px] font-bold tracking-tight">Origo</span>
            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b9bbdc]">Company</span>
          </span>
        </span>
        <span className="text-right text-[12.5px] text-[#b9bbdc]">
          <span className="block font-semibold uppercase tracking-[0.16em]">Contrato Nº {numeroContrato(c.numero)}</span>
          <span>{new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', dateStyle: 'long' }).format(new Date(c.created_at))}</span>
        </span>
      </header>
      <div className="grid gap-6 px-8 py-8 text-[14px] leading-relaxed sm:px-10 print:gap-4 print:py-6 print:text-[12.5px]">
        <h1 className="text-center text-[18px] font-bold uppercase tracking-wide">Contrato de prestação de serviços de marketing digital</h1>
        {itens.map((cl, n) => (
          <section key={cl.titulo} className="[break-inside:avoid]">
            <h2 className="mb-1.5 text-[13px] font-bold uppercase tracking-wide text-[#6a4cff]">
              Cláusula {n + 1}ª · {cl.titulo}
            </h2>
            {cl.paragrafos.map((p, i) => (
              <p key={i} className={`text-[#2b2d48] ${p.startsWith('•') ? 'pl-3' : ''} ${i ? 'mt-1.5' : ''}`}>
                {p}
              </p>
            ))}
          </section>
        ))}

        <section className="mt-2 grid gap-4 border-t border-[#e5e7f0] pt-6 sm:grid-cols-2 [break-inside:avoid]">
          <div className="rounded-xl bg-[#f5f6fa] p-4">
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-[#6b6e8a]">Contratada</p>
            <p className="mt-1 font-semibold">{empresa.responsavel}</p>
            <p className="text-[13px] text-[#6b6e8a]">{empresa.nome}</p>
            <p className="mt-2 text-[12px] text-[#6b6e8a]">Emitido eletronicamente pela contratada em {dataHora(c.created_at)}.</p>
          </div>
          <div className={`rounded-xl p-4 ${c.status === 'assinado' ? 'bg-[#e3f6ee]' : 'border border-dashed border-[#c9cbe0]'}`}>
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-[#6b6e8a]">Contratante</p>
            {c.status === 'assinado' && c.assinado_em ? (
              <>
                <p className="mt-1 font-semibold">{c.assinado_nome}</p>
                <p className="text-[13px] text-[#3d3f5c]">CPF {formatDoc(c.assinado_documento)} · por {c.contratante.nome}</p>
                <p className="mt-2 text-[12px] text-[#0f7a50]">
                  Assinado eletronicamente em {dataHora(c.assinado_em)}
                  {c.assinado_ip ? `, IP ${c.assinado_ip}` : ''}.
                </p>
              </>
            ) : (
              <p className="mt-1 text-[13px] text-[#6b6e8a]">Aguardando assinatura.</p>
            )}
          </div>
        </section>
        {c.hash && <p className="break-all text-[11px] text-[#9a9cb5]">Código de verificação do documento (SHA-256): {c.hash}</p>}
      </div>
    </article>
  );
}

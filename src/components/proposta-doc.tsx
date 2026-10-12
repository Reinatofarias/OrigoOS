import Image from 'next/image';
import type { ItemProposta, Proposal } from '@/lib/db';
import { brl } from '@/lib/format';
import { formatShort } from '@/lib/dates';
import { numeroProposta, totais } from '@/lib/propostas';

type Dados = Pick<Proposal, 'numero' | 'titulo' | 'introducao' | 'desconto' | 'validade' | 'condicoes' | 'created_at'> & { itens: ItemProposta[] };

function dataLonga(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

// A proposta como o cliente vê: na tela, no link público e no PDF (impressão).
export default function PropostaDoc({ p, para, contato, cidade }: { p: Dados; para: string; contato?: string | null; cidade?: string | null }) {
  const t = totais(p.itens, p.desconto);
  const condicoes = (p.condicoes ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const mensais = p.itens.filter((i) => i.cobranca === 'mensal');
  const unicos = p.itens.filter((i) => i.cobranca === 'unico');

  return (
    <article className="proposta mx-auto w-full max-w-[820px] overflow-hidden rounded-2xl border border-[#e5e7f0] bg-white text-[#14152e] shadow-xl print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <header className="relative overflow-hidden bg-[#0b0c24] px-8 py-8 text-white sm:px-10 print:py-6">
        <div className="bg-grad pointer-events-none absolute -right-20 -top-24 size-72 rounded-full opacity-40 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <span className="flex items-center gap-3">
            <Image src="/brand/origo-marca.png" alt="" width={44} height={44} className="size-11" />
            <span className="leading-none">
              <span className="block text-[20px] font-bold tracking-tight">Origo</span>
              <span className="mt-1 block text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#b9bbdc]">Company</span>
            </span>
          </span>
          <div className="text-right text-[12.5px] text-[#b9bbdc]">
            <p className="font-semibold uppercase tracking-[0.16em]">Proposta Nº {numeroProposta(p.numero)}</p>
            <p>{dataLonga(p.created_at)}</p>
          </div>
        </div>
        <div className="relative mt-10 print:mt-5">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-[#b9bbdc]">{p.titulo}</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-tight">{para}</h1>
          {(contato || cidade) && <p className="mt-1 text-[14px] text-[#b9bbdc]">{[contato && `A/C ${contato}`, cidade].filter(Boolean).join(' · ')}</p>}
        </div>
      </header>

      <div className="grid gap-8 px-8 py-8 sm:px-10 print:gap-5 print:py-6">
        {p.introducao && <p className="whitespace-pre-line text-[15px] leading-relaxed text-[#3d3f5c]">{p.introducao}</p>}

        <section>
          <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-[#6a4cff]">O que está incluso</h2>
          <ul className="divide-y divide-[#e5e7f0] rounded-xl border border-[#e5e7f0]">
            {[...mensais, ...unicos].map((i, n) => (
              <li key={n} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 px-5 py-4 [break-inside:avoid] print:py-3">
                <div className="min-w-0 flex-1 basis-[300px]">
                  <p className="text-[15px] font-semibold">{i.nome}</p>
                  {i.descricao && <p className="mt-0.5 text-[13.5px] leading-relaxed text-[#6b6e8a]">{i.descricao}</p>}
                </div>
                <p className="whitespace-nowrap text-[15px] font-semibold tabular-nums">
                  {brl(i.valor)}
                  <span className="ml-1 text-[12px] font-medium text-[#6b6e8a]">{i.cobranca === 'mensal' ? '/mês' : 'pagamento único'}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 [break-inside:avoid]">
          {t.mensal > 0 && (
            <div className="rounded-xl bg-[#0b0c24] p-5 text-white">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b9bbdc]">Investimento mensal</p>
              {t.desconto > 0 && <p className="mt-2 text-[13px] text-[#b9bbdc] line-through">{brl(t.mensal)}</p>}
              <p className="text-grad mt-1 text-[30px] font-bold tabular-nums print:bg-none print:text-[#4cc4ff]">{brl(t.mensalFinal)}</p>
              <p className="text-[12.5px] text-[#b9bbdc]">por mês{t.desconto > 0 ? ` · desconto de ${brl(t.desconto)}` : ''}</p>
            </div>
          )}
          {t.unico > 0 && (
            <div className="rounded-xl border border-[#e5e7f0] p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6b6e8a]">Investimento único</p>
              <p className="mt-1 text-[30px] font-bold tabular-nums">{brl(t.unico)}</p>
              <p className="text-[12.5px] text-[#6b6e8a]">pago uma vez, no início</p>
            </div>
          )}
        </section>

        {condicoes.length > 0 && (
          <section className="[break-inside:avoid]">
            <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-[#6a4cff]">Condições</h2>
            <ul className="grid gap-2 text-[14px] leading-relaxed text-[#3d3f5c]">
              {condicoes.map((c, n) => (
                <li key={n} className="flex gap-2.5">
                  <span className="bg-grad mt-2 size-1.5 shrink-0 rounded-full" />
                  {c}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="[break-inside:avoid]">
          <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-[#6a4cff]">Próximos passos</h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {['Você aceita a proposta', 'Reunião de briefing e acessos', 'Campanhas no ar em até 7 dias'].map((x, n) => (
              <li key={x} className="rounded-xl bg-[#f5f6fa] p-4 print:p-3">
                <span className="bg-grad grid size-7 place-items-center rounded-full text-[13px] font-bold text-white">{n + 1}</span>
                <p className="mt-2 text-[13.5px] font-semibold">{x}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e5e7f0] px-8 py-5 text-[12.5px] text-[#6b6e8a] sm:px-10">
        <span>
          <strong className="text-[#14152e]">Renato Farias</strong> · Origo Company · @origocompanybr
        </span>
        {p.validade && <span>Proposta válida até {formatShort(p.validade)}/{p.validade.slice(0, 4)}</span>}
      </footer>
    </article>
  );
}

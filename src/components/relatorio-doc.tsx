import Image from 'next/image';
import type { Report } from '@/lib/db';
import { brl } from '@/lib/format';
import { formatMonth } from '@/lib/dates';
import { metricas, variacao, type Numeros } from '@/lib/relatorio';

const INT = new Intl.NumberFormat('pt-BR');
const PCT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

type Dados = Numeros & Pick<Report, 'competencia' | 'conversao_nome' | 'destaques' | 'proximos_passos'>;

function Card({ label, valor, delta, menorMelhor, destaque }: { label: string; valor: string; delta: number | null; menorMelhor?: boolean; destaque?: boolean }) {
  const bom = delta === null ? null : menorMelhor ? delta < 0 : delta > 0;
  return (
    <div className={`rounded-xl p-4 [break-inside:avoid] ${destaque ? 'bg-[#0b0c24] text-white' : 'border border-[#e5e7f0]'}`}>
      <p className={`text-[11.5px] font-semibold uppercase tracking-[0.12em] ${destaque ? 'text-[#b9bbdc]' : 'text-[#6b6e8a]'}`}>{label}</p>
      <p className={`mt-1 text-[24px] font-bold tabular-nums ${destaque ? 'text-grad print:bg-none print:text-[#4cc4ff]' : ''}`}>{valor}</p>
      {delta !== null && (
        <p className={`text-[12px] font-semibold ${bom ? 'text-[#0f9a64]' : 'text-[#dc3a40]'} ${destaque && bom ? 'text-[#3fcf8e]' : ''}`}>
          {delta > 0 ? '▲' : '▼'} {PCT.format(Math.abs(delta))}% vs. mês anterior
        </p>
      )}
    </div>
  );
}

const linhas = (t: string | null) => (t ?? '').split('\n').map((l) => l.trim().replace(/^[-•]\s*/, '')).filter(Boolean);

// Relatório mensal de resultados como o cliente vê (link e PDF).
export default function RelatorioDoc({ r, anterior, cliente }: { r: Dados; anterior?: Numeros | null; cliente: string }) {
  const m = metricas(r);
  const a = anterior ? metricas(anterior) : null;
  const fmt = (v: number | null, f: (x: number) => string) => (v === null ? '—' : f(v));
  const destaques = linhas(r.destaques);
  const passos = linhas(r.proximos_passos);

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
          <p className="text-right text-[12.5px] font-semibold uppercase tracking-[0.16em] text-[#b9bbdc]">Relatório de resultados</p>
        </div>
        <div className="relative mt-10 print:mt-5">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-[#b9bbdc]">{formatMonth(r.competencia)}</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-tight">{cliente}</h1>
        </div>
      </header>

      <div className="grid gap-8 px-8 py-8 sm:px-10 print:gap-5 print:py-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card destaque label={r.conversao_nome || 'Conversões'} valor={fmt(m.conversoes, INT.format)} delta={variacao(m.conversoes, a?.conversoes)} />
          <Card label={`Custo por ${(r.conversao_nome || 'conversão').toLowerCase().replace(/s$/, '')}`} valor={fmt(m.cpa, (x) => brl(x))} delta={variacao(m.cpa, a?.cpa)} menorMelhor />
          <Card label="Investimento" valor={fmt(m.investimento, (x) => brl(x))} delta={null} />
          <Card label="Cliques" valor={fmt(m.cliques, INT.format)} delta={variacao(m.cliques, a?.cliques)} />
          <Card label="Taxa de cliques (CTR)" valor={fmt(m.ctr, (x) => `${PCT.format(x)}%`)} delta={variacao(m.ctr, a?.ctr)} />
          <Card label="Custo por clique" valor={fmt(m.cpc, (x) => brl(x))} delta={variacao(m.cpc, a?.cpc)} menorMelhor />
        </section>
        {m.impressoes !== null && (
          <p className="-mt-4 text-[13px] text-[#6b6e8a] print:-mt-2">Seus anúncios apareceram {INT.format(m.impressoes)} vezes neste mês.</p>
        )}

        {destaques.length > 0 && (
          <section className="[break-inside:avoid]">
            <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-[#6a4cff]">O que aconteceu no mês</h2>
            <ul className="grid gap-2 text-[14px] leading-relaxed text-[#3d3f5c]">
              {destaques.map((d, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="bg-grad mt-2 size-1.5 shrink-0 rounded-full" />
                  {d}
                </li>
              ))}
            </ul>
          </section>
        )}
        {passos.length > 0 && (
          <section className="[break-inside:avoid]">
            <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-[#6a4cff]">Próximos passos</h2>
            <ol className="grid gap-2">
              {passos.map((p, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl bg-[#f5f6fa] p-3 text-[14px]">
                  <span className="bg-grad grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white">{i + 1}</span>
                  {p}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e5e7f0] px-8 py-5 text-[12.5px] text-[#6b6e8a] sm:px-10">
        <span>
          <strong className="text-[#14152e]">Renato Farias</strong> · Origo Company · @origocompanybr
        </span>
        <span>Dúvidas? Me chama no WhatsApp.</span>
      </footer>
    </article>
  );
}

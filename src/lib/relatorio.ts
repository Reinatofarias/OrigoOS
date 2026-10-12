import type { Report } from './db';

export type Numeros = Pick<Report, 'investimento' | 'impressoes' | 'cliques' | 'conversoes'>;

const n = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? null : Number(v));

// Métricas derivadas: CTR, custo por clique e custo por conversão.
export function metricas(r: Numeros) {
  const inv = n(r.investimento);
  const imp = n(r.impressoes);
  const cli = n(r.cliques);
  const conv = n(r.conversoes);
  return {
    investimento: inv,
    impressoes: imp,
    cliques: cli,
    conversoes: conv,
    ctr: imp && cli !== null ? (cli / imp) * 100 : null,
    cpc: inv !== null && cli ? inv / cli : null,
    cpa: inv !== null && conv ? inv / conv : null,
  };
}

// Variação em % contra o mês anterior (null quando não dá pra comparar).
export function variacao(atual: number | null, anterior: number | null | undefined) {
  if (atual === null || anterior === null || anterior === undefined || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

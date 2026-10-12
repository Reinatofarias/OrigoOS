import type { Charge } from './db';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function brl(valor: number | string | null | undefined, centavos = true) {
  return (centavos ? BRL : BRL0).format(Number(valor ?? 0));
}

export type SituacaoCobranca = 'pago' | 'vencido' | 'pendente' | 'cancelado';

export function situacao(c: Pick<Charge, 'status' | 'vencimento'>, hoje: string): SituacaoCobranca {
  if (c.status === 'pago' || c.status === 'cancelado') return c.status;
  return c.vencimento < hoje ? 'vencido' : 'pendente';
}

export const SITUACAO: Record<SituacaoCobranca, { label: string; tone: 'success' | 'danger' | 'warn' | 'neutral' }> = {
  pago: { label: 'Recebida', tone: 'success' },
  vencido: { label: 'Vencida', tone: 'danger' },
  pendente: { label: 'Aguardando', tone: 'warn' },
  cancelado: { label: 'Cancelada', tone: 'neutral' },
};

export const FORMA: Record<NonNullable<Charge['forma']>, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
};

export const CATEGORIAS = ['ferramentas', 'impostos', 'marketing', 'pessoal', 'escritório', 'outros'] as const;

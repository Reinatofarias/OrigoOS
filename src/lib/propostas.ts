import type { ItemProposta, Plataforma, Proposal, Service } from './db';

export const STATUS_PROPOSTA: Record<Proposal['status'], { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' }> = {
  rascunho: { label: 'Rascunho', tone: 'neutral' },
  enviada: { label: 'Enviada', tone: 'info' },
  aceita: { label: 'Aceita', tone: 'success' },
  recusada: { label: 'Recusada', tone: 'danger' },
};

export const INTRODUCAO_PADRAO =
  'Obrigado pela conversa. Abaixo está o que a Origo vai fazer pra sua empresa ser encontrada por quem já está procurando o seu serviço e transformar esse interesse em clientes.';

export const CONDICOES_PADRAO = [
  'Mensalidade paga todo mês, por Pix ou boleto, a partir do início do trabalho.',
  'O investimento em anúncios é pago direto às plataformas (Google e Meta) e não está incluso nos valores acima.',
  'Contrato mensal, sem fidelidade. Pra encerrar, basta avisar com 30 dias de antecedência.',
  'Relatório mensal de resultados e acompanhamento pelo WhatsApp.',
].join('\n');

export function itemDoServico(s: Service): ItemProposta {
  return { service_id: s.id, nome: s.nome, descricao: s.descricao, valor: Number(s.preco), cobranca: s.cobranca, plataforma: s.plataforma };
}

export function totais(itens: ItemProposta[], desconto = 0) {
  const mensal = itens.filter((i) => i.cobranca === 'mensal').reduce((s, i) => s + Number(i.valor || 0), 0);
  const unico = itens.filter((i) => i.cobranca === 'unico').reduce((s, i) => s + Number(i.valor || 0), 0);
  const d = Math.min(Number(desconto || 0), mensal);
  return { mensal, unico, desconto: d, mensalFinal: mensal - d };
}

// Junta as plataformas dos serviços: Google + Meta vira "google_meta".
export function plataformaDosItens(itens: ItemProposta[]): Plataforma | null {
  const ps = new Set(itens.flatMap((i) => (i.plataforma === 'google_meta' ? ['google', 'meta'] : i.plataforma ? [i.plataforma] : [])));
  if (ps.has('google') && ps.has('meta')) return 'google_meta';
  if (ps.has('meta')) return 'meta';
  if (ps.has('google')) return 'google';
  return null;
}

export function numeroProposta(n: number) {
  return String(n).padStart(4, '0');
}

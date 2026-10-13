import type { Charge } from './db';
import { brl, situacao } from './format';
import { formatShort } from './dates';
import { normalizeWhatsapp } from './prospeccao';

export type ContatoCliente = { nome: string; responsavel: string | null; telefone: string | null };

// Mensagem de cobrança pronta pro WhatsApp: lembrete antes de vencer, cobrança gentil depois.
export function mensagemCobranca(c: Pick<Charge, 'valor' | 'vencimento' | 'status' | 'asaas_url'>, k: ContatoCliente, hoje: string) {
  const nome = (k.responsavel || k.nome).trim().split(/\s+/)[0];
  const valor = brl(c.valor);
  const dia = formatShort(c.vencimento);
  const link = c.asaas_url ? `\n\nLink pra pagar (Pix, boleto ou cartão): ${c.asaas_url}` : '';
  if (situacao(c, hoje) === 'vencido')
    return `Oi, ${nome}, tudo bem? Vi aqui que a mensalidade da Origo de ${valor}, com vencimento em ${dia}, ainda está em aberto.${link}\n\nSe já pagou, desconsidera e me manda o comprovante, por favor. Obrigado!`;
  const quando = c.vencimento === hoje ? 'vence hoje' : `vence dia ${dia}`;
  return `Oi, ${nome}, tudo bem? Passando pra lembrar que a mensalidade da Origo de ${valor} ${quando}.${link}\n\nQualquer coisa, me chama aqui.`;
}

export function linkCobranca(c: Pick<Charge, 'valor' | 'vencimento' | 'status' | 'asaas_url'>, k: ContatoCliente, hoje: string) {
  const tel = k.telefone ? normalizeWhatsapp(k.telefone) : null;
  return `https://wa.me/${tel ?? ''}?text=${encodeURIComponent(mensagemCobranca(c, k, hoje))}`;
}

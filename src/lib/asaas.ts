import 'server-only';
import type { Charge, Client } from './db';
import { today } from './dates';

// Integração com o Asaas (API v3). A chave fica só na Vercel, em ASAAS_API_KEY.
// Chave de sandbox começa com $aact_hmlg_ e usa o ambiente de testes automaticamente.

function chave() {
  return process.env.ASAAS_API_KEY?.trim() || null;
}

export function asaasConfigurado() {
  return !!chave();
}

export function asaasAmbiente(): 'sandbox' | 'producao' | null {
  const k = chave();
  if (!k) return null;
  return k.startsWith('$aact_hmlg_') ? 'sandbox' : 'producao';
}

function base() {
  if (process.env.ASAAS_BASE_URL) return process.env.ASAAS_BASE_URL.replace(/\/$/, '');
  return asaasAmbiente() === 'sandbox' ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3';
}

export class AsaasErro extends Error {}

async function chamar<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const k = chave();
  if (!k) throw new AsaasErro('Asaas não configurado: falta a variável ASAAS_API_KEY na Vercel.');
  const res = await fetch(`${base()}${path}`, {
    method: init.method ?? 'GET',
    headers: { access_token: k, 'Content-Type': 'application/json', 'User-Agent': 'OrigoOS' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.errors?.[0]?.description ?? `o Asaas respondeu ${res.status}`;
    throw new AsaasErro(res.status === 401 ? 'chave do Asaas inválida (confira ASAAS_API_KEY).' : msg);
  }
  return json as T;
}

export type AsaasPayment = {
  id: string;
  status: string;
  value: number;
  billingType: string;
  invoiceUrl: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  externalReference?: string | null;
};

export function soDigitos(v: string | null | undefined) {
  return (v ?? '').replace(/\D/g, '');
}

// Cadastra o cliente no Asaas (uma vez) e devolve o id dele lá.
export async function garantirCliente(c: Pick<Client, 'id' | 'nome' | 'documento' | 'email' | 'telefone' | 'asaas_customer_id'>) {
  if (c.asaas_customer_id) return c.asaas_customer_id;
  const doc = soDigitos(c.documento);
  if (doc.length !== 11 && doc.length !== 14) {
    throw new AsaasErro(`${c.nome} está sem CPF ou CNPJ. Preencha em Clientes > Dados cadastrais.`);
  }
  const fone = soDigitos(c.telefone).replace(/^55(?=\d{10,11}$)/, '');
  const r = await chamar<{ id: string }>('/customers', {
    method: 'POST',
    body: {
      name: c.nome,
      cpfCnpj: doc,
      email: c.email || undefined,
      mobilePhone: fone || undefined,
      externalReference: c.id,
    },
  });
  return r.id;
}

// Emite a cobrança no Asaas. O cliente escolhe na fatura se paga por Pix, boleto ou cartão.
export async function emitirCobranca(customer: string, ch: Pick<Charge, 'id' | 'valor' | 'vencimento' | 'descricao'>) {
  const hoje = today();
  return chamar<AsaasPayment>('/payments', {
    method: 'POST',
    body: {
      customer,
      billingType: 'UNDEFINED',
      value: Number(ch.valor),
      dueDate: ch.vencimento < hoje ? hoje : ch.vencimento,
      description: ch.descricao,
      externalReference: ch.id,
    },
  });
}

export function buscarCobranca(id: string) {
  return chamar<AsaasPayment>(`/payments/${id}`);
}

export async function removerCobranca(id: string) {
  await chamar(`/payments/${id}`, { method: 'DELETE' });
}

const PAGO = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
const CANCELADO = ['REFUNDED', 'DELETED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED'];

const FORMA: Record<string, Charge['forma']> = { PIX: 'pix', BOLETO: 'boleto', CREDIT_CARD: 'cartao', DEBIT_CARD: 'cartao' };

// Traduz a situação do Asaas para os campos da cobrança no Origo OS.
export function camposDoPagamento(p: Pick<AsaasPayment, 'status' | 'billingType' | 'paymentDate' | 'clientPaymentDate'>) {
  if (PAGO.includes(p.status)) {
    return {
      status: 'pago' as const,
      pago_em: p.paymentDate ?? p.clientPaymentDate ?? today(),
      forma: p.status === 'RECEIVED_IN_CASH' ? ('dinheiro' as const) : (FORMA[p.billingType] ?? 'pix'),
      asaas_status: p.status,
    };
  }
  if (CANCELADO.includes(p.status)) return { status: 'cancelado' as const, pago_em: null, forma: null, asaas_status: p.status };
  return { status: 'pendente' as const, pago_em: null, forma: null, asaas_status: p.status };
}

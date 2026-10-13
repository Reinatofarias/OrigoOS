import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EMPRESA_PADRAO, type Client, type Empresa, type ItemProposta, type Proposal } from './db';

export async function lerEmpresa(supa: SupabaseClient): Promise<Empresa> {
  const { data } = await supa.from('settings').select('valor').eq('chave', 'empresa').maybeSingle();
  return { ...EMPRESA_PADRAO, ...((data?.valor as Partial<Empresa>) ?? {}) };
}

// Cria o contrato de uma proposta aceita (uma vez só), já com os dados que o sistema tem do cliente.
export async function criarContrato(supa: SupabaseClient, proposalId: string) {
  const { data: existe } = await supa.from('contracts').select('id').eq('proposal_id', proposalId).neq('status', 'cancelado').maybeSingle();
  if (existe) return existe.id as string;
  const { data } = await supa
    .from('proposals')
    .select('*, leads(nome, contato, whatsapp, client_id), clients(*)')
    .eq('id', proposalId)
    .single();
  if (!data) return null;
  const p = data as Proposal & {
    leads: { nome: string; contato: string | null; whatsapp: string | null; client_id: string | null } | null;
    clients: { id: string; nome: string; documento: string | null; endereco: string | null; email: string | null; telefone: string | null; responsavel: string | null; dia_vencimento: number } | null;
  };
  const c = p.clients;
  const { data: novo } = await supa
    .from('contracts')
    .insert({
      proposal_id: p.id,
      lead_id: p.lead_id,
      client_id: p.client_id ?? p.leads?.client_id ?? null,
      itens: p.itens,
      desconto: p.desconto,
      dia_vencimento: c?.dia_vencimento ?? 10,
      contratante: {
        nome: c?.nome ?? p.leads?.nome ?? '',
        documento: c?.documento ?? '',
        endereco: c?.endereco ?? '',
        email: c?.email ?? '',
        telefone: c?.telefone ?? p.leads?.whatsapp ?? '',
        representante: c?.responsavel ?? p.leads?.contato ?? '',
      },
    })
    .select('id')
    .single();
  return (novo?.id as string) ?? null;
}

// Contrato pra quem já é cliente e não passou por proposta: usa os serviços (ou a mensalidade) do cadastro.
export async function criarContratoDoCliente(supa: SupabaseClient, clientId: string) {
  const { data: existe } = await supa.from('contracts').select('id').eq('client_id', clientId).eq('status', 'aguardando').limit(1).maybeSingle();
  if (existe) return existe.id as string;
  const { data } = await supa.from('clients').select('*').eq('id', clientId).maybeSingle();
  if (!data) return null;
  const c = data as Client;
  const plataforma = c.plataforma === 'google_meta' ? 'Google e Meta Ads' : c.plataforma === 'meta' ? 'Meta Ads' : 'Google Ads';
  const itens: ItemProposta[] = c.servicos?.length
    ? c.servicos
    : [{ service_id: null, nome: `Gestão de tráfego pago (${plataforma})`, descricao: null, valor: Number(c.mensalidade ?? 0), cobranca: 'mensal', plataforma: c.plataforma }];
  const { data: novo } = await supa
    .from('contracts')
    .insert({
      client_id: c.id,
      itens,
      desconto: 0,
      dia_vencimento: c.dia_vencimento ?? 10,
      contratante: {
        nome: c.nome,
        documento: c.documento ?? '',
        endereco: c.endereco ?? '',
        email: c.email ?? '',
        telefone: c.telefone ?? '',
        representante: c.responsavel ?? '',
      },
    })
    .select('id')
    .single();
  return (novo?.id as string) ?? null;
}

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EMPRESA_PADRAO, type Client, type Contract, type Contratante, type Empresa, type ItemProposta, type ModeloContrato, type Proposal } from './db';
import { modeloDe, numeroContrato, temEmpresa } from './contrato';
import { totais } from './propostas';
import { criarOnboarding } from './modelos';
import { today } from './dates';

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

// Contrato montado na tela "Novo contrato": tipo, redes e serviços escolhidos pelo Renato.
// Sem cliente cadastrado, o contrato sai só com o nome; o cliente preenche o resto no link.
export async function criarContratoNovo(
  supa: SupabaseClient,
  d: { clientId: string | null; nome: string | null; telefone: string | null; itens: ItemProposta[]; modelo: ModeloContrato; dia_vencimento: number },
) {
  let contratante: Contratante = { nome: d.nome ?? '', telefone: d.telefone ?? '' };
  if (d.clientId) {
    const { data } = await supa.from('clients').select('*').eq('id', d.clientId).maybeSingle();
    if (!data) return null;
    const c = data as Client;
    contratante = { nome: c.nome, documento: c.documento ?? '', endereco: c.endereco ?? '', email: c.email ?? '', telefone: c.telefone ?? '', representante: c.responsavel ?? '' };
  }
  const { data: novo } = await supa
    .from('contracts')
    .insert({ client_id: d.clientId, itens: d.itens, desconto: 0, dia_vencimento: d.dia_vencimento, modelo: d.modelo, contratante })
    .select('id')
    .single();
  return (novo?.id as string) ?? null;
}

// Depois da assinatura: quem ainda não era cliente vira cliente, com os serviços do contrato. Fica faltando só cobrar.
export async function clienteDoContrato(supa: SupabaseClient, c: Contract, k: Contratante) {
  const m = modeloDe(c);
  const r = new Set(m.redes);
  const plataforma = r.has('google') && r.has('meta') ? 'google_meta' : r.has('meta') ? 'meta' : 'google';
  const t = totais(c.itens, c.desconto);
  const promo = Number(m.promo_valor) > 0 && Number(m.promo_meses) > 0 ? Number(m.promo_valor) : null;
  const { data } = await supa
    .from('clients')
    .insert({
      nome: (temEmpresa(k) ? k.nome : k.representante || k.nome) || 'Cliente novo',
      plataforma,
      mensalidade: t.mensal > 0 ? (promo ?? t.mensalFinal) : null,
      dia_vencimento: c.dia_vencimento,
      responsavel: k.representante || null,
      email: k.email || null,
      telefone: k.telefone || null,
      documento: k.documento || null,
      endereco: k.endereco || null,
      inicio: today(),
      servicos: c.itens,
      recorrentes: m.tipo === 'trafego',
      observacoes: `Cliente criado pela assinatura do contrato Nº ${numeroContrato(c.numero)}.`,
    })
    .select('*')
    .single();
  if (!data) return null;
  await supa.from('contracts').update({ client_id: data.id }).eq('id', c.id);
  if (m.tipo === 'trafego') await criarOnboarding(supa, data as Client);
  return data as Client;
}

// Registra um contrato que o cliente já assinou fora do sistema, pra ele não aparecer como "sem contrato".
export async function registrarContratoExterno(supa: SupabaseClient, clientId: string, assinadoEm: string, link: string | null) {
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
      modelo: { externo: true, link },
      contratante: { nome: c.nome, documento: c.documento ?? '', endereco: c.endereco ?? '', email: c.email ?? '', telefone: c.telefone ?? '', representante: c.responsavel ?? '' },
      status: 'assinado',
      assinado_em: new Date(`${assinadoEm}T12:00:00-03:00`).toISOString(),
      assinado_nome: c.responsavel ?? c.nome,
    })
    .select('id')
    .single();
  return (novo?.id as string) ?? null;
}

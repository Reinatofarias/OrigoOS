'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { checkPassword, createSessionToken, isLoginConfigured, requireAuth, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth';
import { db, type Charge, type Client, type ItemProposta, type LeadStatus, type Prioridade, type Proposal, type Service, type TaskStatus, type TaskTemplate } from '@/lib/db';
import { addDays, monthRange, today } from '@/lib/dates';
import { ESPERA, NICHO, normalizeWhatsapp, type Passo } from '@/lib/prospeccao';
import { CONDICOES_PADRAO, INTRODUCAO_PADRAO, itemDoServico, plataformaDosItens, totais } from '@/lib/propostas';
import { criarOnboarding } from '@/lib/modelos';
import { AsaasErro, buscarCobranca, camposDoPagamento, emitirCobranca, garantirCliente, removerCobranca } from '@/lib/asaas';

export async function login(_: unknown, form: FormData) {
  if (!isLoginConfigured()) return { erro: 'Login ainda não configurado: defina ORIGO_PASSWORD e ORIGO_SESSION_SECRET na Vercel.' };
  if (!checkPassword(form.get('senha'))) return { erro: 'Senha incorreta.' };
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
  redirect('/');
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect('/login');
}

function refresh() {
  revalidatePath('/', 'layout');
}

function texto(form: FormData, campo: string) {
  const v = String(form.get(campo) ?? '').trim();
  return v || null;
}

function numero(form: FormData, campo: string) {
  const raw = String(form.get(campo) ?? '').trim();
  if (!raw) return null;
  // Aceita "2.000,50", "2000,50" e "2000.50".
  const n = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
  return Number.isFinite(n) ? n : null;
}

// Tarefas

export async function addTask(form: FormData) {
  await requireAuth();
  const titulo = texto(form, 'titulo');
  if (!titulo) return;
  const quando = String(form.get('quando') ?? '');
  const data = quando === 'hoje' ? today() : quando === 'amanha' ? addDays(today(), 1) : quando === 'sem' ? null : texto(form, 'data');
  const status = (texto(form, 'status') ?? 'todo') as TaskStatus;
  await db()
    .from('tasks')
    .insert({
      titulo,
      data,
      status,
      feita: status === 'done',
      feita_em: status === 'done' ? new Date().toISOString() : null,
      client_id: texto(form, 'client_id'),
      prioridade: (texto(form, 'prioridade') ?? 'normal') as Prioridade,
    });
  refresh();
}

export async function updateTask(
  id: string,
  campos: Partial<{ titulo: string; data: string | null; client_id: string | null; prioridade: Prioridade; status: TaskStatus; descricao: string | null }>,
) {
  await requireAuth();
  const extra =
    campos.status === undefined
      ? {}
      : { feita: campos.status === 'done', feita_em: campos.status === 'done' ? new Date().toISOString() : null };
  await db().from('tasks').update({ ...campos, ...extra }).eq('id', id);
  refresh();
}

export async function deleteTask(id: string) {
  await requireAuth();
  await db().from('tasks').delete().eq('id', id);
  refresh();
}

// Comercial

const agora = () => new Date().toISOString();

export async function markSent(id: string, passo: Passo) {
  await requireAuth();
  const espera = ESPERA[passo];
  await db()
    .from('leads')
    .update({ status: passo, proxima_acao: espera ? addDays(today(), espera) : null, updated_at: agora() })
    .eq('id', id);
  refresh();
}

export async function setLeadStatus(id: string, status: LeadStatus) {
  await requireAuth();
  const espera = ESPERA[status as Passo];
  const proxima_acao =
    status === 'respondeu' || status === 'call' || status === 'proposta'
      ? today()
      : espera
        ? addDays(today(), espera)
        : null;
  await db().from('leads').update({ status, proxima_acao, updated_at: agora() }).eq('id', id);
  refresh();
}

export async function updateLead(
  id: string,
  campos: Partial<{ notas: string | null; valor: number; contato: string | null; proxima_acao: string | null; cidade: string | null }>,
) {
  await requireAuth();
  await db().from('leads').update({ ...campos, updated_at: agora() }).eq('id', id);
  refresh();
}

export async function addLead(form: FormData) {
  await requireAuth();
  const nome = texto(form, 'nome');
  if (!nome) return;
  const whatsapp = normalizeWhatsapp(String(form.get('whatsapp') ?? ''));
  const instagram = texto(form, 'instagram')?.replace(/^@/, '') ?? null;
  const { data: last } = await db().from('leads').select('ordem').order('ordem', { ascending: false }).limit(1);
  await db()
    .from('leads')
    .insert({
      nome,
      cidade: texto(form, 'cidade'),
      contato: texto(form, 'contato'),
      nicho: String(form.get('nicho') ?? 'outro'),
      valor: numero(form, 'valor') ?? 2000,
      whatsapp,
      whatsapp_confirmado: !!whatsapp,
      instagram,
      ordem: (last?.[0]?.ordem ?? 0) + 1,
    });
  refresh();
}

// Negócio ganho vira cliente com os serviços da proposta, a taxa única (se tiver) e o onboarding.
export async function convertLead(id: string) {
  await requireAuth();
  const supa = db();
  const { data: lead } = await supa.from('leads').select('*').eq('id', id).single();
  if (!lead) return;
  if (lead.client_id) redirect(`/clientes/${lead.client_id}`);
  const { data: props } = await supa.from('proposals').select('*').eq('lead_id', id).order('created_at', { ascending: false });
  const lista = (props ?? []) as Proposal[];
  const proposta = lista.find((p) => p.status === 'aceita') ?? lista[0];
  const itens = proposta?.itens ?? [];
  const t = totais(itens, proposta?.desconto);
  const hoje = today();
  const { data: cliente } = await supa
    .from('clients')
    .insert({
      nome: lead.nome,
      cidade: lead.cidade,
      segmento: NICHO[lead.nicho as keyof typeof NICHO],
      plataforma: plataformaDosItens(itens) ?? (lead.nicho === 'odonto' ? 'google_meta' : 'google'),
      mensalidade: proposta ? t.mensalFinal || null : lead.valor,
      servicos: itens,
      dia_vencimento: Math.min(28, Number(addDays(hoje, 3).slice(8, 10))),
      responsavel: lead.contato,
      telefone: lead.whatsapp,
      inicio: hoje,
    })
    .select('*')
    .single();
  if (!cliente) return;
  await Promise.all([
    supa.from('leads').update({ status: 'fechou', client_id: cliente.id, updated_at: agora() }).eq('id', id),
    proposta ? supa.from('proposals').update({ client_id: cliente.id }).eq('id', proposta.id) : null,
    // Primeira mensalidade já sai com vencimento em 3 dias; as próximas vêm do "Gerar mensalidades".
    supa.from('charges').insert([
      ...(cliente.mensalidade
        ? [{ client_id: cliente.id, competencia: hoje.slice(0, 7), descricao: `Mensalidade ${hoje.slice(5, 7)}/${hoje.slice(0, 4)}`, valor: cliente.mensalidade, vencimento: addDays(hoje, 3) }]
        : []),
      ...(t.unico > 0
        ? [{ client_id: cliente.id, descricao: itens.filter((i) => i.cobranca === 'unico').map((i) => i.nome).join(' + '), valor: t.unico, vencimento: addDays(hoje, 3) }]
        : []),
    ]),
    criarOnboarding(supa, cliente as Client),
  ]);
  refresh();
  redirect(`/clientes/${cliente.id}`);
}

// Propostas

export async function novaProposta(leadId: string) {
  await requireAuth();
  const supa = db();
  const [{ data: lead }, { data: svs }] = await Promise.all([
    supa.from('leads').select('nicho').eq('id', leadId).single(),
    supa.from('services').select('*').eq('ativo', true).order('ordem'),
  ]);
  const servicos = (svs ?? []) as Service[];
  const alvo = lead?.nicho === 'odonto' ? 'google_meta' : 'google';
  const padrao = servicos.find((x) => x.plataforma === alvo && x.cobranca === 'mensal') ?? servicos[0];
  const { data } = await supa
    .from('proposals')
    .insert({
      lead_id: leadId,
      itens: padrao ? [itemDoServico(padrao)] : [],
      introducao: INTRODUCAO_PADRAO,
      condicoes: CONDICOES_PADRAO,
      validade: addDays(today(), 7),
    })
    .select('id')
    .single();
  refresh();
  if (data) redirect(`/propostas/${data.id}`);
}

export async function salvarProposta(
  id: string,
  dados: { titulo: string; introducao: string | null; itens: ItemProposta[]; desconto: number; validade: string | null; condicoes: string | null },
) {
  await requireAuth();
  const supa = db();
  const itens = dados.itens.filter((i) => i.nome.trim()).map((i) => ({ ...i, valor: Number(i.valor) || 0 }));
  const { data } = await supa
    .from('proposals')
    .update({ ...dados, itens, desconto: Number(dados.desconto) || 0, updated_at: agora() })
    .eq('id', id)
    .select('lead_id')
    .single();
  // O valor do negócio no funil acompanha a mensalidade da proposta.
  const t = totais(itens, dados.desconto);
  if (data?.lead_id && t.mensalFinal > 0) await supa.from('leads').update({ valor: t.mensalFinal, updated_at: agora() }).eq('id', data.lead_id);
  refresh();
}

const ANTES_DA_PROPOSTA: LeadStatus[] = ['novo', 'm1', 'm2', 'm3', 'm4', 'respondeu', 'call'];

export async function marcarPropostaEnviada(id: string) {
  await requireAuth();
  const supa = db();
  const { data } = await supa.from('proposals').select('status, lead_id').eq('id', id).single();
  if (!data) return;
  if (data.status === 'rascunho') await supa.from('proposals').update({ status: 'enviada', updated_at: agora() }).eq('id', id);
  if (data.lead_id) {
    const { data: lead } = await supa.from('leads').select('status').eq('id', data.lead_id).single();
    if (lead && ANTES_DA_PROPOSTA.includes(lead.status)) {
      await supa.from('leads').update({ status: 'proposta', proxima_acao: addDays(today(), 2), updated_at: agora() }).eq('id', data.lead_id);
    }
  }
  refresh();
}

export async function setPropostaStatus(id: string, status: Proposal['status']) {
  await requireAuth();
  const supa = db();
  const { data } = await supa
    .from('proposals')
    .update({ status, aceita_em: status === 'aceita' ? agora() : null, updated_at: agora() })
    .eq('id', id)
    .select('lead_id')
    .single();
  if (status === 'aceita' && data?.lead_id) await supa.from('leads').update({ status: 'fechou', updated_at: agora() }).eq('id', data.lead_id);
  refresh();
}

export async function excluirProposta(id: string, leadId: string | null) {
  await requireAuth();
  await db().from('proposals').delete().eq('id', id);
  refresh();
  redirect(leadId ? `/comercial/${leadId}` : '/comercial');
}

// Chamado pelo cliente na página pública da proposta: não exige login, só o token do link.
export async function aceitarProposta(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return;
  const supa = db();
  const { data } = await supa.from('proposals').select('id, status, lead_id').eq('token', token).maybeSingle();
  if (!data || data.status === 'aceita' || data.status === 'recusada') return;
  await supa.from('proposals').update({ status: 'aceita', aceita_em: agora(), updated_at: agora() }).eq('id', data.id);
  if (data.lead_id) await supa.from('leads').update({ status: 'fechou', proxima_acao: today(), updated_at: agora() }).eq('id', data.lead_id);
  revalidatePath(`/p/${token}`);
  refresh();
}

// Clientes

function dadosCliente(form: FormData) {
  return {
    nome: texto(form, 'nome') ?? 'Sem nome',
    segmento: texto(form, 'segmento'),
    cidade: texto(form, 'cidade'),
    plataforma: String(form.get('plataforma') ?? 'google'),
    mensalidade: numero(form, 'mensalidade'),
    dia_vencimento: Math.min(28, Math.max(1, numero(form, 'dia_vencimento') ?? 10)),
    responsavel: texto(form, 'responsavel'),
    email: texto(form, 'email'),
    telefone: texto(form, 'telefone'),
    documento: texto(form, 'documento'),
    inicio: texto(form, 'inicio'),
    observacoes: texto(form, 'observacoes'),
  };
}

export async function addClient(form: FormData) {
  await requireAuth();
  const { data } = await db()
    .from('clients')
    .insert({ ...dadosCliente(form), inicio: texto(form, 'inicio') ?? today() })
    .select('*')
    .single();
  if (data && form.get('onboarding') === 'on') await criarOnboarding(db(), data as Client);
  refresh();
  if (data) redirect(`/clientes/${data.id}`);
}

export async function saveClient(id: string, form: FormData) {
  await requireAuth();
  await db()
    .from('clients')
    .update({ ...dadosCliente(form), ativo: form.get('ativo') === 'on', recorrentes: form.get('recorrentes') === 'on' })
    .eq('id', id);
  refresh();
}

export async function aplicarOnboarding(clientId: string) {
  await requireAuth();
  const supa = db();
  const { data } = await supa.from('clients').select('*').eq('id', clientId).single();
  if (data) await criarOnboarding(supa, { ...(data as Client), inicio: today() });
  refresh();
}

// Financeiro

export async function addCharge(form: FormData) {
  await requireAuth();
  const client_id = texto(form, 'client_id');
  const valor = numero(form, 'valor');
  const vencimento = texto(form, 'vencimento');
  if (!client_id || !valor || !vencimento) return;
  await db()
    .from('charges')
    .insert({ client_id, valor, vencimento, descricao: texto(form, 'descricao') ?? 'Cobrança avulsa' });
  refresh();
}

export async function setChargeStatus(id: string, status: Charge['status'], forma?: Charge['forma']) {
  await requireAuth();
  const { data: ch } = await db().from('charges').select('asaas_id, status').eq('id', id).single();
  // Se a cobrança está no Asaas e você deu baixa ou cancelou aqui, cancela lá pra o cliente não receber cobrança de novo.
  if (ch?.asaas_id && ch.status === 'pendente' && status !== 'pendente') {
    try {
      await removerCobranca(ch.asaas_id);
    } catch {
      /* já paga ou removida no Asaas */
    }
  }
  await db()
    .from('charges')
    .update({ status, pago_em: status === 'pago' ? today() : null, forma: status === 'pago' ? (forma ?? 'pix') : null })
    .eq('id', id);
  refresh();
}

export async function deleteCharge(id: string) {
  await requireAuth();
  const { data: ch } = await db().from('charges').select('asaas_id, status').eq('id', id).single();
  if (ch?.asaas_id && ch.status === 'pendente') {
    try {
      await removerCobranca(ch.asaas_id);
    } catch {
      /* já removida no Asaas */
    }
  }
  await db().from('charges').delete().eq('id', id);
  refresh();
}

// Cria a mensalidade do mês para cada cliente ativo que ainda não tem.
export async function generateMonthly(ym: string) {
  await requireAuth();
  const { lastDay } = monthRange(ym);
  const { data: clientes } = await db().from('clients').select('id, mensalidade, dia_vencimento').eq('ativo', true).gt('mensalidade', 0);
  const rows = (clientes ?? []).map((c) => ({
    client_id: c.id,
    competencia: ym,
    descricao: `Mensalidade ${ym.slice(5, 7)}/${ym.slice(0, 4)}`,
    valor: c.mensalidade,
    vencimento: `${ym}-${String(Math.min(c.dia_vencimento ?? 10, lastDay)).padStart(2, '0')}`,
  }));
  if (rows.length) await db().from('charges').upsert(rows, { onConflict: 'client_id,competencia', ignoreDuplicates: true });
  refresh();
}

export async function addExpense(form: FormData) {
  await requireAuth();
  const descricao = texto(form, 'descricao');
  const valor = numero(form, 'valor');
  if (!descricao || !valor) return;
  await db()
    .from('expenses')
    .insert({ descricao, valor, categoria: texto(form, 'categoria') ?? 'outros', data: texto(form, 'data') ?? today() });
  refresh();
}

export async function deleteExpense(id: string) {
  await requireAuth();
  await db().from('expenses').delete().eq('id', id);
  refresh();
}

// Asaas

async function emitir(chargeId: string) {
  const supa = db();
  const { data: ch } = await supa.from('charges').select('*').eq('id', chargeId).single();
  if (!ch || ch.asaas_id || ch.status !== 'pendente') return;
  const { data: cli } = await supa.from('clients').select('*').eq('id', ch.client_id).single();
  if (!cli) return;
  const customer = await garantirCliente(cli as Client);
  if (customer !== cli.asaas_customer_id) await supa.from('clients').update({ asaas_customer_id: customer }).eq('id', cli.id);
  const p = await emitirCobranca(customer, ch as Charge);
  await supa.from('charges').update({ asaas_id: p.id, asaas_url: p.invoiceUrl, asaas_status: p.status }).eq('id', chargeId);
}

function mensagemErro(e: unknown) {
  return e instanceof AsaasErro ? e.message : 'não consegui falar com o Asaas agora. Tente de novo em instantes.';
}

export async function emitirNoAsaas(chargeId: string): Promise<{ erro?: string }> {
  await requireAuth();
  try {
    await emitir(chargeId);
    return {};
  } catch (e) {
    return { erro: mensagemErro(e) };
  } finally {
    refresh();
  }
}

export async function emitirMesNoAsaas(ym: string): Promise<{ emitidas: number; erros: string[] }> {
  await requireAuth();
  const { start, end } = monthRange(ym);
  const { data } = await db().from('charges').select('id').eq('status', 'pendente').is('asaas_id', null).gte('vencimento', start).lte('vencimento', end);
  let emitidas = 0;
  const erros = new Set<string>();
  for (const c of data ?? []) {
    try {
      await emitir(c.id);
      emitidas++;
    } catch (e) {
      erros.add(mensagemErro(e));
    }
  }
  refresh();
  return { emitidas, erros: [...erros] };
}

// Busca no Asaas a situação das cobranças em aberto (caso o webhook não esteja configurado).
export async function sincronizarAsaas(): Promise<{ atualizadas: number; erro?: string }> {
  await requireAuth();
  const supa = db();
  const { data } = await supa.from('charges').select('id, asaas_id, status').eq('status', 'pendente').not('asaas_id', 'is', null);
  let atualizadas = 0;
  try {
    for (const c of data ?? []) {
      const campos = camposDoPagamento(await buscarCobranca(c.asaas_id!));
      await supa.from('charges').update(campos).eq('id', c.id);
      if (campos.status !== c.status) atualizadas++;
    }
  } catch (e) {
    refresh();
    return { atualizadas, erro: mensagemErro(e) };
  }
  refresh();
  return { atualizadas };
}

// Configurações: serviços

export async function addService(form: FormData) {
  await requireAuth();
  const nome = texto(form, 'nome');
  if (!nome) return;
  const { data: last } = await db().from('services').select('ordem').order('ordem', { ascending: false }).limit(1);
  await db()
    .from('services')
    .insert({
      nome,
      descricao: texto(form, 'descricao'),
      preco: numero(form, 'preco') ?? 0,
      cobranca: texto(form, 'cobranca') ?? 'mensal',
      plataforma: texto(form, 'plataforma'),
      ordem: (last?.[0]?.ordem ?? 0) + 1,
    });
  refresh();
}

export async function updateService(id: string, campos: Partial<Omit<Service, 'id'>>) {
  await requireAuth();
  await db().from('services').update(campos).eq('id', id);
  refresh();
}

export async function deleteService(id: string) {
  await requireAuth();
  await db().from('services').delete().eq('id', id);
  refresh();
}

// Configurações: modelos de tarefa

export async function addTemplate(form: FormData) {
  await requireAuth();
  const titulo = texto(form, 'titulo');
  const tipo = texto(form, 'tipo') as TaskTemplate['tipo'] | null;
  if (!titulo || !tipo) return;
  const { data: last } = await db().from('task_templates').select('ordem').eq('tipo', tipo).order('ordem', { ascending: false }).limit(1);
  const frequencia = texto(form, 'frequencia') ?? 'semanal';
  await db()
    .from('task_templates')
    .insert({
      tipo,
      titulo,
      prioridade: texto(form, 'prioridade') ?? 'normal',
      plataforma: texto(form, 'plataforma') ?? 'todas',
      dias: numero(form, 'dias') ?? 0,
      frequencia,
      dia_semana: frequencia === 'semanal' ? (numero(form, 'dia_semana') ?? 1) : null,
      dia_mes: frequencia === 'mensal' ? Math.min(28, Math.max(1, numero(form, 'dia_mes') ?? 5)) : null,
      ordem: (last?.[0]?.ordem ?? 0) + 1,
    });
  refresh();
}

export async function updateTemplate(id: string, campos: Partial<Omit<TaskTemplate, 'id' | 'tipo'>>) {
  await requireAuth();
  await db().from('task_templates').update(campos).eq('id', id);
  refresh();
}

export async function deleteTemplate(id: string) {
  await requireAuth();
  await db().from('task_templates').delete().eq('id', id);
  refresh();
}

// Metas

export async function salvarMetas(form: FormData) {
  await requireAuth();
  await db()
    .from('settings')
    .upsert({
      chave: 'metas',
      valor: {
        clientes: numero(form, 'clientes') ?? 15,
        receita: numero(form, 'receita') ?? 0,
        custo_contratacao: numero(form, 'custo_contratacao') ?? 0,
        prazo: texto(form, 'prazo'),
      },
      updated_at: agora(),
    });
  refresh();
}

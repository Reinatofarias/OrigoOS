'use server';

import { createHash, randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  APARELHO_COOKIE,
  checkPassword,
  createSenhaOkToken,
  createSessionToken,
  isLoginConfigured,
  requireAuth,
  SENHA_OK_COOKIE,
  SENHA_OK_MAX_AGE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  verifySenhaOkToken,
} from '@/lib/auth';
import { codigoValido, lerSeguranca, loginTravado, nomeDoAparelho, quemPediu, registrar } from '@/lib/seguranca';
import { db, type Charge, type Client, type Contract, type Contratante, type ItemProposta, type ModeloContrato, type Rede, type TipoContrato, type LeadStatus, type Prioridade, type Proposal, type Service, type TaskStatus, type TaskTemplate } from '@/lib/db';
import { addDays, formatShort, monthRange, today } from '@/lib/dates';
import { PRIORIDADE, STATUS } from '@/lib/tarefas';
import { ESPERA, NICHO, normalizeWhatsapp, type Passo } from '@/lib/prospeccao';
import { CONDICOES_PADRAO, INTRODUCAO_PADRAO, itemDoServico, plataformaDosItens, totais } from '@/lib/propostas';
import { criarOnboarding } from '@/lib/modelos';
import { clienteDoContrato, criarContrato, criarContratoNovo, lerEmpresa, registrarContratoExterno } from '@/lib/contratos';
import { clausulas, cpfValido, REDES, TIPOS } from '@/lib/contrato';
import { chavesPush, enviarParaTodos, resumoDoDia } from '@/lib/push';
import { somaDoMes } from '@/lib/anuncios';
import { AsaasErro, buscarCobranca, camposDoPagamento, emitirCobranca, garantirCliente, removerCobranca } from '@/lib/asaas';

export type EstadoLogin = { erro?: string; etapa?: 'senha' | 'codigo' } | null;

// Login em duas etapas: primeiro a senha; se a verificação em duas etapas estiver ligada, depois o código do app.
export async function login(_: unknown, form: FormData): Promise<EstadoLogin> {
  if (!isLoginConfigured()) return { erro: 'Login ainda não configurado: defina ORIGO_PASSWORD e ORIGO_SESSION_SECRET na Vercel.' };
  const supa = db();
  const quem = await quemPediu();
  const store = await cookies();
  if (await loginTravado(supa, quem.ip)) {
    await registrar(supa, 'login_travado', quem);
    return { erro: 'Muitas tentativas erradas. Espere 15 minutos e tente de novo.' };
  }
  const seg = await lerSeguranca(supa);
  const opcoesCurtas = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };

  if (form.get('etapa') === 'codigo') {
    if (!seg.totp_ativo || !verifySenhaOkToken(store.get(SENHA_OK_COOKIE)?.value)) {
      store.delete(SENHA_OK_COOKIE);
      return { erro: 'Passou muito tempo. Digite a senha de novo.', etapa: 'senha' };
    }
    if (!codigoValido(seg.totp_secret, form.get('codigo'))) {
      await registrar(supa, 'login_falhou', quem);
      return { erro: form.get('codigo') ? 'Código do autenticador errado ou vencido.' : 'Digite o código do app autenticador.', etapa: 'codigo' };
    }
  } else {
    if (!checkPassword(form.get('senha'))) {
      await registrar(supa, 'login_falhou', quem);
      return { erro: 'Senha incorreta.', etapa: 'senha' };
    }
    if (seg.totp_ativo) {
      store.set(SENHA_OK_COOKIE, createSenhaOkToken(), { ...opcoesCurtas, maxAge: SENHA_OK_MAX_AGE });
      return { etapa: 'codigo' };
    }
  }
  store.delete(SENHA_OK_COOKIE);
  // Cada aparelho ganha um código fixo, pra saber quando alguém entra de um aparelho novo.
  let aparelho = store.get(APARELHO_COOKIE)?.value;
  const { count } = aparelho ? await supa.from('access_log').select('id', { count: 'exact', head: true }).eq('evento', 'login').eq('aparelho', aparelho) : { count: 0 };
  if (!aparelho) aparelho = randomUUID();
  await registrar(supa, 'login', { ...quem, aparelho });
  if (!count) {
    await enviarParaTodos(supa, { title: 'Novo acesso ao Origo OS', body: `Entraram de um aparelho novo: ${nomeDoAparelho(quem.navegador)} (IP ${quem.ip}). Se não foi você, saia de todos os aparelhos e troque a senha.`, url: '/configuracoes?tab=seguranca' }).catch(() => null);
  }
  const opcoes = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
  store.set(APARELHO_COOKIE, aparelho, { ...opcoes, maxAge: 400 * 24 * 60 * 60 });
  store.set(SESSION_COOKIE, createSessionToken(seg.sessao_versao), { ...opcoes, maxAge: SESSION_MAX_AGE });
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
  const { data: antes } = await db().from('tasks').select('status, prioridade, data, client_id').eq('id', id).maybeSingle();
  const { data: t } = await db().from('tasks').update({ ...campos, ...extra }).eq('id', id).select('titulo, client_id').maybeSingle();
  if (antes) await registrarMudancas(id, antes, campos);
  // Concluir feedback, reunião ou ligação com um cliente conta como contato (saúde do cliente).
  if (campos.status === 'done' && t?.client_id && CONTATO.test(t.titulo)) {
    await db().from('clients').update({ ultimo_contato: today() }).eq('id', t.client_id);
  }
  refresh();
}

// Histórico da tarefa (aparece na página de detalhes). Se a tabela da v6 ainda não existir, só não grava.
async function registrarMudancas(
  id: string,
  antes: { status: TaskStatus; prioridade: Prioridade; data: string | null; client_id: string | null },
  campos: Parameters<typeof updateTask>[1],
) {
  const linhas: string[] = [];
  if (campos.status && campos.status !== antes.status) linhas.push(`Status: ${STATUS[antes.status].label} → ${STATUS[campos.status].label}`);
  if (campos.prioridade && campos.prioridade !== antes.prioridade)
    linhas.push(`Prioridade: ${PRIORIDADE[antes.prioridade].label} → ${PRIORIDADE[campos.prioridade].label}`);
  if (campos.data !== undefined && campos.data !== antes.data)
    linhas.push(campos.data ? `Prazo: ${formatShort(campos.data)}` : 'Prazo removido');
  if (campos.client_id !== undefined && campos.client_id !== antes.client_id) {
    const { data: c } = campos.client_id ? await db().from('clients').select('nome').eq('id', campos.client_id).maybeSingle() : { data: null };
    linhas.push(c ? `Cliente: ${c.nome}` : 'Cliente removido');
  }
  if (linhas.length) await db().from('task_comments').insert(linhas.map((texto) => ({ task_id: id, texto, tipo: 'atividade' })));
}

const CONTATO = /feedback|reuni|call|ligar|liga[çc][ãa]o|conversa|alinhamento|relat[óo]rio/i;

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
  const { data: ct } = await supa.from('contracts').select('*').eq('lead_id', id).neq('status', 'cancelado').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const k = ((ct as Contract | null)?.contratante ?? {}) as Contratante;
  const { data: cliente } = await supa
    .from('clients')
    .insert({
      documento: k.documento || null,
      endereco: k.endereco || null,
      email: k.email || null,
      nome: lead.nome,
      cidade: lead.cidade,
      segmento: NICHO[lead.nicho as keyof typeof NICHO],
      plataforma: plataformaDosItens(itens) ?? (lead.nicho === 'odonto' ? 'google_meta' : 'google'),
      mensalidade: proposta ? t.mensalFinal || null : lead.valor,
      servicos: itens,
      dia_vencimento: Math.min(28, Number(addDays(hoje, 3).slice(8, 10))),
      responsavel: k.representante || lead.contato,
      telefone: lead.whatsapp,
      inicio: hoje,
    })
    .select('*')
    .single();
  if (!cliente) return;
  await Promise.all([
    supa.from('leads').update({ status: 'fechou', client_id: cliente.id, updated_at: agora() }).eq('id', id),
    proposta ? supa.from('proposals').update({ client_id: cliente.id }).eq('id', proposta.id) : null,
    ct ? supa.from('contracts').update({ client_id: cliente.id }).eq('id', ct.id) : null,
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
  if (status === 'aceita') await criarContrato(supa, id);
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
  await criarContrato(supa, data.id);
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
    endereco: texto(form, 'endereco'),
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

// Captura rápida

export async function capturarTarefa(campos: { titulo: string; data: string | null; client_id: string | null; prioridade: Prioridade }) {
  await requireAuth();
  if (!campos.titulo.trim()) return;
  await db().from('tasks').insert({ ...campos, titulo: campos.titulo.trim().slice(0, 300), status: 'todo' });
  refresh();
}

export async function capturarLead(campos: { nome: string; whatsapp: string; notas: string | null }) {
  await requireAuth();
  const nome = campos.nome.trim();
  if (!nome) return;
  const whatsapp = normalizeWhatsapp(campos.whatsapp);
  const { data: last } = await db().from('leads').select('ordem').order('ordem', { ascending: false }).limit(1);
  await db()
    .from('leads')
    .insert({ nome, nicho: 'outro', whatsapp, whatsapp_confirmado: !!whatsapp, notas: campos.notas, origem: 'captura', ordem: (last?.[0]?.ordem ?? 0) + 1 });
  refresh();
}

// Contratos

export async function gerarContrato(proposalId: string) {
  await requireAuth();
  const id = await criarContrato(db(), proposalId);
  refresh();
  if (id) redirect(`/contratos/${id}`);
}

// Tela "Novo contrato": o que foi marcado vira o modelo e os itens do contrato.
async function escolhasDoForm(form: FormData) {
  const tipo = String(form.get('tipo') ?? '') as TipoContrato;
  if (!(tipo in TIPOS)) return { erro: 'Escolha o tipo do contrato.' };
  const redes = form.getAll('redes').map(String).filter((r): r is Rede => r in REDES);
  if (tipo === 'trafego' && !redes.length) return { erro: 'Marque pelo menos uma rede.' };
  const ids = form.getAll('svc').map(String).filter(Boolean);
  const { data } = ids.length ? await db().from('services').select('*').in('id', ids) : { data: [] };
  const itens: ItemProposta[] = ((data ?? []) as Service[])
    .sort((a, b) => a.ordem - b.ordem)
    .map((sv) => ({ ...itemDoServico(sv), valor: numero(form, `valor_${sv.id}`) ?? Number(sv.preco) }));
  const outro = texto(form, 'outro_nome');
  if (outro) {
    itens.push({ service_id: null, nome: outro.slice(0, 200), descricao: null, valor: numero(form, 'outro_valor') ?? 0, cobranca: form.get('outro_cobranca') === 'unico' ? 'unico' : 'mensal', plataforma: null });
  }
  if (!itens.length) return { erro: 'Marque pelo menos um serviço.' };
  const vig = numero(form, 'vigencia_meses') ?? 6;
  const promoValor = form.get('promo') === 'on' ? numero(form, 'promo_valor') : null;
  const promoMeses = promoValor ? numero(form, 'promo_meses') : null;
  if (promoValor && (!promoMeses || promoMeses >= vig)) return { erro: 'A condição de entrada precisa durar menos meses que o contrato.' };
  const modelo: ModeloContrato = { tipo, redes: tipo === 'trafego' ? redes : [], vigencia_meses: Math.min(36, Math.max(1, Math.round(vig))), promo_valor: promoValor, promo_meses: promoMeses };
  return { itens, modelo, dia_vencimento: Math.min(28, Math.max(1, numero(form, 'dia_vencimento') ?? 10)) };
}

export async function novoContrato(form: FormData): Promise<{ erro?: string }> {
  await requireAuth();
  const e = await escolhasDoForm(form);
  if ('erro' in e) return { erro: e.erro };
  const clientId = texto(form, 'client_id');
  const novo = clientId === 'novo';
  const nome = texto(form, 'novo_nome');
  if (!clientId) return { erro: 'Escolha o cliente.' };
  if (novo && !nome) return { erro: 'Coloque o nome do cliente novo.' };
  const id = await criarContratoNovo(db(), { clientId: novo ? null : clientId, nome, telefone: normalizeWhatsapp(texto(form, 'novo_whatsapp') ?? '') || null, ...e });
  if (!id) return { erro: 'Não consegui criar o contrato.' };
  refresh();
  redirect(`/contratos/${id}`);
}

export async function salvarEscolhasContrato(id: string, form: FormData): Promise<{ erro?: string }> {
  await requireAuth();
  const e = await escolhasDoForm(form);
  if ('erro' in e) return { erro: e.erro };
  await db().from('contracts').update({ ...e, updated_at: agora() }).eq('id', id).eq('status', 'aguardando');
  refresh();
  return {};
}

const soDoc = (v: string | null) => (v ?? '').replace(/[^\d./-]/g, '');

function contratanteDoForm(form: FormData): Contratante {
  return {
    nome: texto(form, 'nome') ?? '',
    documento: soDoc(texto(form, 'documento')),
    endereco: texto(form, 'endereco') ?? '',
    email: texto(form, 'email') ?? '',
    telefone: texto(form, 'telefone') ?? '',
    representante: texto(form, 'representante') ?? '',
    representante_cpf: soDoc(texto(form, 'representante_cpf')),
    representante_endereco: texto(form, 'representante_endereco') ?? '',
    nacionalidade: texto(form, 'nacionalidade') ?? '',
    profissao: texto(form, 'profissao') ?? '',
  };
}

// Formulário do cliente no link: os dados dele e, se tiver, os da empresa.
function contratanteDoCliente(form: FormData): Contratante {
  const pessoa = texto(form, 'representante') ?? '';
  const cpf = soDoc(texto(form, 'representante_cpf'));
  const casa = texto(form, 'representante_endereco') ?? '';
  const empresa = texto(form, 'empresa_nome');
  return {
    representante: pessoa,
    representante_cpf: cpf,
    representante_endereco: casa,
    nacionalidade: texto(form, 'nacionalidade') ?? '',
    profissao: texto(form, 'profissao') ?? '',
    email: texto(form, 'email') ?? '',
    telefone: texto(form, 'telefone') ?? '',
    nome: empresa ?? pessoa,
    documento: empresa ? soDoc(texto(form, 'empresa_cnpj')) : cpf,
    endereco: empresa ? (texto(form, 'empresa_endereco') ?? '') : casa,
  };
}

export async function salvarContrato(id: string, form: FormData) {
  await requireAuth();
  await db()
    .from('contracts')
    .update({
      contratante: contratanteDoForm(form),
      dia_vencimento: Math.min(28, Math.max(1, numero(form, 'dia_vencimento') ?? 10)),
      updated_at: agora(),
    })
    .eq('id', id)
    .eq('status', 'aguardando');
  refresh();
}

export async function registrarContratoAssinadoFora(form: FormData) {
  await requireAuth();
  const clientId = texto(form, 'client_id');
  const dia = texto(form, 'assinado_em') ?? today();
  const link = texto(form, 'link');
  if (!clientId || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return;
  await registrarContratoExterno(db(), clientId, dia, link && /^https?:\/\//.test(link) ? link.slice(0, 500) : null);
  refresh();
}

// Apaga o contrato de vez (teste ou erro). O link para de funcionar; o cliente continua cadastrado.
export async function excluirContrato(id: string, voltarPraLista: boolean) {
  await requireAuth();
  const { error } = await db().from('contracts').delete().eq('id', id);
  if (error) return { erro: `Não consegui excluir: ${error.message}` };
  refresh();
  if (voltarPraLista) redirect('/contratos');
  return {};
}

export async function cancelarContrato(id: string) {
  await requireAuth();
  await db().from('contracts').update({ status: 'cancelado', updated_at: agora() }).eq('id', id);
  refresh();
}

// O cliente assina pela página pública do contrato. Guarda o texto exato, o código (hash), data, IP e navegador.
async function contratoAguardando(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const { data } = await db().from('contracts').select('*').eq('token', token).maybeSingle();
  const c = data as Contract | null;
  return c?.status === 'aguardando' ? c : null;
}

// Passo 1 do link: o cliente manda os dados. Só depois ele vê o contrato montado e assina.
export async function enviarDadosContrato(token: string, form: FormData): Promise<{ erro?: string }> {
  const c = await contratoAguardando(token);
  if (!c) return { erro: 'Este contrato não está mais aguardando assinatura.' };
  const k = contratanteDoCliente(form);
  const cpf = (k.representante_cpf ?? '').replace(/\D/g, '');
  const cnpj = texto(form, 'empresa_nome') ? (k.documento ?? '').replace(/\D/g, '') : '';
  if (!k.representante || !k.representante_endereco || !k.email || !k.telefone) return { erro: 'Preencha seu nome, endereço, e-mail e WhatsApp.' };
  if (!cpfValido(cpf)) return { erro: 'Confira o seu CPF.' };
  if (cnpj && cnpj.length !== 14) return { erro: 'Confira o CNPJ da empresa (14 números) ou deixe em branco.' };
  if (texto(form, 'empresa_nome') && !k.endereco) return { erro: 'Coloque o endereço da empresa.' };
  await db()
    .from('contracts')
    .update({ contratante: { ...k, preenchido_em: agora() }, updated_at: agora() })
    .eq('id', c.id)
    .eq('status', 'aguardando');
  revalidatePath(`/c/${token}`);
  redirect(`/c/${token}`);
}

// Passo 2: o cliente leu o contrato com os dados dele e assina. Guarda o texto exato, o código (hash), data, IP e navegador.
export async function assinarContrato(token: string, form: FormData): Promise<{ erro?: string }> {
  const supa = db();
  const c = await contratoAguardando(token);
  if (!c) return { erro: 'Este contrato não está mais aguardando assinatura.' };
  const k = c.contratante;
  if (!k.preenchido_em) return { erro: 'Preencha seus dados antes de assinar.' };
  if (form.get('aceite') !== 'on') return { erro: 'Marque a caixa confirmando que leu e concorda.' };

  const empresa = await lerEmpresa(supa);
  const conteudo = JSON.stringify({ empresa, clausulas: clausulas(empresa, { ...c, contratante: k }) });
  const hash = createHash('sha256').update(conteudo).digest('hex');
  const h = await headers();
  const { error } = await supa
    .from('contracts')
    .update({
      conteudo,
      hash,
      status: 'assinado',
      assinado_em: agora(),
      assinado_nome: k.representante,
      assinado_documento: k.representante_cpf,
      assinado_ip: (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null,
      assinado_navegador: (h.get('user-agent') ?? '').slice(0, 300),
      updated_at: agora(),
    })
    .eq('id', c.id)
    .eq('status', 'aguardando');
  if (error) return { erro: 'Não consegui registrar a assinatura. Tente de novo.' };

  // Se já é cliente, completa o cadastro com o que ele preencheu (ajuda a emitir no Asaas). Se não, vira cliente.
  const clientId = c.client_id ?? (c.lead_id ? (await supa.from('leads').select('client_id').eq('id', c.lead_id).single()).data?.client_id : null);
  if (!clientId) await clienteDoContrato(supa, c, k);
  if (clientId) {
    const { data: cli } = await supa.from('clients').select('documento, endereco, email, responsavel').eq('id', clientId).single();
    if (cli) {
      await supa
        .from('clients')
        .update({
          documento: cli.documento || k.documento || null,
          endereco: cli.endereco || k.endereco || null,
          email: cli.email || k.email || null,
          responsavel: cli.responsavel || k.representante || null,
        })
        .eq('id', clientId);
    }
  }
  try {
    await enviarParaTodos(supa, { title: 'Contrato assinado ✍️', body: `${k.nome || k.representante} assinou o contrato Nº ${String(c.numero).padStart(4, '0')}. Falta só a cobrança.`, url: `/contratos/${c.id}`, tag: `contrato-${c.id}` });
  } catch {
    /* aviso é extra; a assinatura já valeu */
  }
  revalidatePath(`/c/${token}`);
  refresh();
  return {};
}

export async function salvarEmpresa(form: FormData) {
  await requireAuth();
  await db()
    .from('settings')
    .upsert({
      chave: 'empresa',
      valor: {
        nome: texto(form, 'nome') ?? 'Origo Company',
        responsavel: texto(form, 'responsavel') ?? 'Renato Farias',
        documento: texto(form, 'documento') ?? '',
        endereco: texto(form, 'endereco') ?? '',
        cidade: texto(form, 'cidade') ?? 'Igarassu-PE',
        email: texto(form, 'email') ?? '',
        responsavel_cpf: texto(form, 'responsavel_cpf') ?? '',
        pix: texto(form, 'pix') ?? '',
      },
      updated_at: agora(),
    });
  refresh();
}

// Relatórios mensais

export async function novoRelatorio(clientId: string, form: FormData) {
  await requireAuth();
  const competencia = texto(form, 'competencia') ?? today().slice(0, 7);
  const supa = db();
  const { data: existe } = await supa.from('reports').select('id').eq('client_id', clientId).eq('competencia', competencia).maybeSingle();
  if (existe) redirect(`/relatorios/${existe.id}`);
  // Começa com o mesmo nome de conversão do relatório anterior.
  const { data: anterior } = await supa.from('reports').select('conversao_nome').eq('client_id', clientId).order('competencia', { ascending: false }).limit(1).maybeSingle();
  // Se os números do Meta/Google já chegaram, o relatório nasce preenchido.
  const soma = await somaDoMes(supa, clientId, competencia);
  const numeros = soma.tem ? soma.total : {};
  const { data } = await supa
    .from('reports')
    .insert({ client_id: clientId, competencia, conversao_nome: anterior?.conversao_nome ?? 'Contatos', ...numeros })
    .select('id')
    .single();
  refresh();
  if (data) redirect(`/relatorios/${data.id}`);
}

export async function salvarRelatorio(
  id: string,
  campos: { investimento: number | null; impressoes: number | null; cliques: number | null; conversoes: number | null; conversao_nome: string; destaques: string | null; proximos_passos: string | null },
) {
  await requireAuth();
  await db().from('reports').update({ ...campos, updated_at: agora() }).eq('id', id);
  refresh();
}

export async function marcarRelatorioEnviado(id: string) {
  await requireAuth();
  const { data } = await db().from('reports').update({ status: 'enviado', updated_at: agora() }).eq('id', id).select('client_id').maybeSingle();
  if (data) await db().from('clients').update({ ultimo_contato: today() }).eq('id', data.client_id);
  refresh();
}

export async function excluirRelatorio(id: string, clientId: string) {
  await requireAuth();
  await db().from('reports').delete().eq('id', id);
  refresh();
  redirect(`/clientes/${clientId}?tab=relatorios`);
}

// Lembrete no celular

export async function chavePublicaPush() {
  await requireAuth();
  return (await chavesPush(db())).publicKey;
}

export async function salvarInscricao(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  await requireAuth();
  if (!sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) return;
  await db().from('push_subscriptions').upsert({ endpoint: sub.endpoint, keys: sub.keys }, { onConflict: 'endpoint' });
}

export async function removerInscricao(endpoint: string) {
  await requireAuth();
  await db().from('push_subscriptions').delete().eq('endpoint', endpoint);
}

export async function enviarLembreteTeste() {
  await requireAuth();
  const supa = db();
  return enviarParaTodos(supa, await resumoDoDia(supa));
}

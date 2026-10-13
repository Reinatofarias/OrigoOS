import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Repeticao } from './repeticao';

const VARIAVEIS = ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

function limpa(v: string | undefined) {
  const t = v?.trim().replace(/^['"]|['"]$/g, '');
  return t ? t : undefined;
}

// Tipo de cada chave sem revelar a chave: "secret", "service_role", "anon", "publishable"...
export function tipoDaChave(key: string) {
  if (key.startsWith('sb_secret_')) return 'secret';
  if (key.startsWith('sb_publishable_')) return 'publishable';
  try {
    return String(JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role ?? 'desconhecido');
  } catch {
    return 'desconhecido';
  }
}

const serve = (tipo: string) => tipo === 'secret' || tipo === 'service_role';

// As chaves configuradas na Vercel, na ordem em que o app tenta usar.
export function chaves() {
  return VARIAVEIS.map((nome) => {
    const key = limpa(process.env[nome]);
    return { nome, key, tipo: key ? tipoDaChave(key) : null };
  });
}

// Usa a primeira chave que é secreta de verdade. Se alguém colar a anon numa variável, o app pula pra próxima.
function chaveEscolhida() {
  const lista = chaves().filter((c) => c.key);
  return lista.find((c) => serve(c.tipo!)) ?? lista[0];
}

// Cliente do Supabase com a chave secreta. Só roda no servidor; nunca vai para o navegador.
export function db() {
  const url = limpa(process.env.SUPABASE_URL) ?? limpa(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = chaveEscolhida()?.key;
  if (!url || !key) throw new Error('Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, { auth: { persistSession: false } });
}

// Com RLS ligado e sem policies, uma chave pública (anon/publishable) não dá erro: só devolve listas vazias.
// Por isso a tela avisa quando nenhuma das chaves configuradas é secreta.
export function keyProblem(): string | null {
  const c = chaveEscolhida();
  if (!c) return 'nenhuma chave do Supabase configurada na Vercel.';
  if (!serve(c.tipo!)) return `a chave em ${c.nome} é do tipo "${c.tipo}" (pública). Coloque a service_role em SUPABASE_SERVICE_ROLE_KEY.`;
  return null;
}

export function chaveEmUso() {
  return chaveEscolhida()?.nome ?? null;
}

export type Client = {
  id: string;
  nome: string;
  segmento: string | null;
  cidade: string | null;
  plataforma: 'google' | 'meta' | 'google_meta';
  mensalidade: number | null;
  ativo: boolean;
  responsavel: string | null;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  dia_vencimento: number;
  inicio: string | null;
  observacoes: string | null;
  servicos: ItemProposta[];
  recorrentes: boolean;
  asaas_customer_id: string | null;
  endereco: string | null;
  meta_conta: string | null;
  meta_conversoes: string | null;
  google_conta: string | null;
  ultimo_contato: string | null;
  portal_token: string;
  created_at: string;
};

export type TaskStatus = 'todo' | 'doing' | 'done';
export type Prioridade = 'urgente' | 'alta' | 'normal' | 'baixa';

export type Task = {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string | null;
  client_id: string | null;
  status: TaskStatus;
  prioridade: Prioridade;
  feita: boolean;
  feita_em: string | null;
  origem: 'manual' | 'onboarding' | 'recorrente';
  template_id: string | null;
  // v10: some quando o SQL ainda não rodou.
  repeticao?: Repeticao | null;
  created_at: string;
};

export type TaskItem = {
  id: string;
  task_id: string;
  titulo: string;
  feita: boolean;
  ordem: number;
  created_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  texto: string;
  tipo: 'comentario' | 'atividade';
  created_at: string;
};

export type LeadStatus = 'novo' | 'm1' | 'm2' | 'm3' | 'm4' | 'respondeu' | 'call' | 'proposta' | 'fechou' | 'perdido';

export type Lead = {
  id: string;
  nome: string;
  cidade: string | null;
  nicho: 'clima' | 'adv' | 'odonto' | 'outro';
  endereco: string | null;
  whatsapp: string | null;
  whatsapp_confirmado: boolean;
  instagram: string | null;
  contato: string | null;
  status: LeadStatus;
  proxima_acao: string | null;
  ordem: number;
  notas: string | null;
  valor: number;
  client_id: string | null;
  updated_at: string;
};

export type Charge = {
  id: string;
  client_id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  competencia: string | null;
  status: 'pendente' | 'pago' | 'cancelado';
  pago_em: string | null;
  forma: 'pix' | 'boleto' | 'transferencia' | 'cartao' | 'dinheiro' | null;
  asaas_id: string | null;
  asaas_url: string | null;
  asaas_status: string | null;
};

export type Expense = {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  pago: boolean;
};

export type Plataforma = 'google' | 'meta' | 'google_meta';

export type Service = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  cobranca: 'mensal' | 'unico';
  plataforma: Plataforma | null;
  ativo: boolean;
  ordem: number;
};

export type ItemProposta = {
  service_id: string | null;
  nome: string;
  descricao: string | null;
  valor: number;
  cobranca: 'mensal' | 'unico';
  plataforma: Plataforma | null;
};

export type Proposal = {
  id: string;
  numero: number;
  token: string;
  lead_id: string | null;
  client_id: string | null;
  titulo: string;
  introducao: string | null;
  itens: ItemProposta[];
  desconto: number;
  validade: string | null;
  condicoes: string | null;
  status: 'rascunho' | 'enviada' | 'aceita' | 'recusada';
  aceita_em: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskTemplate = {
  id: string;
  tipo: 'onboarding' | 'recorrente';
  titulo: string;
  descricao: string | null;
  prioridade: Prioridade;
  dias: number;
  frequencia: 'semanal' | 'mensal';
  dia_semana: number | null;
  dia_mes: number | null;
  plataforma: 'todas' | 'google' | 'meta';
  ativo: boolean;
  ordem: number;
};

export type Metas = {
  clientes: number;
  receita: number;
  custo_contratacao: number;
  prazo: string | null;
};

export const METAS_PADRAO: Metas = { clientes: 15, receita: 30000, custo_contratacao: 3000, prazo: null };

export type Contratante = {
  nome?: string;
  documento?: string;
  endereco?: string;
  email?: string;
  telefone?: string;
  representante?: string;
  representante_cpf?: string;
  representante_endereco?: string;
  nacionalidade?: string;
  profissao?: string;
  // Quando o cliente enviou os dados pelo link (passo 1, antes de assinar).
  preenchido_em?: string;
};

export type TipoContrato = 'trafego' | 'mentoria' | 'servicos';
export type Rede = 'google' | 'meta' | 'tiktok' | 'youtube' | 'linkedin';

// O que o Renato escolhe antes de mandar o contrato: tipo, redes, prazo e condição de entrada.
export type ModeloContrato = {
  tipo?: TipoContrato;
  redes?: Rede[];
  vigencia_meses?: number;
  promo_valor?: number | null;
  promo_meses?: number | null;
  // Contrato assinado fora do sistema (papel, Autentique...): só o registro, com a data e o link do arquivo.
  externo?: boolean;
  link?: string | null;
};

export type Contract = {
  id: string;
  numero: number;
  token: string;
  proposal_id: string | null;
  lead_id: string | null;
  client_id: string | null;
  contratante: Contratante;
  itens: ItemProposta[];
  desconto: number;
  dia_vencimento: number;
  modelo: ModeloContrato | null;
  status: 'aguardando' | 'assinado' | 'cancelado';
  conteudo: string | null;
  hash: string | null;
  assinado_em: string | null;
  assinado_nome: string | null;
  assinado_documento: string | null;
  assinado_ip: string | null;
  assinado_navegador: string | null;
  created_at: string;
  updated_at: string;
};

export type Empresa = {
  nome: string;
  responsavel: string;
  documento: string;
  endereco: string;
  cidade: string;
  email: string;
  responsavel_cpf?: string;
  pix?: string;
};

export const EMPRESA_PADRAO: Empresa = { nome: 'Origo Company', responsavel: 'Renato Farias', documento: '', endereco: '', cidade: 'Igarassu-PE', email: '', responsavel_cpf: '', pix: '' };

export type Report = {
  id: string;
  token: string;
  client_id: string;
  competencia: string;
  investimento: number | null;
  impressoes: number | null;
  cliques: number | null;
  conversoes: number | null;
  conversao_nome: string;
  destaques: string | null;
  proximos_passos: string | null;
  status: 'rascunho' | 'enviado';
  created_at: string;
  updated_at: string;
};

export type ClientRequest = {
  id: string;
  client_id: string;
  titulo: string;
  descricao: string | null;
  status: 'pendente' | 'enviado' | 'ok';
  resposta: string | null;
  respondido_em: string | null;
  ordem: number;
  created_at: string;
};

export type AdMetric = {
  client_id: string;
  plataforma: 'google' | 'meta';
  data: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  conversoes: number;
  atualizado_em: string;
};

import 'server-only';
import { createClient } from '@supabase/supabase-js';

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
};

export type Expense = {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  pago: boolean;
};

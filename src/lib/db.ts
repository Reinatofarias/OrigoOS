import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Cliente do Supabase com a service role. Só roda no servidor; nunca vai para o navegador.
export function db() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  // SUPABASE_SECRET_KEY (chave nova sb_secret_...) tem prioridade sobre a service_role legada que a integração da Vercel sincroniza.
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase não configurado: defina SUPABASE_URL e SUPABASE_SECRET_KEY.');
  return createClient(url, key, { auth: { persistSession: false } });
}

// Com RLS ligado e sem policies, uma chave pública (anon/publishable) não dá erro: só devolve listas vazias.
// Por isso a tela avisa quando a chave configurada não é a secreta.
export function keyProblem(): string | null {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return 'nenhuma chave do Supabase configurada na Vercel.';
  if (key.startsWith('sb_publishable_')) return 'a chave configurada é a publishable (pública). Use a secret key.';
  if (key.startsWith('eyJ')) {
    try {
      const role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role;
      if (role !== 'service_role') return `a chave configurada é do tipo "${role}". Use a service_role ou a secret key.`;
    } catch {
      return 'a chave configurada não parece válida.';
    }
  }
  return null;
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

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

export type Client = {
  id: string;
  nome: string;
  segmento: string | null;
  cidade: string | null;
  plataforma: 'google' | 'meta' | 'google_meta';
  mensalidade: number | null;
  ativo: boolean;
};

export type Task = {
  id: string;
  titulo: string;
  data: string | null;
  client_id: string | null;
  feita: boolean;
  feita_em: string | null;
};

export type LeadStatus = 'novo' | 'm1' | 'm2' | 'm3' | 'm4' | 'respondeu' | 'call' | 'fechou' | 'perdido';

export type Lead = {
  id: string;
  nome: string;
  cidade: string | null;
  nicho: 'clima' | 'adv' | 'odonto' | 'outro';
  endereco: string | null;
  whatsapp: string | null;
  whatsapp_confirmado: boolean;
  instagram: string | null;
  status: LeadStatus;
  proxima_acao: string | null;
  ordem: number;
  notas: string | null;
};

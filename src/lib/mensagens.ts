import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Modelos } from './prospeccao';

export async function lerModelos(supa: SupabaseClient): Promise<Partial<Modelos>> {
  const { data } = await supa.from('settings').select('valor').eq('chave', 'mensagens').maybeSingle();
  return (data?.valor as Partial<Modelos>) ?? {};
}

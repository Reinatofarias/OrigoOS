import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { METAS_PADRAO, type Metas } from './db';

export async function lerMetas(supa: SupabaseClient): Promise<Metas> {
  const { data } = await supa.from('settings').select('valor').eq('chave', 'metas').maybeSingle();
  return { ...METAS_PADRAO, ...((data?.valor as Partial<Metas>) ?? {}) };
}

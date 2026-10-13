import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// Cópia de tudo do banco num arquivo só. Senhas e chaves (autenticador e push) ficam de fora.
const TABELAS = [
  'clients', 'leads', 'tasks', 'routine_checks', 'charges', 'expenses', 'services', 'proposals', 'contracts', 'reports',
  'task_templates', 'task_runs', 'task_items', 'task_comments', 'client_requests', 'ad_metrics', 'settings',
];
const SEGREDOS = ['seguranca', 'vapid', 'integracoes'];

export async function gerarBackup(supa: SupabaseClient) {
  const tabelas: Record<string, unknown[]> = {};
  for (const t of TABELAS) {
    const linhas: unknown[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await supa.from(t).select('*').range(de, de + 999);
      if (error) break;
      linhas.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    tabelas[t] = t === 'settings' ? linhas.filter((l) => !SEGREDOS.includes((l as { chave: string }).chave)) : linhas;
  }
  return { sistema: 'Origo OS', gerado_em: new Date().toISOString(), tabelas };
}

const PASTA = 'backups';
const GUARDAR = 8;

// Guarda no Storage do Supabase (pasta privada) e mantém só as 8 cópias mais novas.
export async function salvarBackup(supa: SupabaseClient, dia: string) {
  await supa.storage.createBucket(PASTA, { public: false }).catch(() => null);
  const conteudo = JSON.stringify(await gerarBackup(supa));
  const arquivo = `origo-os-${dia}.json`;
  const { error } = await supa.storage.from(PASTA).upload(arquivo, new Blob([conteudo], { type: 'application/json' }), { upsert: true, contentType: 'application/json' });
  if (error) throw new Error(error.message);
  const { data: lista } = await supa.storage.from(PASTA).list('', { sortBy: { column: 'name', order: 'desc' }, limit: 100 });
  const velhos = (lista ?? []).filter((f) => f.name.startsWith('origo-os-')).slice(GUARDAR).map((f) => f.name);
  if (velhos.length) await supa.storage.from(PASTA).remove(velhos);
  const info = { em: new Date().toISOString(), arquivo, tamanho: conteudo.length };
  await supa.from('settings').upsert({ chave: 'backup_ultimo', valor: info });
  return info;
}

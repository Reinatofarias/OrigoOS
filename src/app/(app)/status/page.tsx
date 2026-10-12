import { CheckCircle2, XCircle } from 'lucide-react';
import { db, keyProblem } from '@/lib/db';
import { Body, Card, PageHeader } from '@/components/ui';

// Diagnóstico da conexão com o Supabase: qual projeto, que tipo de chave e quantos registros cada tabela tem.
// Não mostra a chave em si.
const TABELAS = ['clients', 'leads', 'tasks', 'routine_checks', 'charges', 'expenses'];

function tipoDaChave() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origem = process.env.SUPABASE_SECRET_KEY ? 'SUPABASE_SECRET_KEY' : process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY' : '—';
  if (!key) return { origem, tipo: 'nenhuma' };
  if (key.startsWith('sb_secret_')) return { origem, tipo: 'secret (nova)' };
  if (key.startsWith('sb_publishable_')) return { origem, tipo: 'publishable (pública)' };
  try {
    return { origem, tipo: `JWT legada, papel "${JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role}"` };
  } catch {
    return { origem, tipo: 'formato desconhecido' };
  }
}

export default async function StatusPage() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const projeto = url.replace(/^https?:\/\//, '').split('.')[0] || '—';
  const chave = tipoDaChave();
  const problema = keyProblem();
  const contagens = url
    ? await Promise.all(
        TABELAS.map(async (t) => {
          const { count, error } = await db().from(t).select('*', { count: 'exact', head: true });
          return { t, count, erro: error?.message };
        }),
      )
    : [];

  const linhas: [string, string, boolean][] = [
    ['Projeto do Supabase', projeto, projeto === 'kcrrpppbnaqyfvxyeocq'],
    ['Variável da chave', chave.origem, chave.origem !== '—'],
    ['Tipo da chave', chave.tipo, !problema],
  ];

  return (
    <>
      <PageHeader title="Status da conexão" subtitle="Diagnóstico do banco de dados (não mostra nenhuma chave)" />
      <Body>
        <Card title="Configuração na Vercel">
          <ul className="grid gap-2 text-[13.5px]">
            {linhas.map(([k, v, ok]) => (
              <li key={k} className="flex items-center gap-2">
                {ok ? <CheckCircle2 size={16} className="text-success" /> : <XCircle size={16} className="text-danger" />}
                <span className="w-44 text-muted">{k}</span>
                <span className="font-semibold">{v}</span>
              </li>
            ))}
          </ul>
          {problema && <p className="mt-3 rounded-lg bg-danger-soft p-3 text-[13px] text-danger">Problema: {problema}</p>}
          {projeto !== 'kcrrpppbnaqyfvxyeocq' && projeto !== '—' && (
            <p className="mt-3 rounded-lg bg-warn-soft p-3 text-[13px] text-warn">
              A Vercel está ligada a um projeto diferente do kcrrpppbnaqyfvxyeocq. Confira se foi nesse projeto que você rodou o SQL.
            </p>
          )}
        </Card>
        <Card title="Tabelas">
          <ul className="grid gap-2 text-[13.5px]">
            {contagens.map(({ t, count, erro }) => (
              <li key={t} className="flex items-center gap-2">
                {erro ? <XCircle size={16} className="text-danger" /> : <CheckCircle2 size={16} className="text-success" />}
                <span className="w-44 font-mono text-[12.5px]">{t}</span>
                <span className={erro ? 'text-danger' : 'font-semibold'}>{erro ?? `${count ?? 0} registros`}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Body>
    </>
  );
}

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { db, type Report } from '@/lib/db';
import { formatMonth } from '@/lib/dates';
import { Badge, Body, PageHeader } from '@/components/ui';
import RelatorioEditor from '@/components/relatorio-editor';

export default async function RelatorioPage({ params }: PageProps<'/relatorios/[id]'>) {
  const { id } = await params;
  const supa = db();
  const { data } = await supa.from('reports').select('*, clients(nome, telefone)').eq('id', id).maybeSingle();
  if (!data) notFound();
  const r = data as Report & { clients: { nome: string; telefone: string | null } };
  const { data: ant } = await supa
    .from('reports')
    .select('investimento, impressoes, cliques, conversoes')
    .eq('client_id', r.client_id)
    .lt('competencia', r.competencia)
    .order('competencia', { ascending: false })
    .limit(1)
    .maybeSingle();
  const h = await headers();
  const link = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}/r/${r.token}`;

  return (
    <>
      <PageHeader
        trail={[
          { href: '/clientes', label: 'Clientes' },
          { href: `/clientes/${r.client_id}?tab=relatorios`, label: r.clients.nome },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            Relatório de {formatMonth(r.competencia).toLowerCase()}
            <Badge tone={r.status === 'enviado' ? 'success' : 'neutral'}>{r.status === 'enviado' ? 'Enviado' : 'Rascunho'}</Badge>
          </span>
        }
      />
      <Body wide>
        <RelatorioEditor key={r.updated_at} r={r} anterior={ant ?? null} cliente={r.clients.nome} telefone={r.clients.telefone} link={link} />
      </Body>
    </>
  );
}

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { db, type Proposal, type Service } from '@/lib/db';
import { STATUS_PROPOSTA, numeroProposta } from '@/lib/propostas';
import { Badge, Body, PageHeader } from '@/components/ui';
import PropostaEditor from '@/components/proposta-editor';

export default async function PropostaPage({ params }: PageProps<'/propostas/[id]'>) {
  const { id } = await params;
  const supa = db();
  const [{ data }, { data: svs }] = await Promise.all([
    supa.from('proposals').select('*, leads(id, nome, contato, cidade, whatsapp)').eq('id', id).maybeSingle(),
    supa.from('services').select('*').eq('ativo', true).order('ordem'),
  ]);
  if (!data) notFound();
  const p = data as Proposal & { leads: { id: string; nome: string; contato: string | null; cidade: string | null; whatsapp: string | null } | null };
  const h = await headers();
  const origem = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const lead = p.leads;

  return (
    <>
      <PageHeader
        trail={[
          { href: '/comercial', label: 'Comercial' },
          ...(lead ? [{ href: `/comercial/${lead.id}`, label: lead.nome }] : []),
        ]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            Proposta Nº {numeroProposta(p.numero)} <Badge tone={STATUS_PROPOSTA[p.status].tone}>{STATUS_PROPOSTA[p.status].label}</Badge>
          </span>
        }
        subtitle={lead ? `Para ${lead.nome}` : undefined}
      />
      <Body wide>
        <PropostaEditor
          key={p.updated_at}
          proposta={p}
          servicos={(svs ?? []) as Service[]}
          lead={lead}
          link={`${origem}/p/${p.token}`}
        />
      </Body>
    </>
  );
}

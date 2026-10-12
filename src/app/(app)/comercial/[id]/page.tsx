import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AtSign, MapPin, MessageCircle, Tag, Building2, FileText, Plus, FileSignature } from 'lucide-react';
import { db, type Contract, type Lead, type Proposal } from '@/lib/db';
import { STATUS_CONTRATO, numeroContrato } from '@/lib/contrato';
import { STATUS_PROPOSTA, numeroProposta, totais } from '@/lib/propostas';
import { novaProposta } from '@/app/actions';
import { today, prazo } from '@/lib/dates';
import { brl } from '@/lib/format';
import { NICHO, formatWhatsapp } from '@/lib/prospeccao';
import { lerModelos } from '@/lib/mensagens';
import { Avatar, Badge, Body, Card, PageHeader, btn } from '@/components/ui';
import { Cadence, DealActions, DealField, DealNotes, StageBar } from '@/components/deal';

export default async function NegocioPage({ params }: PageProps<'/comercial/[id]'>) {
  const { id } = await params;
  const [{ data }, { data: props }, { data: cts }, modelos] = await Promise.all([
    db().from('leads').select('*').eq('id', id).maybeSingle(),
    db().from('proposals').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    db().from('contracts').select('*').eq('lead_id', id).neq('status', 'cancelado').order('created_at', { ascending: false }),
    lerModelos(db()),
  ]);
  const contratos = (cts ?? []) as Contract[];
  if (!data) notFound();
  const lead = data as Lead;
  const propostas = (props ?? []) as Proposal[];
  const hoje = today();
  const k = `${lead.id}-${lead.status}-${lead.updated_at}`;

  return (
    <>
      <PageHeader
        trail={[{ href: '/comercial', label: 'Comercial' }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar nome={lead.nome} size={36} />
            <span className="min-w-0">
              {lead.nome}
              <span className="block text-[13px] font-medium text-muted">
                {brl(lead.valor)} por mês · {NICHO[lead.nicho]}
              </span>
            </span>
          </span>
        }
      >
        {lead.status === 'perdido' && <Badge tone="danger">Perdido</Badge>}
        {lead.status === 'fechou' && <Badge tone="success">Ganho</Badge>}
        {lead.client_id && (
          <Link href={`/clientes/${lead.client_id}`} className="text-[13px] font-semibold text-brand">
            Ver cliente
          </Link>
        )}
        <DealActions lead={lead} />
      </PageHeader>

      <div className="border-b border-line bg-surface px-4 py-3 md:px-8">
        <StageBar lead={lead} />
      </div>

      <Body>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
            <Card title="Detalhes">
              <div className="grid grid-cols-[minmax(0,1fr)] divide-y divide-line">
                <DealField key={`v-${k}`} lead={lead} campo="valor" label="Valor mensal" />
                <DealField key={`c-${k}`} lead={lead} campo="contato" label="Contato" />
                <DealField key={`ci-${k}`} lead={lead} campo="cidade" label="Cidade" />
                <DealField key={`p-${k}`} lead={lead} campo="proxima_acao" label="Próxima ação" type="date" />
              </div>
              {lead.proxima_acao && (
                <p className={`mt-2 text-[12px] ${lead.proxima_acao < hoje ? 'font-semibold text-danger' : 'text-muted'}`}>
                  {lead.proxima_acao < hoje ? 'Atrasado: ' : 'Próximo toque: '}
                  {prazo(lead.proxima_acao, hoje)}
                </p>
              )}
            </Card>
            <Card title="Contato">
              <ul className="grid gap-2.5 text-[13px]">
                <li className="flex items-center gap-2">
                  <MessageCircle size={15} className="text-wa" />
                  {lead.whatsapp ? (
                    <a href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand">
                      {formatWhatsapp(lead.whatsapp)}
                    </a>
                  ) : (
                    <span className="text-muted">Sem WhatsApp</span>
                  )}
                  {lead.whatsapp && lead.whatsapp_confirmado && <Badge tone="success">confirmado</Badge>}
                </li>
                <li className="flex items-center gap-2">
                  <AtSign size={15} className="text-magenta" />
                  {lead.instagram ? (
                    <a href={`https://www.instagram.com/${lead.instagram}/`} target="_blank" rel="noopener noreferrer" className="hover:text-brand">
                      @{lead.instagram}
                    </a>
                  ) : (
                    <span className="text-muted">Sem Instagram</span>
                  )}
                </li>
                <li className="flex items-center gap-2">
                  <MapPin size={15} className="text-muted" />
                  <span>{[lead.endereco, lead.cidade].filter(Boolean).join(', ') || '—'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Tag size={15} className="text-muted" />
                  <span>{NICHO[lead.nicho]}</span>
                </li>
                {lead.client_id && (
                  <li className="flex items-center gap-2">
                    <Building2 size={15} className="text-muted" />
                    <Link href={`/clientes/${lead.client_id}`} className="font-semibold text-brand">
                      Já é cliente
                    </Link>
                  </li>
                )}
              </ul>
            </Card>
          </div>

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
            <Card
              flush
              title="Propostas"
              aside={
                <form action={novaProposta.bind(null, lead.id)}>
                  <button className={btn.secondary}>
                    <Plus size={14} /> Criar proposta
                  </button>
                </form>
              }
            >
              {propostas.length ? (
                <ul className="divide-y divide-line">
                  {propostas.map((p) => {
                    const t = totais(p.itens, p.desconto);
                    return (
                      <li key={p.id}>
                        <Link href={`/propostas/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                          <FileText size={18} className="text-brand" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-semibold">Proposta Nº {numeroProposta(p.numero)}</span>
                            <span className="block truncate text-[12px] text-muted">{p.itens.map((i) => i.nome).join(' + ') || 'Sem serviços'}</span>
                          </span>
                          <span className="text-right">
                            <span className="block text-[13px] font-semibold tabular-nums">{brl(t.mensalFinal)}/mês</span>
                            {t.unico > 0 && <span className="block text-[11.5px] text-muted">+ {brl(t.unico)} único</span>}
                          </span>
                          <Badge tone={STATUS_PROPOSTA[p.status].tone}>{STATUS_PROPOSTA[p.status].label}</Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-4 py-5 text-center text-[13px] text-muted">Nenhuma proposta ainda. Crie uma com os serviços da Origo e mande o link pelo WhatsApp.</p>
              )}
            </Card>
            {contratos.length > 0 && (
              <Card flush title="Contrato">
                <ul className="divide-y divide-line">
                  {contratos.map((ct) => (
                    <li key={ct.id}>
                      <Link href={`/contratos/${ct.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                        <FileSignature size={18} className="text-brand" />
                        <span className="flex-1 text-[13.5px] font-semibold">Contrato Nº {numeroContrato(ct.numero)}</span>
                        <Badge tone={STATUS_CONTRATO[ct.status].tone}>{STATUS_CONTRATO[ct.status].label}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {lead.status !== 'fechou' && lead.status !== 'perdido' && (
              <Card title="Cadência de mensagens" aside="4 toques em 10 dias">
                <Cadence key={k} lead={lead} modelos={modelos} />
              </Card>
            )}
            <Card title="Anotações">
              <DealNotes key={k} lead={lead} />
            </Card>
          </div>
        </div>
      </Body>
    </>
  );
}

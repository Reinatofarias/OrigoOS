import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { db, type Contract, type Empresa } from '@/lib/db';
import { STATUS_CONTRATO, clausulas, numeroContrato, type Clausula } from '@/lib/contrato';
import { lerEmpresa } from '@/lib/contratos';
import { Badge, Body, Card, PageHeader, btn } from '@/components/ui';
import { Field } from '@/components/dialog';
import ContratoDoc from '@/components/contrato-doc';
import { LinkAcoes } from '@/components/link-acoes';
import { salvarContrato } from '@/app/actions';
import { CancelarContrato } from './cancelar';

export default async function ContratoPage({ params }: PageProps<'/contratos/[id]'>) {
  const { id } = await params;
  const supa = db();
  const { data } = await supa.from('contracts').select('*, leads(id, nome, whatsapp, contato), clients(id, nome)').eq('id', id).maybeSingle();
  if (!data) notFound();
  const c = data as Contract & { leads: { id: string; nome: string; whatsapp: string | null; contato: string | null } | null; clients: { id: string; nome: string } | null };
  let empresa: Empresa;
  let itens: Clausula[];
  if (c.status === 'assinado' && c.conteudo) {
    ({ empresa, clausulas: itens } = JSON.parse(c.conteudo) as { empresa: Empresa; clausulas: Clausula[] });
  } else {
    empresa = await lerEmpresa(supa);
    itens = clausulas(empresa, c);
  }
  const h = await headers();
  const link = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}/c/${c.token}`;
  const k = c.contratante;
  const nomeCurto = (k.representante ?? c.leads?.contato ?? '').split(' ')[0];
  const zap = (k.telefone || c.leads?.whatsapp || '').replace(/\D/g, '');

  return (
    <>
      <PageHeader
        trail={[
          { href: '/contratos', label: 'Contratos' },
          ...(c.clients ? [{ href: `/clientes/${c.clients.id}`, label: c.clients.nome }] : c.leads ? [{ href: `/comercial/${c.leads.id}`, label: c.leads.nome }] : []),
        ]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            Contrato Nº {numeroContrato(c.numero)} <Badge tone={STATUS_CONTRATO[c.status].tone}>{STATUS_CONTRATO[c.status].label}</Badge>
          </span>
        }
        subtitle={k.nome ? `Com ${k.nome}` : undefined}
      />
      <Body wide>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
            <Card title="Enviar pro cliente">
              <LinkAcoes
                link={link}
                whatsapp={zap}
                mensagem={`${nomeCurto ? `Oi, ${nomeCurto}!` : 'Oi!'} Segue o contrato da Origo pra assinar: ${link}\n\nÉ só conferir os dados e clicar em "Assinar contrato". Qualquer dúvida, me chama aqui.`}
              />
              {!empresa.documento && c.status === 'aguardando' && (
                <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
                  Falta o CNPJ ou CPF da Origo no contrato.{' '}
                  <Link href="/configuracoes?tab=empresa" className="font-semibold underline">
                    Preencher em Configurações
                  </Link>
                </p>
              )}
            </Card>
            {c.status === 'aguardando' && (
              <Card title="Dados do contratante">
                <form action={salvarContrato.bind(null, c.id)} className="grid gap-3">
                  <p className="text-[12.5px] text-muted">O cliente confere e completa na hora de assinar. Se você já tiver, preencha aqui.</p>
                  <Field label="Empresa ou nome">
                    <input name="nome" defaultValue={k.nome} className="field" />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="CNPJ ou CPF">
                      <input name="documento" defaultValue={k.documento} className="field" />
                    </Field>
                    <Field label="Vencimento (dia)">
                      <input name="dia_vencimento" type="number" min={1} max={28} defaultValue={c.dia_vencimento} className="field" />
                    </Field>
                  </div>
                  <Field label="Endereço">
                    <input name="endereco" defaultValue={k.endereco} className="field" />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Quem assina">
                      <input name="representante" defaultValue={k.representante} className="field" />
                    </Field>
                    <Field label="CPF de quem assina">
                      <input name="representante_cpf" defaultValue={k.representante_cpf} className="field" />
                    </Field>
                    <Field label="E-mail">
                      <input name="email" type="email" defaultValue={k.email} className="field" />
                    </Field>
                    <Field label="WhatsApp">
                      <input name="telefone" defaultValue={k.telefone} className="field" />
                    </Field>
                  </div>
                  <div>
                    <button className={btn.primary}>Salvar dados</button>
                  </div>
                </form>
              </Card>
            )}
            {c.status === 'aguardando' && <CancelarContrato id={c.id} />}
          </div>
          <div className="min-w-0">
            <ContratoDoc c={c} empresa={empresa} itens={itens} />
          </div>
        </div>
      </Body>
    </>
  );
}

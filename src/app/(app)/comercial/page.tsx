import Link from 'next/link';
import { db, type Lead } from '@/lib/db';
import { today, prazo } from '@/lib/dates';
import { brl } from '@/lib/format';
import { COLUNAS, NICHO, etapaDe, formatWhatsapp } from '@/lib/prospeccao';
import { Badge, Body, Card, Empty, Kpi, PageHeader, Tabs, btn } from '@/components/ui';
import { FileSignature, KanbanSquare } from 'lucide-react';
import Kanban from '@/components/kanban';
import FormDialog, { Field } from '@/components/dialog';
import { addLead } from '@/app/actions';

export default async function ComercialPage({ searchParams }: PageProps<'/comercial'>) {
  const sp = await searchParams;
  const ver = sp.ver === 'lista' || sp.ver === 'perdidos' ? sp.ver : 'quadro';
  const hoje = today();
  const { data, error } = await db().from('leads').select('*').order('ordem');
  const leads = (data ?? []) as Lead[];
  const abertos = leads.filter((l) => l.status !== 'perdido' && l.status !== 'fechou');
  const ganhos = leads.filter((l) => l.status === 'fechou');
  const perdidos = leads.filter((l) => l.status === 'perdido');
  const noFunil = leads.filter((l) => l.status !== 'perdido');
  const followups = abertos.filter((l) => l.proxima_acao && l.proxima_acao <= hoje).length;
  const soma = (ls: Lead[]) => ls.reduce((s, l) => s + Number(l.valor ?? 0), 0);

  return (
    <>
      <PageHeader title="Comercial" subtitle="Funil de vendas da Origo">
        <Link href="/contratos" className={btn.secondary}>
          <FileSignature size={15} /> Contratos
        </Link>
        <FormDialog label="Negócio" title="Novo negócio" action={addLead}>
          <Field label="Empresa ou profissional *">
            <input name="nome" required className="field" placeholder="Ex.: Clínica Sorriso" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Pessoa de contato">
              <input name="contato" className="field" />
            </Field>
            <Field label="Cidade">
              <input name="cidade" className="field" />
            </Field>
            <Field label="Nicho">
              <select name="nicho" className="field" defaultValue="odonto">
                {Object.entries(NICHO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Valor mensal (R$)">
              <input name="valor" inputMode="decimal" defaultValue="2000" className="field" />
            </Field>
            <Field label="WhatsApp">
              <input name="whatsapp" inputMode="tel" placeholder="(81) 99999-9999" className="field" />
            </Field>
            <Field label="Instagram">
              <input name="instagram" placeholder="@perfil" className="field" />
            </Field>
          </div>
        </FormDialog>
      </PageHeader>

      <div className="border-b border-line bg-surface px-4 md:px-8">
        <div className="grid grid-cols-2 gap-3 py-4 lg:grid-cols-4">
          <Kpi label="Em negociação" value={brl(soma(abertos), false)} hint={`${abertos.length} negócios abertos`} />
          <Kpi label="Follow-ups pra hoje" value={followups} tone={followups ? 'warn' : undefined} hint="Mensagens e retornos devidos" />
          <Kpi label="Ganhos" value={brl(soma(ganhos), false)} tone="success" hint={`${ganhos.length} negócios fechados`} />
          <Kpi
            label="Taxa de conversão"
            value={`${leads.length ? Math.round((ganhos.length / leads.length) * 100) : 0}%`}
            hint={`${perdidos.length} perdidos`}
          />
        </div>
        <Tabs
          active={ver}
          items={[
            { key: 'quadro', label: 'Quadro', href: '/comercial' },
            { key: 'lista', label: 'Lista', href: '/comercial?ver=lista', count: noFunil.length },
            { key: 'perdidos', label: 'Perdidos', href: '/comercial?ver=perdidos', count: perdidos.length },
          ]}
        />
      </div>

      {error && <p className="mx-4 mt-4 rounded-xl bg-danger-soft p-4 text-[13px] text-danger md:mx-8">Não consegui ler o banco: {error.message}</p>}

      {ver === 'quadro' ? (
        <Kanban leads={noFunil} hoje={hoje} />
      ) : (
        <Body>
          <Card flush>
            <LeadTable leads={ver === 'lista' ? noFunil : perdidos} hoje={hoje} />
          </Card>
        </Body>
      )}
    </>
  );
}

function LeadTable({ leads, hoje }: { leads: Lead[]; hoje: string }) {
  if (!leads.length) return <Empty icon={<KanbanSquare size={20} strokeWidth={1.8} />}>Nenhum negócio aqui.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-[13px]">
        <thead className="border-b border-line bg-surface-2/50 text-[11.5px] text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Negócio</th>
            <th className="px-4 py-2 font-medium">Etapa</th>
            <th className="px-4 py-2 font-medium">Valor</th>
            <th className="px-4 py-2 font-medium">Próxima ação</th>
            <th className="px-4 py-2 font-medium">WhatsApp</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="border-b border-line last:border-b-0 hover:bg-surface-2/60">
              <td className="px-4 py-2.5">
                <Link href={`/comercial/${l.id}`} className="font-semibold hover:text-brand">
                  {l.nome}
                </Link>
                <p className="text-[12px] text-muted">{[l.cidade, NICHO[l.nicho]].filter(Boolean).join(' · ')}</p>
              </td>
              <td className="px-4 py-2.5">
                <Badge tone={l.status === 'fechou' ? 'success' : l.status === 'perdido' ? 'danger' : 'brand'}>
                  {etapaDe(l.status)?.titulo ?? COLUNAS.find((c) => c.status === l.status)?.titulo}
                  {etapaDe(l.status)?.id === 'cadencia' && ` · ${l.status.toUpperCase()}`}
                </Badge>
              </td>
              <td className="px-4 py-2.5 font-medium">{brl(l.valor, false)}</td>
              <td className={`px-4 py-2.5 ${l.proxima_acao && l.proxima_acao < hoje ? 'font-semibold text-danger' : ''}`}>
                {l.proxima_acao ? prazo(l.proxima_acao, hoje) : '—'}
              </td>
              <td className="px-4 py-2.5 text-muted">{l.whatsapp ? formatWhatsapp(l.whatsapp) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

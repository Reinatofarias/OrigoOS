import Link from 'next/link';
import { FileSignature, Plus } from 'lucide-react';
import { db, type Contract } from '@/lib/db';
import { STATUS_CONTRATO, numeroContrato } from '@/lib/contrato';
import { brl } from '@/lib/format';
import { ExcluirContrato } from '@/components/excluir-contrato';
import FormDialog, { Field } from '@/components/dialog';
import { registrarContratoAssinadoFora } from '@/app/actions';
import { Badge, Body, Card, Empty, Kpi, PageHeader, btn } from '@/components/ui';

const quando = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

const PASSOS = [
  { t: 'Escolha', d: 'Em "Novo contrato", escolha o cliente (ou cliente novo), o tipo (tráfego, mentoria ou outros serviços), as redes e os serviços.' },
  { t: 'Enviar o link', d: 'No contrato, mande o link pelo WhatsApp (o botão já monta a mensagem).' },
  { t: 'Cliente preenche e assina', d: 'Ele abre o link, preenche os dados dele e da empresa, lê o contrato e clica em Assinar. Fica registrado data, hora e IP.' },
  { t: 'Vira cliente', d: 'Se ainda não era cliente, entra em Clientes sozinho com os serviços. Você recebe um aviso no celular.' },
  { t: 'Cobrança', d: 'Só falta emitir a cobrança na ficha do cliente.' },
];

export default async function ContratosPage() {
  const supa = db();
  const [{ data, error }, { data: cs }] = await Promise.all([
    supa.from('contracts').select('*, clients(id, nome), leads(id, nome)').neq('status', 'cancelado').order('created_at', { ascending: false }),
    supa.from('clients').select('id, nome').eq('ativo', true).order('nome'),
  ]);
  const contratos = (data ?? []) as (Contract & { clients: { id: string; nome: string } | null; leads: { id: string; nome: string } | null })[];
  const clientes = cs ?? [];
  const comContrato = new Set(contratos.map((c) => c.client_id));
  const semContrato = clientes.filter((c) => !comContrato.has(c.id));
  const aguardando = contratos.filter((c) => c.status === 'aguardando');
  const mensal = (c: Contract) => c.itens.filter((i) => i.cobranca === 'mensal').reduce((s, i) => s + Number(i.valor), 0) - Number(c.desconto ?? 0);

  return (
    <>
      <PageHeader title="Contratos" subtitle="Todos os contratos e o caminho até a assinatura">
        <FormDialog label="Registrar contrato já assinado" title="Contrato assinado fora do sistema" action={registrarContratoAssinadoFora} submit="Registrar" variant="secondary">
          <p className="text-[12.5px] text-muted">Pra quem já assinou contrato no papel ou em outro lugar (Autentique, Asaas...). Fica só o registro, sem mandar link.</p>
          <Field label="Cliente *">
            <select name="client_id" required className="field" defaultValue={semContrato[0]?.id ?? ''}>
              <option value="" disabled>
                Escolha o cliente
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {comContrato.has(c.id) ? ' (já tem contrato)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data da assinatura">
            <input name="assinado_em" type="date" required className="field" />
          </Field>
          <Field label="Link do contrato assinado (opcional)">
            <input name="link" type="url" placeholder="https://..." className="field" />
          </Field>
        </FormDialog>
        <Link href="/contratos/novo" className={btn.primary}>
          <Plus size={15} /> Novo contrato
        </Link>
      </PageHeader>
      <Body>
        {error && <p className="rounded-xl bg-danger-soft p-4 text-[13px] text-danger">Não consegui ler o banco: {error.message}</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Assinados" value={contratos.length - aguardando.length} tone="success" icon={<FileSignature size={16} />} />
          <Kpi label="Aguardando assinatura" value={aguardando.length} tone={aguardando.length ? 'warn' : undefined} />
          <Kpi label="Clientes sem contrato" value={semContrato.length} tone={semContrato.length ? 'danger' : undefined} hint={semContrato.slice(0, 2).map((c) => c.nome).join(', ') || 'Todos com contrato'} />
          <Kpi label="Mensal em contrato" value={brl(contratos.reduce((s, c) => s + mensal(c), 0), false)} tone="brand" />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card flush title="Contratos">
            {contratos.length ? (
              <ul className="divide-y divide-line">
                {contratos.map((c) => {
                  const nome = c.clients?.nome ?? c.leads?.nome ?? c.contratante.nome ?? 'Sem nome';
                  return (
                    <li key={c.id} className="flex items-center pr-2 hover:bg-surface-2/60">
                      <Link href={`/contratos/${c.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                        <FileSignature size={16} className="shrink-0 text-brand" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold">{nome}</span>
                          <span className="block text-[12px] text-muted">
                            Nº {numeroContrato(c.numero)} · {c.status === 'assinado' && c.assinado_em ? `assinado${c.modelo?.externo ? ' fora do sistema' : ''} em ${quando(c.assinado_em)}` : `criado em ${quando(c.created_at)}`}
                          </span>
                        </span>
                        <span className="text-[13px] font-semibold tabular-nums">{brl(mensal(c))}/mês</span>
                        <Badge tone={STATUS_CONTRATO[c.status].tone}>{STATUS_CONTRATO[c.status].label}</Badge>
                      </Link>
                      <ExcluirContrato id={c.id} nome={nome} assinado={c.status === 'assinado'} compacto />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty icon={<FileSignature size={20} strokeWidth={1.8} />}>Nenhum contrato ainda. Use &quot;Novo contrato&quot; pra criar o primeiro.</Empty>
            )}
            {semContrato.length > 0 && contratos.length > 0 && (
              <p className="border-t border-line px-4 py-3 text-[12.5px] text-muted">Sem contrato: {semContrato.map((c) => c.nome).join(', ')}.</p>
            )}
          </Card>

          <Card title="Como funciona">
            <ol className="grid gap-3">
              {PASSOS.map((p, i) => (
                <li key={p.t} className="grid grid-cols-[26px_minmax(0,1fr)] gap-2">
                  <span className="bg-grad grid size-6 place-items-center rounded-full text-[12px] font-bold text-white">{i + 1}</span>
                  <span>
                    <span className="block text-[13.5px] font-semibold">{p.t}</span>
                    <span className="block text-[12.5px] leading-relaxed text-muted">{p.d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <Link href="/configuracoes?tab=empresa" className="mt-4 flex items-center gap-1.5 text-[12.5px] font-semibold text-brand">
              <Plus size={13} /> Conferir os dados da Origo que vão no contrato
            </Link>
          </Card>
        </div>
      </Body>
    </>
  );
}

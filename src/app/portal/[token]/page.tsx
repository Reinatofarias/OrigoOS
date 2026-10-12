import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { BarChart3, CheckCircle2, FileSignature, MessageCircle, Receipt } from 'lucide-react';
import { db, type Charge, type Client, type ClientRequest, type Contract, type Report } from '@/lib/db';
import { formatMonth, formatShort, today } from '@/lib/dates';
import { brl, situacao } from '@/lib/format';
import { numeroContrato } from '@/lib/contrato';
import { lerEmpresa } from '@/lib/contratos';
import PedidoItem from './pedido';

// Portal do cliente: um link só com o que ele precisa mandar, faturas, relatórios e contrato.
async function carregar(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const { data } = await db().from('clients').select('*').eq('portal_token', token).maybeSingle();
  return data as Client | null;
}

export async function generateMetadata({ params }: PageProps<'/portal/[token]'>): Promise<Metadata> {
  const c = await carregar((await params).token);
  return { title: c ? `${c.nome} · Origo Company` : 'Portal do cliente', robots: { index: false, follow: false } };
}

function Secao({ icone, titulo, children }: { icone: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#e5e7f0] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-[16px] font-bold text-[#14152e]">
        <span className="grid size-8 place-items-center rounded-lg bg-[#efeaff] text-[#6a4cff]">{icone}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export default async function Portal({ params }: PageProps<'/portal/[token]'>) {
  const { token } = await params;
  const cliente = await carregar(token);
  if (!cliente) notFound();
  const supa = db();
  const hoje = today();
  const [{ data: peds }, { data: ch }, { data: rps }, { data: cts }, empresa] = await Promise.all([
    supa.from('client_requests').select('*').eq('client_id', cliente.id).neq('status', 'ok').order('ordem'),
    supa.from('charges').select('*').eq('client_id', cliente.id).neq('status', 'cancelado').order('vencimento', { ascending: false }).limit(12),
    supa.from('reports').select('*').eq('client_id', cliente.id).eq('status', 'enviado').order('competencia', { ascending: false }).limit(12),
    supa.from('contracts').select('*').eq('client_id', cliente.id).neq('status', 'cancelado').order('created_at', { ascending: false }),
    lerEmpresa(supa),
  ]);
  const pedidos = (peds ?? []) as ClientRequest[];
  const pendentes = pedidos.filter((p) => p.status === 'pendente');
  const cobrancas = (ch ?? []) as Charge[];
  const abertas = cobrancas.filter((c) => c.status === 'pendente');
  const pagas = cobrancas.filter((c) => c.status === 'pago').slice(0, 6);
  const relatorios = (rps ?? []) as Report[];
  const contratos = (cts ?? []) as Contract[];
  const primeiro = (cliente.responsavel ?? cliente.nome).split(' ')[0];

  return (
    <main className="min-h-screen bg-[#eceef6] pb-12">
      <header className="relative overflow-hidden bg-[#0b0c24] px-4 pb-16 pt-6 text-white sm:px-6">
        <div className="bg-grad pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-30 blur-3xl" />
        <div className="relative mx-auto flex max-w-[760px] items-center gap-3">
          <Image src="/brand/origo-marca.png" alt="" width={40} height={40} className="size-10" />
          <div>
            <p className="text-[18px] font-bold leading-none">Origo</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#b9bbdc]">Company</p>
          </div>
        </div>
        <div className="relative mx-auto mt-8 max-w-[760px]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b9bbdc]">Portal do cliente</p>
          <h1 className="mt-1 text-[26px] font-bold">{cliente.nome}</h1>
          <p className="mt-1 text-[14px] text-[#b9bbdc]">
            Olá, {primeiro}! Aqui fica tudo da nossa parceria: o que preciso de você, faturas, relatórios e contrato.
          </p>
        </div>
      </header>

      <div className="relative mx-auto -mt-10 grid max-w-[760px] gap-4 px-3 sm:px-6">
        <Secao icone={<CheckCircle2 size={17} />} titulo={pendentes.length ? `O que preciso de você (${pendentes.length})` : 'O que preciso de você'}>
          {pedidos.length ? (
            <ul className="grid gap-3">
              {pedidos.map((p) => (
                <PedidoItem key={`${p.id}-${p.status}`} token={token} pedido={p} />
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-[#6b6e8a]">Tudo certo por aqui. Não estou esperando nada de você agora.</p>
          )}
        </Secao>

        <Secao icone={<Receipt size={17} />} titulo="Faturas">
          {abertas.length + pagas.length === 0 ? (
            <p className="text-[14px] text-[#6b6e8a]">Nenhuma fatura ainda.</p>
          ) : (
            <ul className="divide-y divide-[#eef0f6]">
              {[...abertas.sort((a, b) => a.vencimento.localeCompare(b.vencimento)), ...pagas].map((c) => {
                const s = situacao(c, hoje);
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold text-[#14152e]">{c.descricao}</span>
                      <span className="block text-[12.5px] text-[#6b6e8a]">
                        {s === 'pago' ? `Paga${c.pago_em ? ` em ${formatShort(c.pago_em.slice(0, 10))}` : ''}` : `Vence ${formatShort(c.vencimento)}`}
                      </span>
                    </span>
                    <span className="text-[14px] font-bold tabular-nums text-[#14152e]">{brl(c.valor)}</span>
                    {s === 'pago' ? (
                      <span className="rounded-md bg-[#e7f7ef] px-2 py-0.5 text-[12px] font-semibold text-[#0f7a50]">Paga</span>
                    ) : c.asaas_url ? (
                      <a href={c.asaas_url} target="_blank" rel="noopener noreferrer" className="bg-grad rounded-lg px-3 py-1.5 text-[13px] font-semibold text-white">
                        Pagar {s === 'vencido' ? '(vencida)' : ''}
                      </a>
                    ) : (
                      <span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${s === 'vencido' ? 'bg-[#fde8ea] text-[#b4232c]' : 'bg-[#fff4e0] text-[#a5650a]'}`}>
                        {s === 'vencido' ? 'Vencida' : 'Em aberto'}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Secao>

        <Secao icone={<BarChart3 size={17} />} titulo="Relatórios de resultados">
          {relatorios.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {relatorios.map((r) => (
                <li key={r.id}>
                  <a href={`/r/${r.token}`} className="flex items-center gap-2 rounded-xl border border-[#e5e7f0] px-3.5 py-3 text-[14px] font-semibold text-[#14152e] hover:border-[#6a4cff]">
                    <BarChart3 size={16} className="text-[#6a4cff]" /> {formatMonth(r.competencia)}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-[#6b6e8a]">O primeiro relatório chega no começo do mês que vem.</p>
          )}
        </Secao>

        {contratos.length > 0 && (
          <Secao icone={<FileSignature size={17} />} titulo="Contrato">
            <ul className="grid gap-2">
              {contratos.map((c) => (
                <li key={c.id}>
                  <a href={`/c/${c.token}`} className="flex items-center gap-2 text-[14px] font-semibold text-[#14152e] hover:text-[#6a4cff]">
                    <FileSignature size={16} className="text-[#6a4cff]" /> Contrato Nº {numeroContrato(c.numero)}
                    <span className={`ml-auto rounded-md px-2 py-0.5 text-[12px] ${c.status === 'assinado' ? 'bg-[#e7f7ef] text-[#0f7a50]' : 'bg-[#fff4e0] text-[#a5650a]'}`}>
                      {c.status === 'assinado' ? 'Assinado' : 'Aguardando sua assinatura'}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Secao>
        )}

        <p className="flex flex-wrap items-center justify-center gap-1.5 pt-2 text-center text-[13px] text-[#6b6e8a]">
          <MessageCircle size={14} /> Qualquer dúvida, é só chamar o {empresa.responsavel.split(' ')[0]} no WhatsApp.
        </p>
      </div>
    </main>
  );
}

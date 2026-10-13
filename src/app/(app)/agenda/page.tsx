import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db, type Task } from '@/lib/db';
import { addDays, formatShort, today, weekday } from '@/lib/dates';
import { diasDo, listarEventos, situacaoAgenda, type Evento } from '@/lib/google-agenda';
import { Body, PageHeader, btn } from '@/components/ui';
import { NovoCompromisso } from '@/components/agenda';
import { ItensDoDia } from '@/components/agenda-dia';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Segunda-feira da semana de um dia.
const segundaDe = (dia: string) => addDays(dia, -((weekday(dia) + 6) % 7));

export default async function AgendaPage({ searchParams }: PageProps<'/agenda'>) {
  const sp = await searchParams;
  const hoje = today();
  const pedido = typeof sp.semana === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : hoje;
  const inicio = segundaDe(pedido);
  const fim = addDays(inicio, 6);
  const dias = Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
  const supa = db();

  const [situacao, { data: ts }] = await Promise.all([
    situacaoAgenda(supa),
    supa.from('tasks').select('id, titulo, status, data, origem, client_id, clients(nome)').gte('data', inicio).lte('data', fim).order('created_at'),
  ]);
  let eventos: Evento[] = [];
  let erro: string | null = null;
  if (situacao.ve) {
    try {
      eventos = await listarEventos(supa, inicio, fim);
    } catch (e) {
      erro = e instanceof Error ? e.message : 'erro desconhecido';
    }
  }
  const tarefas = ((ts ?? []) as unknown as (Pick<Task, 'id' | 'titulo' | 'status' | 'data' | 'origem'> & { clients: { nome: string } | null })[]).map((t) => ({ ...t, cliente: t.clients?.nome ?? null }));
  const porDia = Object.fromEntries(dias.map((d) => [d, { eventos: eventos.filter((e) => diasDo(e).includes(d)), tarefas: tarefas.filter((t) => t.data === d) }]));
  const titulo = `${formatShort(inicio)} a ${formatShort(fim)}`;

  return (
    <>
      <PageHeader title="Agenda" subtitle={situacao.ve ? `Google Agenda${situacao.email ? ` de ${situacao.email}` : ''} e tarefas com prazo` : 'Tarefas com prazo'}>
        {situacao.ve && <NovoCompromisso modo={situacao.conectada ? 'api' : 'link'} dia={pedido >= inicio && pedido <= fim && pedido !== inicio ? pedido : inicio <= hoje && hoje <= fim ? hoje : inicio} />}
      </PageHeader>
      <Body wide>
        {!situacao.ve && (
          <p className="rounded-lg border border-brand/30 bg-brand-soft px-4 py-3 text-[13px]">
            {situacao.configurada ? 'Falta conectar sua conta Google pra ver e criar compromissos aqui.' : 'Pra ver seus compromissos do Google Agenda aqui, cole o endereço secreto da agenda na Vercel (passo a passo em Configurações).'}{' '}
            <Link href="/configuracoes?tab=integracoes" className="font-semibold text-brand underline">
              {situacao.configurada ? 'Conectar Google Agenda' : 'Abrir Configurações'}
            </Link>
          </p>
        )}
        {erro && <p className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-[13px] text-danger">Não consegui ler o Google Agenda: {erro}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/agenda?semana=${addDays(inicio, -7)}`} className={btn.secondary} aria-label="Semana anterior">
            <ChevronLeft size={16} />
          </Link>
          <Link href="/agenda" className={btn.secondary}>
            Hoje
          </Link>
          <Link href={`/agenda?semana=${addDays(inicio, 7)}`} className={btn.secondary} aria-label="Próxima semana">
            <ChevronRight size={16} />
          </Link>
          <h2 className="ml-1 text-[15px] font-semibold">Semana de {titulo}</h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-7">
          {dias.map((d) => {
            const { eventos: evs, tarefas: tfs } = porDia[d];
            const eHoje = d === hoje;
            const vazio = !evs.length && !tfs.length;
            return (
              <section key={d} className={`min-w-0 rounded-xl border bg-surface p-2.5 lg:min-h-[320px] ${eHoje ? 'border-brand ring-1 ring-brand/30' : 'border-line'} ${vazio ? 'max-lg:hidden' : ''}`}>
                <h3 className="mb-2 flex items-baseline gap-1.5 px-0.5">
                  <span className={`text-[12px] font-semibold uppercase tracking-wide ${eHoje ? 'text-brand' : 'text-muted'}`}>{DIAS[weekday(d)]}</span>
                  <span className={`text-[15px] font-bold ${eHoje ? 'text-brand' : ''}`}>{formatShort(d)}</span>
                  {eHoje && <span className="ml-auto text-[11px] font-semibold text-brand">Hoje</span>}
                </h3>
                {vazio ? <p className="px-0.5 text-[12px] text-faint">Livre</p> : <ItensDoDia eventos={evs} tarefas={tfs} compacto />}
              </section>
            );
          })}
        </div>
        {dias.every((d) => !porDia[d].eventos.length && !porDia[d].tarefas.length) && <p className="text-center text-[13px] text-muted lg:hidden">Nada marcado nesta semana.</p>}
      </Body>
    </>
  );
}

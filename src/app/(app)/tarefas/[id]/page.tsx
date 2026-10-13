import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, type Task, type TaskComment, type TaskItem } from '@/lib/db';
import { prazo, today } from '@/lib/dates';
import { Badge, Body, Card, PageHeader } from '@/components/ui';
import { situacaoAgenda } from '@/lib/google-agenda';
import { NovoCompromisso } from '@/components/agenda';
import { TaskActivity, TaskChecklist, TaskDescription, TaskFields, TaskStatusButtons, TaskTitle } from '@/components/task-detail';

const ORIGEM: Record<Task['origem'], string> = {
  manual: 'Criada por você',
  onboarding: 'Onboarding do cliente',
  recorrente: 'Rotina recorrente',
};

const quando = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

export default async function TarefaPage({ params }: PageProps<'/tarefas/[id]'>) {
  const { id } = await params;
  const supa = db();
  const [{ data }, { data: clientes }, itensRes, comentariosRes] = await Promise.all([
    supa.from('tasks').select('*').eq('id', id).maybeSingle(),
    supa.from('clients').select('id, nome').order('nome'),
    supa.from('task_items').select('*').eq('task_id', id).order('ordem').order('created_at'),
    supa.from('task_comments').select('*').eq('task_id', id).order('created_at'),
  ]);
  if (!data) notFound();
  const agenda = await situacaoAgenda(supa).catch(() => null);
  const task = data as Task;
  const itens = (itensRes.data ?? []) as TaskItem[];
  const comentarios = (comentariosRes.data ?? []) as TaskComment[];
  // Sem as tabelas da v6, a página funciona só com a descrição e avisa o que falta.
  const semV6 = !!itensRes.error || !!comentariosRes.error;
  const hoje = today();
  const cliente = (clientes ?? []).find((c) => c.id === task.client_id);
  const atrasada = !!task.data && task.data < hoje && task.status !== 'done';
  const k = `${task.id}-${task.status}-${task.prioridade}-${task.data}-${task.client_id}`;

  return (
    <>
      <PageHeader trail={[{ href: '/tarefas', label: 'Tarefas' }]} title={<TaskTitle key={task.titulo} task={task} />}>
        {atrasada && <Badge tone="danger">Atrasada · {prazo(task.data!, hoje)}</Badge>}
        <TaskStatusButtons key={k} task={task} />
      </PageHeader>

      <Body>
        {semV6 && (
          <p className="rounded-lg border border-warn/40 bg-warn-soft px-4 py-3 text-[13px] text-warn">
            Para usar subtarefas e comentários, rode o arquivo <b>supabase/atualizar-v6.sql</b> no SQL Editor do Supabase.
          </p>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
            <Card title="Descrição">
              <TaskDescription key={task.descricao ?? ''} task={task} />
            </Card>
            {!semV6 && (
              <Card flush title="Subtarefas" aside={itens.length ? `${itens.filter((i) => i.feita).length} de ${itens.length} feitas` : undefined}>
                <TaskChecklist taskId={task.id} itens={itens} />
              </Card>
            )}
            {!semV6 && (
              <Card title="Atividade">
                <TaskActivity taskId={task.id} comentarios={comentarios} criadaEm={task.created_at} />
              </Card>
            )}
          </div>

          <div className="order-first grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 lg:sticky lg:top-6 lg:order-none">
            <Card title="Detalhes">
              <TaskFields key={k} task={task} clientes={clientes ?? []} />
              <dl className="mt-3 grid gap-1.5 border-t border-line pt-3 text-[12.5px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Criada em</dt>
                  <dd>{quando(task.created_at)}</dd>
                </div>
                {task.feita_em && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Concluída em</dt>
                    <dd>{quando(task.feita_em)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Origem</dt>
                  <dd>{ORIGEM[task.origem] ?? task.origem}</dd>
                </div>
              </dl>
              {cliente && (
                <Link href={`/clientes/${cliente.id}`} className="mt-3 block text-[13px] font-semibold text-brand">
                  Abrir {cliente.nome}
                </Link>
              )}
              {agenda?.conectada && (
                <div className="mt-3 border-t border-line pt-3">
                  <NovoCompromisso
                    label="Agendar no Google Agenda"
                    variant="secondary"
                    taskId={task.id}
                    titulo={cliente ? `${task.titulo} · ${cliente.nome}` : task.titulo}
                    descricao={task.descricao ?? ''}
                    dia={task.data && task.data >= hoje ? task.data : hoje}
                  />
                </div>
              )}
            </Card>
          </div>
        </div>
      </Body>
    </>
  );
}

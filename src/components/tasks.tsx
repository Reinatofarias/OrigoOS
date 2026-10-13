'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { CalendarDays, Circle, CircleCheck, CircleDot, Flag, Plus, Trash2, ChevronDown, X, ListChecks, MessageSquare, PanelRightOpen, PartyPopper, Repeat } from 'lucide-react';
import { addTask, deleteTask, updateTask } from '@/app/actions';
import type { Prioridade, Task, TaskStatus } from '@/lib/db';
import { formatShort, prazo } from '@/lib/dates';
import { descreverRepeticao } from '@/lib/repeticao';
import { Empty } from './ui';
import { PRIORIDADE, STATUS, type ResumoTarefa } from '@/lib/tarefas';
import { avisar } from './toast';

export type ClienteMin = { id: string; nome: string };

export { STATUS, PRIORIDADE };

const PROXIMO: Record<TaskStatus, TaskStatus> = { todo: 'doing', doing: 'done', done: 'todo' };

// As colunas (cliente, prazo, prioridade) aparecem quando a lista tem espaço (≥ 672px), não pelo tamanho da tela:
// no Início a lista fica estreita e o nome da tarefa era espremido.
const COLS = '@2xl:grid-cols-[28px_minmax(0,1fr)_170px_110px_110px_32px]';

function StatusIcon({ status }: { status: TaskStatus }) {
  const cor = STATUS[status].cor;
  if (status === 'done') return <CircleCheck size={18} color={cor} fill={cor} stroke="white" className="animate-pop" />;
  if (status === 'doing') return <CircleDot size={18} color={cor} />;
  return <Circle size={18} color={cor} />;
}

// Prazo como no ClickUp: "Hoje", "Amanhã", "12/10"; o calendário abre ao clicar.
function DateCell({ value, hoje, feita, onChange }: { value: string | null; hoje: string; feita: boolean; onChange: (v: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const atrasada = !!value && value < hoje && !feita;
  return (
    <span className="relative flex items-center">
      <button
        type="button"
        onClick={() => {
          try {
            ref.current?.showPicker();
          } catch {
            ref.current?.focus();
          }
        }}
        className={`flex items-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-[13px] hover:border-line ${
          atrasada ? 'font-semibold text-danger' : value === hoje ? 'font-semibold text-brand' : value ? '' : 'text-faint'
        }`}
      >
        <CalendarDays size={13} className="opacity-60" />
        {value ? prazo(value, hoje) : 'Sem prazo'}
      </button>
      {value && (
        <button type="button" onClick={() => onChange(null)} aria-label="Tirar prazo" className="ml-0.5 rounded p-0.5 text-faint opacity-0 hover:text-ink group-hover:opacity-100">
          <X size={12} />
        </button>
      )}
      <input
        ref={ref}
        type="date"
        tabIndex={-1}
        aria-label="Prazo"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
      />
    </span>
  );
}

export function TaskRow({
  task,
  clientes,
  hoje,
  semCliente,
  resumo,
}: {
  task: Task;
  clientes: ClienteMin[];
  hoje: string;
  semCliente?: boolean;
  resumo?: ResumoTarefa;
}) {
  const [pending, start] = useTransition();
  const [titulo, setTitulo] = useState(task.titulo);
  const salvar = (campos: Parameters<typeof updateTask>[1]) => start(async () => {
    await updateTask(task.id, campos);
  });
  const atrasada = !!task.data && task.data < hoje && task.status !== 'done';
  const cliente = clientes.find((c) => c.id === task.client_id);

  return (
    <div
      className={`group grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-line px-3 py-1.5 last:border-b-0 hover:bg-surface-2/60 ${COLS} ${pending ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        onClick={() =>
          start(async () => {
            const proxima = await updateTask(task.id, { status: PROXIMO[task.status] });
            if (proxima) avisar(`Feito! Próxima repetição em ${formatShort(proxima)}`);
          })
        }
        title={`${STATUS[task.status].label}: clique para avançar`}
        aria-label={`Status: ${STATUS[task.status].label}. Avançar`}
        className="grid size-7 place-items-center rounded-md hover:bg-surface-2"
      >
        <StatusIcon status={task.status} />
      </button>

      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <input
            aria-label="Nome da tarefa"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={() => titulo.trim() && titulo !== task.titulo && salvar({ titulo: titulo.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className={`cell-input min-w-0 flex-1 text-[13.5px] font-medium ${task.status === 'done' ? 'text-muted line-through' : ''}`}
          />
          <span className="hidden @2xl:flex">
            <Indicadores task={task} resumo={resumo} />
          </span>
          <Link
            href={`/tarefas/${task.id}`}
            title="Abrir detalhes"
            aria-label="Abrir detalhes da tarefa"
            className="grid size-7 shrink-0 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-brand @2xl:opacity-0 @2xl:group-hover:opacity-100 @2xl:focus:opacity-100"
          >
            <PanelRightOpen size={15} />
          </Link>
        </div>
        {/* No celular, cliente e prazo aparecem embaixo do nome */}
        <p className="flex items-center gap-2 px-1.5 text-[11.5px] text-muted @2xl:hidden">
          {cliente && !semCliente && <span className="truncate">{cliente.nome}</span>}
          {task.data && <span className={`shrink-0 ${atrasada ? 'font-semibold text-danger' : ''}`}>{prazo(task.data, hoje)}</span>}
          <Indicadores task={task} resumo={resumo} />
        </p>
      </div>

      <div className="hidden @2xl:block">
        {semCliente ? (
          <span />
        ) : (
          <select
            aria-label="Cliente"
            value={task.client_id ?? ''}
            onChange={(e) => salvar({ client_id: e.target.value || null })}
            className={`cell-input w-full truncate ${task.client_id ? '' : 'text-faint'}`}
          >
            <option value="">Sem cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="hidden @2xl:block">
        <DateCell value={task.data} hoje={hoje} feita={task.status === 'done'} onChange={(data) => salvar({ data })} />
      </div>

      <div className="hidden items-center gap-1 @2xl:flex">
        <Flag size={13} color={PRIORIDADE[task.prioridade].cor} fill={task.prioridade === 'baixa' ? 'none' : PRIORIDADE[task.prioridade].cor} />
        <select
          aria-label="Prioridade"
          value={task.prioridade}
          onChange={(e) => salvar({ prioridade: e.target.value as Prioridade })}
          className="cell-input w-full"
        >
          {Object.entries(PRIORIDADE).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => confirm('Apagar esta tarefa?') && start(async () => { await deleteTask(task.id); avisar('Tarefa apagada'); })}
        aria-label="Apagar tarefa"
        className="grid size-7 place-items-center rounded-md text-faint opacity-100 hover:bg-danger-soft hover:text-danger @2xl:opacity-0 @2xl:group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// Descrição, subtarefas e comentários, como os ícones do ClickUp ao lado do nome.
function Indicadores({ task, resumo }: { task: Task; resumo?: ResumoTarefa }) {
  if (!resumo?.itens && !resumo?.comentarios && !task.descricao && !task.repeticao) return null;
  return (
    <Link href={`/tarefas/${task.id}`} className="flex shrink-0 items-center gap-2 px-1 text-[11.5px] text-muted hover:text-ink">
      {task.repeticao && (
        <span className="flex items-center text-brand" title={`Repete: ${descreverRepeticao(task.repeticao)}`} aria-label={`Repete: ${descreverRepeticao(task.repeticao)}`}>
          <Repeat size={12} />
        </span>
      )}
      {!!resumo?.itens && (
        <span className={`flex items-center gap-0.5 ${resumo.feitos === resumo.itens ? 'text-success' : ''}`} title="Subtarefas feitas">
          <ListChecks size={13} /> {resumo.feitos}/{resumo.itens}
        </span>
      )}
      {!!resumo?.comentarios && (
        <span className="flex items-center gap-0.5" title="Comentários">
          <MessageSquare size={12} /> {resumo.comentarios}
        </span>
      )}
      {!resumo?.itens && !resumo?.comentarios && task.descricao && <span title="Tem descrição">≡</span>}
    </Link>
  );
}

function AddRow({ status, clientId, data }: { status: TaskStatus; clientId?: string; data?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [aberto, setAberto] = useState(false);
  const [pending, start] = useTransition();
  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="flex w-full items-center gap-2 px-4 py-2 text-[13px] text-muted hover:bg-surface-2/60 hover:text-ink">
        <Plus size={14} /> Adicionar tarefa
      </button>
    );
  }
  return (
    <form
      ref={ref}
      action={(fd) =>
        start(async () => {
          await addTask(fd);
          ref.current?.reset();
          avisar('Tarefa criada');
        })
      }
      className="flex items-center gap-2 px-3 py-1.5"
    >
      <input type="hidden" name="status" value={status} />
      {clientId && <input type="hidden" name="client_id" value={clientId} />}
      {data && <input type="hidden" name="data" value={data} />}
      <Circle size={18} color={STATUS[status].cor} className="ml-1.5 shrink-0" />
      <input
        name="titulo"
        autoFocus
        placeholder="Nome da tarefa e Enter"
        onKeyDown={(e) => e.key === 'Escape' && setAberto(false)}
        className="field py-1.5"
        disabled={pending}
      />
      <button className="rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white" disabled={pending}>
        Salvar
      </button>
    </form>
  );
}

export function TaskGroups({
  tasks,
  clientes,
  hoje,
  clientId,
  ocultarConcluidas,
  resumos,
}: {
  tasks: Task[];
  clientes: ClienteMin[];
  hoje: string;
  clientId?: string;
  ocultarConcluidas?: boolean;
  resumos?: Record<string, ResumoTarefa>;
}) {
  const [fechados, setFechados] = useState<Record<string, boolean>>({ done: !!ocultarConcluidas });
  return (
    <div className="grid gap-5">
      {(Object.keys(STATUS) as TaskStatus[]).map((st) => {
        const lista = tasks.filter((t) => t.status === st);
        const fechado = fechados[st];
        return (
          <section key={st} className="min-w-0">
            <button
              type="button"
              onClick={() => setFechados((f) => ({ ...f, [st]: !f[st] }))}
              className="mb-2 flex items-center gap-2"
              aria-expanded={!fechado}
            >
              <ChevronDown size={15} className={`text-muted transition ${fechado ? '-rotate-90' : ''}`} />
              <span className="rounded-md px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-wide text-white" style={{ background: STATUS[st].cor }}>
                {STATUS[st].label}
              </span>
              <span className="text-[12.5px] text-muted">{lista.length}</span>
            </button>
            {!fechado && (
              <div className="@container overflow-hidden rounded-xl border border-line bg-surface">
                <div className={`hidden border-b border-line bg-surface-2/50 px-3 py-1.5 text-[11.5px] font-medium text-muted @2xl:grid ${COLS}`}>
                  <span />
                  <span className="px-1.5">Nome</span>
                  <span className="px-1.5">{clientId ? '' : 'Cliente'}</span>
                  <span className="px-1.5">Prazo</span>
                  <span className="px-1.5">Prioridade</span>
                  <span />
                </div>
                {lista.map((t) => (
                  <TaskRow
                    key={`${t.id}-${t.status}-${t.titulo}`}
                    task={t}
                    clientes={clientes}
                    hoje={hoje}
                    semCliente={!!clientId}
                    resumo={resumos?.[t.id]}
                  />
                ))}
                <AddRow status={st} clientId={clientId} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Lista compacta para o Início: só as tarefas abertas de hoje e atrasadas, com campo rápido.
export function TodayTasks({
  tasks,
  clientes,
  hoje,
  resumos,
}: {
  tasks: Task[];
  clientes: ClienteMin[];
  hoje: string;
  resumos?: Record<string, ResumoTarefa>;
}) {
  return (
    <div className="@container">
      {tasks.length ? (
        tasks.map((t) => <TaskRow key={`${t.id}-${t.status}-${t.titulo}`} task={t} clientes={clientes} hoje={hoje} resumo={resumos?.[t.id]} />)
      ) : (
        <Empty icon={<PartyPopper size={20} strokeWidth={1.8} />}>
          Nada pendente pra hoje. <Link href="/tarefas" className="font-semibold text-brand">Ver todas as tarefas</Link>
        </Empty>
      )}
      <AddRow status="todo" data={hoje} />
    </div>
  );
}

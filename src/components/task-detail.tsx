'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Circle, CircleCheck, CircleDot, Flag, MessageSquare, Plus, Send, Trash2, X } from 'lucide-react';
import { deleteTask, updateTask } from '@/app/actions';
import { addComment, addItem, deleteComment, deleteItem, updateItem } from '@/app/acoes/tarefas';
import type { Prioridade, Task, TaskComment, TaskItem, TaskStatus } from '@/lib/db';
import { PRIORIDADE, STATUS } from '@/lib/tarefas';
import { btn } from '@/components/ui';

function StatusIcon({ status, size = 18 }: { status: TaskStatus; size?: number }) {
  const cor = STATUS[status].cor;
  if (status === 'done') return <CircleCheck size={size} color={cor} fill={cor} stroke="white" />;
  if (status === 'doing') return <CircleDot size={size} color={cor} />;
  return <Circle size={size} color={cor} />;
}

const quando = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

// Nome grande e editável, como no topo da tarefa no ClickUp.
export function TaskTitle({ task }: { task: Task }) {
  const [titulo, setTitulo] = useState(task.titulo);
  const [, start] = useTransition();
  // Cresce com o texto, para o nome inteiro aparecer também no celular.
  const ajustar = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  return (
    <textarea
      ref={ajustar}
      rows={1}
      aria-label="Nome da tarefa"
      value={titulo}
      onChange={(e) => {
        setTitulo(e.target.value.replace(/\n/g, ' '));
        ajustar(e.target);
      }}
      onBlur={() => titulo.trim() && titulo !== task.titulo && start(() => updateTask(task.id, { titulo: titulo.trim() }))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={`cell-input block w-full resize-none overflow-hidden text-[20px] font-bold leading-snug tracking-tight md:text-[22px] ${task.status === 'done' ? 'text-muted line-through' : ''}`}
    />
  );
}

export function TaskStatusButtons({ task }: { task: Task }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <div className={`flex overflow-hidden rounded-lg border border-line ${pending ? 'opacity-60' : ''}`} role="group" aria-label="Status">
        {(Object.keys(STATUS) as TaskStatus[]).map((st) => (
          <button
            key={st}
            type="button"
            aria-pressed={task.status === st}
            onClick={() => task.status !== st && start(() => updateTask(task.id, { status: st }))}
            className="flex items-center gap-1.5 border-r border-line px-3 py-1.5 text-[12.5px] font-semibold text-muted last:border-r-0 hover:bg-surface-2 aria-pressed:text-white"
            style={task.status === st ? { background: STATUS[st].cor } : undefined}
          >
            {task.status !== st && <StatusIcon status={st} size={14} />}
            {STATUS[st].label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          confirm('Apagar esta tarefa, com subtarefas e comentários?') &&
          start(async () => {
            await deleteTask(task.id);
            router.push('/tarefas');
          })
        }
        className={btn.ghost}
        aria-label="Apagar tarefa"
      >
        <Trash2 size={15} />
      </button>
    </>
  );
}

// Campos da lateral: prioridade, cliente e prazo.
export function TaskFields({ task, clientes }: { task: Task; clientes: { id: string; nome: string }[] }) {
  const [pending, start] = useTransition();
  const salvar = (campos: Parameters<typeof updateTask>[1]) => start(() => updateTask(task.id, campos));
  const linha = 'grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2 py-1.5';
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)] divide-y divide-line ${pending ? 'opacity-60' : ''}`}>
      <label className={linha}>
        <span className="text-[12.5px] text-muted">Prioridade</span>
        <span className="flex items-center gap-1">
          <Flag size={13} color={PRIORIDADE[task.prioridade].cor} fill={task.prioridade === 'baixa' ? 'none' : PRIORIDADE[task.prioridade].cor} />
          <select value={task.prioridade} onChange={(e) => salvar({ prioridade: e.target.value as Prioridade })} className="cell-input w-full text-[13.5px]">
            {Object.entries(PRIORIDADE).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </span>
      </label>
      <label className={linha}>
        <span className="text-[12.5px] text-muted">Cliente</span>
        <select
          value={task.client_id ?? ''}
          onChange={(e) => salvar({ client_id: e.target.value || null })}
          className={`cell-input w-full text-[13.5px] ${task.client_id ? '' : 'text-faint'}`}
        >
          <option value="">Sem cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      <label className={linha}>
        <span className="text-[12.5px] text-muted">Prazo</span>
        <input
          type="date"
          defaultValue={task.data ?? ''}
          onChange={(e) => salvar({ data: e.target.value || null })}
          className="cell-input w-full text-[13.5px]"
        />
      </label>
    </div>
  );
}

export function TaskDescription({ task }: { task: Task }) {
  const [texto, setTexto] = useState(task.descricao ?? '');
  const [salvo, setSalvo] = useState(false);
  const [, start] = useTransition();
  return (
    <div className="grid gap-2">
      <textarea
        aria-label="Descrição"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setSalvo(false);
        }}
        onBlur={() =>
          texto !== (task.descricao ?? '') &&
          start(async () => {
            await updateTask(task.id, { descricao: texto.trim() || null });
            setSalvo(true);
          })
        }
        rows={6}
        placeholder="O que precisa ser feito, links, acessos, referências…"
        className="field resize-y leading-relaxed"
      />
      <p className="text-[12px] text-muted">{salvo ? 'Descrição salva.' : 'Salva sozinha quando você sai do campo.'}</p>
    </div>
  );
}

function ItemRow({ item }: { item: TaskItem }) {
  const [titulo, setTitulo] = useState(item.titulo);
  const [pending, start] = useTransition();
  return (
    <li className={`group flex items-center gap-2 px-4 py-1.5 hover:bg-surface-2/60 ${pending ? 'opacity-60' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={item.feita}
        aria-label={item.feita ? 'Desmarcar subtarefa' : 'Marcar subtarefa como feita'}
        onClick={() => start(() => updateItem(item.id, { feita: !item.feita }))}
        className={`grid size-[18px] shrink-0 place-items-center rounded border ${item.feita ? 'border-success bg-success text-white' : 'border-line hover:border-brand'}`}
      >
        {item.feita && <Check size={12} strokeWidth={3} />}
      </button>
      <input
        aria-label="Subtarefa"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onBlur={() => titulo.trim() && titulo !== item.titulo && start(() => updateItem(item.id, { titulo }))}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={`cell-input min-w-0 flex-1 text-[13.5px] ${item.feita ? 'text-muted line-through' : ''}`}
      />
      <button
        type="button"
        onClick={() => start(() => deleteItem(item.id))}
        aria-label="Apagar subtarefa"
        className="grid size-7 place-items-center rounded-md text-faint hover:bg-danger-soft hover:text-danger md:opacity-0 md:group-hover:opacity-100"
      >
        <X size={14} />
      </button>
    </li>
  );
}

export function TaskChecklist({ taskId, itens }: { taskId: string; itens: TaskItem[] }) {
  const [novo, setNovo] = useState('');
  const [pending, start] = useTransition();
  const feitos = itens.filter((i) => i.feita).length;
  const pct = itens.length ? Math.round((feitos / itens.length) * 100) : 0;
  return (
    <div>
      {itens.length > 0 && (
        <div className="flex items-center gap-3 px-4 pt-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[12px] font-semibold tabular-nums text-muted">
            {feitos}/{itens.length}
          </span>
        </div>
      )}
      <ul className="py-1.5">
        {itens.map((i) => (
          <ItemRow key={`${i.id}-${i.feita}-${i.titulo}`} item={i} />
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!novo.trim()) return;
          start(async () => {
            await addItem(taskId, novo);
            setNovo('');
          });
        }}
        className="flex items-center gap-2 border-t border-line px-4 py-2"
      >
        <Plus size={15} className="shrink-0 text-muted" />
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Adicionar subtarefa e Enter"
          aria-label="Nova subtarefa"
          disabled={pending}
          className="cell-input min-w-0 flex-1 text-[13.5px]"
        />
      </form>
    </div>
  );
}

// Comentários e histórico misturados por data, como a aba Atividade do ClickUp.
export function TaskActivity({ taskId, comentarios, criadaEm }: { taskId: string; comentarios: TaskComment[]; criadaEm: string }) {
  const [texto, setTexto] = useState('');
  const [pending, start] = useTransition();
  const enviar = () =>
    texto.trim() &&
    start(async () => {
      await addComment(taskId, texto);
      setTexto('');
    });
  return (
    <div className="grid gap-3">
      <ol className="grid gap-3">
        <li className="flex gap-2 text-[12.5px] text-muted">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-faint" />
          <span>Tarefa criada · {quando(criadaEm)}</span>
        </li>
        {comentarios.map((c) =>
          c.tipo === 'atividade' ? (
            <li key={c.id} className="flex gap-2 text-[12.5px] text-muted">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-faint" />
              <span>
                {c.texto} · {quando(c.created_at)}
              </span>
            </li>
          ) : (
            <li key={c.id} className="group rounded-lg border border-line bg-surface p-3">
              <div className="mb-1 flex items-center gap-2 text-[11.5px] text-muted">
                <MessageSquare size={12} />
                <span>{quando(c.created_at)}</span>
                <button
                  type="button"
                  onClick={() => confirm('Apagar este comentário?') && start(() => deleteComment(c.id))}
                  aria-label="Apagar comentário"
                  className="ml-auto rounded p-0.5 text-faint hover:text-danger md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{c.texto}</p>
            </li>
          ),
        )}
      </ol>
      <div className="grid gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              enviar();
            }
          }}
          rows={3}
          placeholder="Escreva um comentário…"
          aria-label="Novo comentário"
          className="field resize-y"
          disabled={pending}
        />
        <div className="flex items-center justify-between">
          <span className="hidden text-[11.5px] text-faint md:inline">Ctrl + Enter envia</span>
          <button type="button" onClick={enviar} disabled={pending || !texto.trim()} className={btn.primary}>
            <Send size={14} /> Comentar
          </button>
        </div>
      </div>
    </div>
  );
}

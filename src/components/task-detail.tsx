'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Circle, CircleCheck, CircleDot, Flag, MessageSquare, Plus, Repeat, Send, Trash2, X } from 'lucide-react';
import { definirRepeticao, deleteTask, updateTask } from '@/app/actions';
import { addComment, addItem, deleteComment, deleteItem, updateItem } from '@/app/acoes/tarefas';
import type { Prioridade, Task, TaskComment, TaskItem, TaskStatus } from '@/lib/db';
import { PRIORIDADE, STATUS } from '@/lib/tarefas';
import { formatShort, today, weekday } from '@/lib/dates';
import { proximaData, SEMANA, type Repeticao } from '@/lib/repeticao';
import { btn } from '@/components/ui';
import { avisar } from './toast';

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
      onBlur={() => titulo.trim() && titulo !== task.titulo && start(async () => { await updateTask(task.id, { titulo: titulo.trim() }); })}
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
            onClick={() =>
              task.status !== st &&
              start(async () => {
                const proxima = await updateTask(task.id, { status: st });
                if (proxima) avisar(`Feito! Próxima repetição em ${formatShort(proxima)}`);
              })
            }
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
  const salvar = (campos: Parameters<typeof updateTask>[1]) => start(async () => {
    await updateTask(task.id, campos);
  });
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
      <Repetir key={JSON.stringify(task.repeticao ?? null)} task={task} linha={linha} />
    </div>
  );
}

type Modo = '' | 'dia' | 'uteis' | 'semana' | 'quinzena' | 'mes' | 'outro';

function modoDe(r: Repeticao | null | undefined): Modo {
  if (!r) return '';
  const dias = [...(r.dias_semana ?? [])].sort().join();
  if (r.tipo === 'dias' && r.a_cada === 1) return 'dia';
  if (r.tipo === 'semanas' && r.a_cada === 1) return dias === '1,2,3,4,5' ? 'uteis' : 'semana';
  if (r.tipo === 'semanas' && r.a_cada === 2 && !dias) return 'quinzena';
  if (r.tipo === 'meses' && r.a_cada === 1) return 'mes';
  return 'outro';
}

// Repetir, como no ClickUp: ao concluir a tarefa, nasce a próxima com o novo prazo.
function Repetir({ task, linha }: { task: Task; linha: string }) {
  const [pending, start] = useTransition();
  const [modo, setModo] = useState<Modo>(modoDe(task.repeticao));
  const [n, setN] = useState(String(task.repeticao?.a_cada ?? 3));
  const [unidade, setUnidade] = useState<Repeticao['tipo']>(task.repeticao?.tipo ?? 'dias');
  const base = task.data ?? today();
  const atual = task.repeticao ?? null;

  const gravar = (r: Repeticao | null, aviso: string) =>
    start(async () => {
      const erro = await definirRepeticao(task.id, r);
      avisar(erro ?? aviso, erro ? 'erro' : undefined);
    });

  const escolher = (m: Modo) => {
    setModo(m);
    if (m === 'outro') return;
    const r: Repeticao | null =
      m === 'dia'
        ? { tipo: 'dias', a_cada: 1 }
        : m === 'uteis'
          ? { tipo: 'semanas', a_cada: 1, dias_semana: [1, 2, 3, 4, 5] }
          : m === 'semana'
            ? { tipo: 'semanas', a_cada: 1, dias_semana: [weekday(base)] }
            : m === 'quinzena'
              ? { tipo: 'semanas', a_cada: 2 }
              : m === 'mes'
                ? { tipo: 'meses', a_cada: 1, dia_mes: Number(base.slice(8, 10)) }
                : null;
    gravar(r, r ? 'Repetição salva' : 'Repetição removida');
  };

  const salvarOutro = (qtd = n, tipo = unidade) => {
    const a_cada = Math.max(1, Math.min(365, Math.floor(Number(qtd)) || 1));
    const r: Repeticao = tipo === 'meses' ? { tipo, a_cada, dia_mes: Number(base.slice(8, 10)) } : { tipo, a_cada };
    if (atual && atual.tipo === r.tipo && atual.a_cada === r.a_cada && !atual.dias_semana?.length) return;
    gravar(r, 'Repetição salva');
  };

  const alternarDia = (d: number) => {
    const dias = atual?.dias_semana ?? [];
    const novos = dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d].sort();
    if (!novos.length) return;
    gravar({ tipo: 'semanas', a_cada: 1, dias_semana: novos }, 'Repetição salva');
  };

  return (
    <div className={`py-1.5 ${pending ? 'opacity-60' : ''}`}>
      <label className={linha.replace('py-1.5', '')}>
        <span className="flex items-center gap-1 text-[12.5px] text-muted">
          <Repeat size={12} /> Repetir
        </span>
        <select value={modo} onChange={(e) => escolher(e.target.value as Modo)} className={`cell-input w-full text-[13.5px] ${modo ? '' : 'text-faint'}`}>
          <option value="">Não repete</option>
          <option value="dia">Todo dia</option>
          <option value="uteis">Dias úteis (seg a sex)</option>
          <option value="semana">Toda semana</option>
          <option value="quinzena">A cada 2 semanas</option>
          <option value="mes">Todo mês, no dia {Number(base.slice(8, 10))}</option>
          <option value="outro">Personalizar…</option>
        </select>
      </label>

      {modo === 'semana' && atual?.tipo === 'semanas' && (
        <div className="mt-2 flex flex-wrap gap-1 pl-[104px]" role="group" aria-label="Dias da semana">
          {SEMANA.map((nome, d) => (
            <button
              key={nome}
              type="button"
              aria-pressed={!!atual.dias_semana?.includes(d)}
              onClick={() => alternarDia(d)}
              className="rounded-md border border-line px-2 py-1 text-[12px] font-semibold text-muted hover:bg-surface-2 aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-white"
            >
              {nome}
            </button>
          ))}
        </div>
      )}

      {modo === 'outro' && (
        <div className="mt-2 flex items-center gap-2 pl-[104px] text-[13px]">
          <span className="text-muted">A cada</span>
          <input
            type="number"
            min={1}
            max={365}
            inputMode="numeric"
            aria-label="Quantidade"
            value={n}
            onChange={(e) => setN(e.target.value)}
            onBlur={() => salvarOutro()}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="field w-16 px-2 py-1 text-center"
          />
          <select
            aria-label="Unidade"
            value={unidade}
            onChange={(e) => {
              const u = e.target.value as Repeticao['tipo'];
              setUnidade(u);
              salvarOutro(n, u);
            }}
            className="field w-auto px-2 py-1"
          >
            <option value="dias">dias</option>
            <option value="semanas">semanas</option>
            <option value="meses">meses</option>
          </select>
        </div>
      )}

      {atual && (
        <p className="mt-1.5 pl-[104px] text-[12px] leading-snug text-muted">
          Ao concluir, a próxima nasce para {formatShort(proximaData(atual, task.data))}
          {task.data ? '.' : ', contando do dia em que concluir.'}
        </p>
      )}
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
            avisar('Descrição salva');
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
            avisar('Subtarefa adicionada');
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

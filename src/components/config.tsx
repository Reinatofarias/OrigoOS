'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteService, deleteTemplate, updateService, updateTemplate } from '@/app/actions';
import type { Service, TaskTemplate } from '@/lib/db';
import { PRIORIDADE } from './tasks';
import { avisar } from './toast';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function Texto({ valor, salvar, label, className = '' }: { valor: string; salvar: (v: string) => void; label: string; className?: string }) {
  const [v, setV] = useState(valor);
  return (
    <input
      aria-label={label}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() !== valor && salvar(v.trim())}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className={`cell-input w-full ${className}`}
    />
  );
}

function Ativo({ ativo, mudar }: { ativo: boolean; mudar: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      aria-label={ativo ? 'Ativo' : 'Desligado'}
      onClick={() => mudar(!ativo)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${ativo ? 'bg-success' : 'bg-line'}`}
    >
      <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition ${ativo ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

function Apagar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Apagar" className="grid size-7 place-items-center rounded-md text-faint hover:bg-danger-soft hover:text-danger">
      <Trash2 size={14} />
    </button>
  );
}

export function ServiceRow({ s }: { s: Service }) {
  const [pending, start] = useTransition();
  const up = (c: Partial<Service>) => start(async () => { await updateService(s.id, c); avisar('Serviço salvo'); });
  return (
    <div className={`grid gap-2 border-b border-line px-3 py-2.5 last:border-b-0 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_110px_120px_40px_32px] md:items-center ${pending ? 'opacity-60' : ''} ${s.ativo ? '' : 'text-muted'}`}>
      <Texto label="Nome" valor={s.nome} salvar={(nome) => nome && up({ nome })} className="font-semibold" />
      <Texto label="Descrição" valor={s.descricao ?? ''} salvar={(d) => up({ descricao: d || null })} className="text-muted" />
      <Texto label="Preço" valor={String(Number(s.preco))} salvar={(v) => up({ preco: Number(v.replace(/\./g, '').replace(',', '.')) || 0 })} className="tabular-nums" />
      <select aria-label="Cobrança" value={s.cobranca} onChange={(e) => up({ cobranca: e.target.value as Service['cobranca'] })} className="cell-input w-full">
        <option value="mensal">Mensal</option>
        <option value="unico">Único</option>
      </select>
      <Ativo ativo={s.ativo} mudar={(ativo) => up({ ativo })} />
      <Apagar onClick={() => confirm(`Apagar "${s.nome}"? Propostas antigas continuam iguais.`) && start(() => deleteService(s.id))} />
    </div>
  );
}

export function TemplateRow({ t }: { t: TaskTemplate }) {
  const [pending, start] = useTransition();
  const up = (c: Partial<TaskTemplate>) => start(async () => { await updateTemplate(t.id, c); avisar('Tarefa recorrente salva'); });
  return (
    <div className={`grid gap-2 border-b border-line px-3 py-2.5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_170px_110px_110px_40px_32px] md:items-center ${pending ? 'opacity-60' : ''} ${t.ativo ? '' : 'text-muted'}`}>
      <Texto label="Tarefa" valor={t.titulo} salvar={(titulo) => titulo && up({ titulo })} className="font-medium" />
      {t.tipo === 'onboarding' ? (
        <label className="flex items-center gap-1.5 text-[13px] text-muted">
          Dia
          <input
            type="number"
            min={0}
            max={90}
            defaultValue={t.dias}
            onBlur={(e) => Number(e.target.value) !== t.dias && up({ dias: Math.max(0, Number(e.target.value) || 0) })}
            className="cell-input w-14 text-ink"
            aria-label="Dias depois do início"
          />
          do cliente
        </label>
      ) : t.frequencia === 'semanal' ? (
        <select aria-label="Dia da semana" value={t.dia_semana ?? 1} onChange={(e) => up({ dia_semana: Number(e.target.value) })} className="cell-input w-full">
          {DIAS.map((d, i) => (
            <option key={d} value={i}>
              Toda {d.toLowerCase()}
            </option>
          ))}
        </select>
      ) : (
        <select aria-label="Dia do mês" value={t.dia_mes ?? 5} onChange={(e) => up({ dia_mes: Number(e.target.value) })} className="cell-input w-full">
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              Todo dia {d}
            </option>
          ))}
        </select>
      )}
      <select aria-label="Plataforma" value={t.plataforma} onChange={(e) => up({ plataforma: e.target.value as TaskTemplate['plataforma'] })} className="cell-input w-full">
        <option value="todas">Todos</option>
        <option value="google">Só Google</option>
        <option value="meta">Só Meta</option>
      </select>
      <select aria-label="Prioridade" value={t.prioridade} onChange={(e) => up({ prioridade: e.target.value as TaskTemplate['prioridade'] })} className="cell-input w-full">
        {Object.entries(PRIORIDADE).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </select>
      <Ativo ativo={t.ativo} mudar={(ativo) => up({ ativo })} />
      <Apagar onClick={() => confirm(`Apagar "${t.titulo}"?`) && start(() => deleteTemplate(t.id))} />
    </div>
  );
}

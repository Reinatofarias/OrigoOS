import Link from 'next/link';
import { CheckCircle2, Circle, ExternalLink, Video } from 'lucide-react';
import type { Task } from '@/lib/db';
import { hora, type Evento } from '@/lib/google-agenda';
import { ApagarEvento } from './agenda';

// Lista de um dia: compromissos do Google (dia inteiro primeiro, depois por hora) e tarefas com prazo naquele dia.
export function ItensDoDia({ eventos, tarefas, compacto }: { eventos: Evento[]; tarefas: Pick<Task, 'id' | 'titulo' | 'status'>[]; compacto?: boolean }) {
  const ordenados = [...eventos].sort((a, b) => Number(b.diaInteiro) - Number(a.diaInteiro) || a.inicio.localeCompare(b.inicio));
  return (
    <ul className="grid gap-1.5">
      {ordenados.map((e) => (
        <li key={e.id} className="group flex items-start gap-2 rounded-lg border-l-[3px] border-brand bg-brand-soft/60 px-2 py-1.5 text-[12.5px]">
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-semibold text-brand">{e.diaInteiro ? 'Dia inteiro' : `${hora(e.inicio)} – ${hora(e.fim)}`}</p>
            <p className={`font-medium ${compacto ? 'line-clamp-2' : ''}`}>{e.titulo}</p>
            {(e.meet || e.link) && (
              <span className="mt-0.5 flex flex-wrap gap-x-2.5 text-[11.5px]">
                {e.meet && (
                  <a href={e.meet} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
                    <Video size={12} /> Meet
                  </a>
                )}
                {e.link && (
                  <a href={e.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-ink">
                    <ExternalLink size={11} /> Abrir
                  </a>
                )}
              </span>
            )}
          </div>
          <ApagarEvento id={e.id} titulo={e.titulo} />
        </li>
      ))}
      {tarefas.map((t) => (
        <li key={t.id}>
          <Link href={`/tarefas/${t.id}`} className="flex items-start gap-2 rounded-lg border border-line bg-surface px-2 py-1.5 text-[12.5px] hover:bg-surface-2">
            {t.status === 'done' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" /> : <Circle size={14} className="mt-0.5 shrink-0 text-faint" />}
            <span className={`min-w-0 ${compacto ? 'line-clamp-2' : ''} ${t.status === 'done' ? 'text-muted line-through' : ''}`}>{t.titulo}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

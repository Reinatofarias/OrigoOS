import Link from 'next/link';
import { CheckCircle2, ChevronRight, Circle, ExternalLink, Repeat, Video } from 'lucide-react';
import type { Task } from '@/lib/db';
import { hora, type Evento } from '@/lib/google-agenda';
import { ApagarEvento } from './agenda';

// Lista de um dia: compromissos do Google (dia inteiro primeiro, depois por hora) e tarefas com prazo naquele dia.
type TarefaDia = Pick<Task, 'id' | 'titulo' | 'status'> & { origem?: Task['origem']; cliente?: string | null };

function LinhaTarefa({ t, texto, compacto }: { t: TarefaDia; texto: string; compacto?: boolean }) {
  return (
    <Link href={`/tarefas/${t.id}`} className="flex items-start gap-2 rounded-lg border border-line bg-surface px-2 py-1.5 text-[12.5px] hover:bg-surface-2">
      {t.status === 'done' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" /> : <Circle size={14} className="mt-0.5 shrink-0 text-faint" />}
      <span className={`min-w-0 ${compacto ? 'line-clamp-2' : ''} ${t.status === 'done' ? 'text-muted line-through' : ''}`}>{texto}</span>
    </Link>
  );
}

export function ItensDoDia({ eventos, tarefas, compacto }: { eventos: Evento[]; tarefas: TarefaDia[]; compacto?: boolean }) {
  // Tarefas recorrentes iguais (uma por cliente) viram uma linha só: "Otimização 1 · 5 clientes".
  const grupos = new Map<string, TarefaDia[]>();
  const soltas: TarefaDia[] = [];
  for (const t of tarefas) {
    if (t.origem === 'recorrente') grupos.set(t.titulo, [...(grupos.get(t.titulo) ?? []), t]);
    else soltas.push(t);
  }
  for (const [titulo, ts] of grupos) {
    if (ts.length > 1) continue;
    soltas.push(ts[0]);
    grupos.delete(titulo);
  }
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
          {!e.soLeitura && <ApagarEvento id={e.id} titulo={e.titulo} />}
        </li>
      ))}
      {soltas.map((t) => (
        <li key={t.id}>
          <LinhaTarefa t={t} texto={t.cliente && t.origem === 'recorrente' ? `${t.titulo} · ${t.cliente}` : t.titulo} compacto={compacto} />
        </li>
      ))}
      {[...grupos].map(([titulo, ts]) => {
        const feitas = ts.filter((t) => t.status === 'done').length;
        const tudo = feitas === ts.length;
        return (
          <li key={titulo}>
            <details className="group/g rounded-lg border border-line bg-surface text-[12.5px]">
              <summary className="flex cursor-pointer list-none items-start gap-2 px-2 py-1.5 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                {tudo ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" /> : <Repeat size={14} className="mt-0.5 shrink-0 text-faint" />}
                <span className={`min-w-0 flex-1 ${tudo ? 'text-muted line-through' : ''}`}>
                  {titulo}
                  <span className="block text-[11.5px] text-muted no-underline">
                    {ts.length} clientes · {feitas} feita{feitas === 1 ? '' : 's'}
                  </span>
                </span>
                <ChevronRight size={14} className="mt-0.5 shrink-0 text-faint transition group-open/g:rotate-90" />
              </summary>
              <ul className="grid gap-1 border-t border-line p-1.5">
                {ts.map((t) => (
                  <li key={t.id}>
                    <LinhaTarefa t={t} texto={t.cliente ?? 'Sem cliente'} compacto={compacto} />
                  </li>
                ))}
              </ul>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

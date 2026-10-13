'use server';

import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { numeroContrato } from '@/lib/contrato';

export type ResultadoBusca = { tipo: 'pagina' | 'cliente' | 'tarefa' | 'lead' | 'contrato'; titulo: string; sub: string; href: string };

// Busca rápida (Ctrl+K): clientes, tarefas, leads e contratos pelo nome.
export async function buscar(termo: string): Promise<ResultadoBusca[]> {
  await requireAuth();
  const q = termo.trim().replace(/[%_\\,()]/g, ' ').trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const supa = db();
  const [{ data: cs }, { data: ts }, { data: ls }, { data: ks }] = await Promise.all([
    supa.from('clients').select('id, nome, cidade, ativo').ilike('nome', like).order('nome').limit(5),
    supa.from('tasks').select('id, titulo, status, data, clients(nome)').ilike('titulo', like).order('data', { ascending: false, nullsFirst: false }).limit(6),
    supa.from('leads').select('id, nome, cidade, status').ilike('nome', like).order('nome').limit(5),
    supa.from('contracts').select('id, numero, status, contratante').ilike('contratante->>nome', like).order('numero', { ascending: false }).limit(4),
  ]);
  const r: ResultadoBusca[] = [];
  for (const c of cs ?? []) r.push({ tipo: 'cliente', titulo: c.nome, sub: [c.ativo ? 'Cliente' : 'Cliente inativo', c.cidade].filter(Boolean).join(' · '), href: `/clientes/${c.id}` });
  for (const t of ts ?? []) {
    const cli = (t.clients as unknown as { nome: string } | null)?.nome;
    r.push({ tipo: 'tarefa', titulo: t.titulo, sub: ['Tarefa' + (t.status === 'done' ? ' concluída' : ''), cli].filter(Boolean).join(' · '), href: `/tarefas/${t.id}` });
  }
  for (const l of ls ?? []) r.push({ tipo: 'lead', titulo: l.nome, sub: ['Lead', l.cidade].filter(Boolean).join(' · '), href: `/comercial/${l.id}` });
  for (const k of ks ?? []) r.push({ tipo: 'contrato', titulo: `Contrato Nº ${numeroContrato(k.numero)}`, sub: (k.contratante as { nome?: string } | null)?.nome ?? '', href: `/contratos/${k.id}` });
  return r;
}

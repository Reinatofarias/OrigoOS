import { weekday } from './dates';
import type { Client } from './db';

// Rotina pessoal do Renato (rotina-semanal.md, versão 1).
export const DIA_BASE = [
  { hora: '6h00', item: 'Devocional' },
  { hora: '6h30', item: 'Rotina do filho e escola' },
  { hora: '7h45', item: 'Exercício' },
  { hora: '9h00', item: 'Bloco 1: operação (tráfego)' },
  { hora: '13h30', item: 'Prospecção: 5 abordagens' },
  { hora: '14h30', item: 'Bloco 2: comercial, reuniões, entregas' },
];

export function notaDoDia(iso: string) {
  switch (weekday(iso)) {
    case 1:
    case 3:
    case 5:
      return 'Encerra às 18h. Rhema às 19h45.';
    case 2:
      return 'Pequeno grupo à noite.';
    case 4:
      return 'Dia de foco profundo.';
    default:
      return 'Fim de semana é da família.';
  }
}

export type TarefaRotina = { tipo: string; titulo: string };

// Tarefas de tráfego que valem para todos os clientes, conforme o dia da semana.
export function tarefasDeTrafego(iso: string): TarefaRotina[] {
  const dia = weekday(iso);
  const diaDoMes = Number(iso.slice(8, 10));
  const lista: TarefaRotina[] = [];
  if (dia === 1) lista.push({ tipo: 'feedback', titulo: 'Feedback semanal' });
  if (dia === 2) lista.push({ tipo: 'otimizacao1', titulo: 'Otimização 1' });
  if (dia === 4) lista.push({ tipo: 'otimizacao2', titulo: 'Otimização 2 e criativos' });
  if (dia === 5) lista.push({ tipo: 'fechamento', titulo: 'Fechamento da semana' });
  if (diaDoMes <= 7 && dia >= 1 && dia <= 3) lista.push({ tipo: 'relatorio', titulo: 'Relatório mensal' });
  return lista;
}

export const PLATAFORMA: Record<Client['plataforma'], string> = {
  google: 'Google Ads',
  meta: 'Meta Ads',
  google_meta: 'Google + Meta',
};

export const CHECKLIST: Record<'google' | 'meta', string[]> = {
  google: [
    'Termos de pesquisa: negativar o que não tem a ver',
    'Conversões e custo por conversão da semana',
    'Orçamento e lances: está limitada por orçamento?',
    'Pausar o pior anúncio e criar uma variação',
    'Anotar em 1 linha o que mudou',
  ],
  meta: [
    'Frequência acima de 3? Trocar criativo',
    'CPM, CTR e custo por resultado vs. semana passada',
    'Pausar o pior criativo e subir 1 novo',
    'Algum público saturado ou gastando sem resultado?',
    'Anotar em 1 linha o que mudou',
  ],
};

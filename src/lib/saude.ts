import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, addMonths, formatMonth } from './dates';
import { brl } from './format';

// Saúde dos clientes: avisa antes do cliente pensar em sair.

export type Nivel = 'ok' | 'atencao' | 'risco';
export type Alerta = { nivel: Exclude<Nivel, 'ok'>; texto: string };
export type Saude = { client_id: string; nome: string; nivel: Nivel; alertas: Alerta[] };

const dias = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000);

export async function saudeDosClientes(supa: SupabaseClient, hoje: string): Promise<Saude[]> {
  const mesPassado = addMonths(hoje.slice(0, 7), -1);
  const [{ data: clientes }, { data: ch }, { data: ads }, { data: rps }, { data: onb }, { data: peds }] = await Promise.all([
    supa.from('clients').select('id, nome, inicio, created_at, ultimo_contato, meta_conta, google_conta').eq('ativo', true).order('nome'),
    supa.from('charges').select('client_id, valor, vencimento').eq('status', 'pendente').lt('vencimento', hoje),
    supa.from('ad_metrics').select('client_id, plataforma, data, investimento, conversoes, atualizado_em').gte('data', addDays(hoje, -15)),
    supa.from('reports').select('client_id').eq('competencia', mesPassado).eq('status', 'enviado'),
    supa.from('tasks').select('client_id').eq('origem', 'onboarding').neq('status', 'done').lt('data', hoje),
    supa.from('client_requests').select('client_id, titulo, created_at').eq('status', 'pendente').lt('created_at', `${addDays(hoje, -5)}T00:00:00`),
  ]);
  const ontem = addDays(hoje, -1);
  const enviados = new Set((rps ?? []).map((r) => r.client_id));

  return (clientes ?? [])
    .map((c) => {
      const alertas: Alerta[] = [];

      const vencidas = (ch ?? []).filter((x) => x.client_id === c.id);
      if (vencidas.length) {
        const maisAntiga = vencidas.reduce((a, b) => (a.vencimento < b.vencimento ? a : b));
        const atraso = dias(maisAntiga.vencimento, hoje);
        const soma = vencidas.reduce((s, x) => s + Number(x.valor), 0);
        alertas.push({ nivel: atraso > 7 ? 'risco' : 'atencao', texto: `Pagamento atrasado há ${atraso} dia${atraso > 1 ? 's' : ''} (${brl(soma)})` });
      }

      const desde = c.ultimo_contato ?? c.inicio ?? c.created_at.slice(0, 10);
      const semContato = dias(desde, hoje);
      if (semContato > 7) {
        alertas.push({ nivel: semContato > 14 ? 'risco' : 'atencao', texto: c.ultimo_contato ? `Sem contato há ${semContato} dias` : 'Nenhum contato registrado ainda' });
      }

      for (const plat of ['meta', 'google'] as const) {
        const linhas = (ads ?? []).filter((a) => a.client_id === c.id && a.plataforma === plat);
        if (!linhas.length) continue;
        const nome = plat === 'meta' ? 'Meta' : 'Google';
        const atualizado = linhas.reduce((m, a) => (a.atualizado_em > m ? a.atualizado_em : m), '');
        // Só confia no "parou" se os números chegaram nos últimos 2 dias.
        if (dias(atualizado.slice(0, 10), hoje) <= 2) {
          const gastoOntem = linhas.filter((a) => a.data === ontem).reduce((s, a) => s + Number(a.investimento), 0);
          const gastoAntes = linhas.filter((a) => a.data < ontem && a.data >= addDays(hoje, -8)).reduce((s, a) => s + Number(a.investimento), 0);
          if (gastoOntem === 0 && gastoAntes > 0) alertas.push({ nivel: 'risco', texto: `Anúncios do ${nome} sem gasto ontem (saldo acabou ou campanha parou?)` });
        }
        const semana = (de: number, ate: number) => {
          const l = linhas.filter((a) => a.data >= addDays(hoje, -de) && a.data < addDays(hoje, -ate));
          return { gasto: l.reduce((s, a) => s + Number(a.investimento), 0), conv: l.reduce((s, a) => s + Number(a.conversoes), 0) };
        };
        const agora = semana(7, 0);
        const antes = semana(14, 7);
        if (agora.conv >= 3 && antes.conv >= 3) {
          const subiu = agora.gasto / agora.conv / (antes.gasto / antes.conv) - 1;
          if (subiu > 0.5) alertas.push({ nivel: 'atencao', texto: `Custo por contato no ${nome} subiu ${Math.round(subiu * 100)}% na semana` });
        }
        if (agora.gasto > 0 && agora.conv === 0 && antes.conv > 0) alertas.push({ nivel: 'risco', texto: `Nenhum contato pelo ${nome} nos últimos 7 dias` });
      }

      const clienteDesde = (c.inicio ?? c.created_at.slice(0, 10)).slice(0, 7);
      if (Number(hoje.slice(8, 10)) > 5 && clienteDesde <= mesPassado && !enviados.has(c.id)) {
        alertas.push({ nivel: 'atencao', texto: `Relatório de ${formatMonth(mesPassado)} não enviado` });
      }

      const atrasadas = (onb ?? []).filter((t) => t.client_id === c.id).length;
      if (atrasadas) alertas.push({ nivel: 'atencao', texto: `${atrasadas} tarefa${atrasadas > 1 ? 's' : ''} de onboarding atrasada${atrasadas > 1 ? 's' : ''}` });

      const pedidos = (peds ?? []).filter((p) => p.client_id === c.id);
      if (pedidos.length) alertas.push({ nivel: 'atencao', texto: `Cliente ainda não mandou: ${pedidos.map((p) => p.titulo).join(', ')}` });

      alertas.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'risco' ? -1 : 1));
      const nivel: Nivel = alertas.some((a) => a.nivel === 'risco') ? 'risco' : alertas.length ? 'atencao' : 'ok';
      return { client_id: c.id, nome: c.nome, nivel, alertas };
    })
    .sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel] || b.alertas.length - a.alertas.length);
}

const ORDEM: Record<Nivel, number> = { risco: 0, atencao: 1, ok: 2 };

export const NIVEL: Record<Nivel, { label: string; cor: string; tone: 'danger' | 'warn' | 'success' }> = {
  risco: { label: 'Em risco', cor: 'var(--color-danger)', tone: 'danger' },
  atencao: { label: 'Atenção', cor: 'var(--color-warn)', tone: 'warn' },
  ok: { label: 'Em dia', cor: 'var(--color-success)', tone: 'success' },
};

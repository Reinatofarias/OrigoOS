'use client';

import { useState, useTransition } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { excluirRelatorio, marcarRelatorioEnviado, salvarRelatorio } from '@/app/actions';
import type { Report } from '@/lib/db';
import type { Numeros } from '@/lib/relatorio';
import { Field } from './dialog';
import { LinkAcoes } from './link-acoes';
import RelatorioDoc from './relatorio-doc';
import { btn } from './ui';

const num = (v: string) => {
  const t = v.trim();
  if (!t) return null;
  const x = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/\.(?=\d{3}(\D|$))/g, ''));
  return Number.isFinite(x) ? x : null;
};
const str = (v: number | null) => (v === null || v === undefined ? '' : String(v));

export default function RelatorioEditor({ r, anterior, cliente, telefone, link }: { r: Report; anterior: Numeros | null; cliente: string; telefone: string | null; link: string }) {
  const [f, setF] = useState({
    investimento: str(r.investimento),
    impressoes: str(r.impressoes),
    cliques: str(r.cliques),
    conversoes: str(r.conversoes),
    conversao_nome: r.conversao_nome,
    destaques: r.destaques ?? '',
    proximos_passos: r.proximos_passos ?? '',
  });
  const [sujo, setSujo] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    setSujo(true);
  };
  const dados = () => ({
    investimento: num(f.investimento),
    impressoes: num(f.impressoes) === null ? null : Math.round(num(f.impressoes)!),
    cliques: num(f.cliques) === null ? null : Math.round(num(f.cliques)!),
    conversoes: num(f.conversoes) === null ? null : Math.round(num(f.conversoes)!),
    conversao_nome: f.conversao_nome.trim() || 'Contatos',
    destaques: f.destaques.trim() || null,
    proximos_passos: f.proximos_passos.trim() || null,
  });
  const nomeCurto = cliente.replace(/^(Dra?\.|Delegada)\s+/i, '').split(' ')[0];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className={`grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 ${pending ? 'opacity-70' : ''}`}>
        <section className="grid gap-3 rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={pending || !sujo} onClick={() => start(() => salvarRelatorio(r.id, dados()))} className={btn.primary}>
              <Save size={15} /> {pending ? 'Salvando…' : sujo ? 'Salvar' : 'Salvo'}
            </button>
            {sujo && <span className="text-[12px] text-warn">O link mostra a última versão salva.</span>}
          </div>
          <LinkAcoes
            link={link}
            whatsapp={(telefone ?? '').replace(/\D/g, '')}
            mensagem={`Oi, ${nomeCurto}! Segue o relatório de resultados do mês: ${link}\n\nQualquer dúvida, me chama aqui.`}
            aoEnviar={() => start(async () => {
              if (sujo) await salvarRelatorio(r.id, dados());
              await marcarRelatorioEnviado(r.id);
            })}
          />
        </section>
        <section className="grid gap-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-[14px] font-semibold">Números do mês</h2>
          <p className="-mt-2 text-[12px] text-muted">Copie do Google Ads ou do Gerenciador de Anúncios da Meta (soma das campanhas do mês).</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Investimento (R$)">
              <input inputMode="decimal" value={f.investimento} onChange={set('investimento')} className="field" />
            </Field>
            <Field label="Impressões">
              <input inputMode="numeric" value={f.impressoes} onChange={set('impressoes')} className="field" />
            </Field>
            <Field label="Cliques">
              <input inputMode="numeric" value={f.cliques} onChange={set('cliques')} className="field" />
            </Field>
            <Field label="Conversões">
              <input inputMode="numeric" value={f.conversoes} onChange={set('conversoes')} className="field" />
            </Field>
            <Field label="Nome da conversão" className="col-span-2">
              <input value={f.conversao_nome} onChange={set('conversao_nome')} placeholder="Contatos, Leads, Ligações, Vendas…" className="field" />
            </Field>
          </div>
        </section>
        <section className="grid gap-3 rounded-xl border border-line bg-surface p-4">
          <Field label="O que aconteceu no mês (um por linha)">
            <textarea rows={4} value={f.destaques} onChange={set('destaques')} className="field resize-y text-[13px] leading-relaxed" placeholder="Ex.: Pausamos as palavras que traziam curiosos e o custo por contato caiu." />
          </Field>
          <Field label="Próximos passos (um por linha)">
            <textarea rows={3} value={f.proximos_passos} onChange={set('proximos_passos')} className="field resize-y text-[13px] leading-relaxed" placeholder="Ex.: Testar anúncio com vídeo." />
          </Field>
        </section>
        <div>
          <button type="button" onClick={() => confirm('Apagar este relatório?') && start(() => excluirRelatorio(r.id, r.client_id))} className={btn.ghost}>
            <Trash2 size={14} /> Apagar relatório
          </button>
        </div>
      </div>
      <div className="min-w-0 xl:sticky xl:top-4">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Prévia</p>
        <RelatorioDoc r={{ ...r, ...dados() }} anterior={anterior} cliente={cliente} />
      </div>
    </div>
  );
}

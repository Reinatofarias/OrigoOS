'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, Download, ExternalLink, MessageCircle, Plus, Save, Trash2, X } from 'lucide-react';
import { excluirProposta, marcarPropostaEnviada, salvarProposta, setPropostaStatus } from '@/app/actions';
import type { ItemProposta, Proposal, Service } from '@/lib/db';
import { brl } from '@/lib/format';
import { itemDoServico, totais } from '@/lib/propostas';
import { Field } from './dialog';
import PropostaDoc from './proposta-doc';
import { btn } from './ui';
import { avisar } from './toast';

type Lead = { id: string; nome: string; contato: string | null; cidade: string | null; whatsapp: string | null } | null;

export default function PropostaEditor({ proposta, servicos, lead, link }: { proposta: Proposal; servicos: Service[]; lead: Lead; link: string }) {
  const [titulo, setTitulo] = useState(proposta.titulo);
  const [introducao, setIntroducao] = useState(proposta.introducao ?? '');
  const [itens, setItens] = useState<ItemProposta[]>(proposta.itens ?? []);
  const [desconto, setDesconto] = useState(String(proposta.desconto ?? 0));
  const [validade, setValidade] = useState(proposta.validade ?? '');
  const [condicoes, setCondicoes] = useState(proposta.condicoes ?? '');
  const [sujo, setSujo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [pending, start] = useTransition();

  const mexeu = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setSujo(true);
  };
  const setItem = (n: number, campos: Partial<ItemProposta>) => {
    setItens((xs) => xs.map((x, i) => (i === n ? { ...x, ...campos } : x)));
    setSujo(true);
  };
  const descontoNum = Number(desconto.replace(',', '.')) || 0;
  const t = totais(itens, descontoNum);

  const dados = () => ({ titulo: titulo.trim() || 'Proposta comercial', introducao: introducao.trim() || null, itens, desconto: descontoNum, validade: validade || null, condicoes: condicoes.trim() || null });
  const salvar = () => start(async () => { await salvarProposta(proposta.id, dados()); avisar('Proposta salva'); });

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      prompt('Copie o link da proposta:', link);
    }
  }

  function enviarWhatsApp() {
    const oi = lead?.contato ? `Oi, ${lead.contato.split(' ')[0]}!` : 'Oi!';
    const texto = `${oi} Segue a proposta da Origo pra ${lead?.nome ?? 'vocês'}: ${link}\n\nPor ali dá pra ver tudo e aceitar. Qualquer dúvida, me chama aqui.`;
    window.open(`https://wa.me/${lead?.whatsapp ?? ''}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    start(async () => {
      if (sujo) await salvarProposta(proposta.id, dados());
      await marcarPropostaEnviada(proposta.id);
    });
  }

  const disponiveis = servicos.filter((s) => !itens.some((i) => i.service_id === s.id));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[480px_minmax(0,1fr)]">
      <div className={`grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 ${pending ? 'opacity-70' : ''}`}>
        <section className="grid gap-2 rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={salvar} disabled={pending || !sujo} className={btn.primary}>
              <Save size={15} /> {pending ? 'Salvando…' : sujo ? 'Salvar' : 'Salvo'}
            </button>
            {lead?.whatsapp && (
              <button type="button" onClick={enviarWhatsApp} className={btn.wa}>
                <MessageCircle size={15} /> Enviar no WhatsApp
              </button>
            )}
            <button type="button" onClick={copiar} className={btn.secondary}>
              {copiado ? <Check size={15} /> : <Copy size={15} />} {copiado ? 'Link copiado' : 'Copiar link'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={link} target="_blank" rel="noopener noreferrer" className={btn.ghost}>
              <ExternalLink size={14} /> Ver como o cliente vê
            </a>
            <a href={`${link}?pdf=1`} target="_blank" rel="noopener noreferrer" className={btn.ghost}>
              <Download size={14} /> Baixar PDF
            </a>
          </div>
          {sujo && <p className="text-[12px] text-warn">Tem alteração sem salvar. O link mostra a última versão salva.</p>}
        </section>

        <section className="grid gap-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-[14px] font-semibold">Serviços</h2>
          {itens.map((i, n) => (
            <div key={n} className="grid gap-2 rounded-lg border border-line p-3">
              <div className="flex items-center gap-2">
                <input aria-label="Nome do serviço" value={i.nome} onChange={(e) => setItem(n, { nome: e.target.value })} className="field py-1.5 font-semibold" />
                <button type="button" onClick={() => mexeu(setItens)(itens.filter((_, k) => k !== n))} aria-label="Tirar serviço" className="rounded-md p-1.5 text-faint hover:bg-danger-soft hover:text-danger">
                  <X size={16} />
                </button>
              </div>
              <textarea aria-label="Descrição" rows={2} value={i.descricao ?? ''} onChange={(e) => setItem(n, { descricao: e.target.value || null })} className="field resize-y py-1.5 text-[13px]" />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Valor (R$)">
                  <input inputMode="decimal" value={String(i.valor)} onChange={(e) => setItem(n, { valor: Number(e.target.value.replace(/\./g, '').replace(',', '.')) || 0 })} className="field py-1.5" />
                </Field>
                <Field label="Cobrança">
                  <select value={i.cobranca} onChange={(e) => setItem(n, { cobranca: e.target.value as ItemProposta['cobranca'] })} className="field py-1.5">
                    <option value="mensal">Mensal</option>
                    <option value="unico">Pagamento único</option>
                  </select>
                </Field>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            {disponiveis.length > 0 && (
              <select
                aria-label="Adicionar serviço do catálogo"
                value=""
                onChange={(e) => {
                  const s = servicos.find((x) => x.id === e.target.value);
                  if (s) mexeu(setItens)([...itens, itemDoServico(s)]);
                }}
                className="field w-auto flex-1 py-1.5"
              >
                <option value="">+ Adicionar serviço do catálogo…</option>
                {disponiveis.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} · {brl(s.preco, false)}
                    {s.cobranca === 'mensal' ? '/mês' : ''}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => mexeu(setItens)([...itens, { service_id: null, nome: 'Serviço personalizado', descricao: null, valor: 0, cobranca: 'unico', plataforma: null }])}
              className={btn.secondary}
            >
              <Plus size={14} /> Item livre
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
            <Field label="Desconto na mensalidade (R$)">
              <input inputMode="decimal" value={desconto} onChange={(e) => mexeu(setDesconto)(e.target.value)} className="field py-1.5" />
            </Field>
            <Field label="Válida até">
              <input type="date" value={validade} onChange={(e) => mexeu(setValidade)(e.target.value)} className="field py-1.5" />
            </Field>
          </div>
          <p className="text-[13px]">
            Mensal: <strong>{brl(t.mensalFinal)}</strong>
            {t.unico > 0 && (
              <>
                {' '}
                · Único: <strong>{brl(t.unico)}</strong>
              </>
            )}
          </p>
        </section>

        <section className="grid gap-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-[14px] font-semibold">Texto</h2>
          <Field label="Título">
            <input value={titulo} onChange={(e) => mexeu(setTitulo)(e.target.value)} className="field py-1.5" />
          </Field>
          <Field label="Apresentação">
            <textarea rows={4} value={introducao} onChange={(e) => mexeu(setIntroducao)(e.target.value)} className="field resize-y py-1.5 text-[13px] leading-relaxed" />
          </Field>
          <Field label="Condições (uma por linha)">
            <textarea rows={5} value={condicoes} onChange={(e) => mexeu(setCondicoes)(e.target.value)} className="field resize-y py-1.5 text-[13px] leading-relaxed" />
          </Field>
        </section>

        <section className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-4">
          <span className="mr-auto text-[13px] text-muted">Resposta do cliente</span>
          {proposta.status !== 'aceita' && (
            <button type="button" onClick={() => start(() => setPropostaStatus(proposta.id, 'aceita'))} className={btn.success}>
              Aceita
            </button>
          )}
          {proposta.status !== 'recusada' && (
            <button type="button" onClick={() => start(() => setPropostaStatus(proposta.id, 'recusada'))} className={btn.secondary}>
              Recusada
            </button>
          )}
          <button
            type="button"
            onClick={() => confirm('Apagar esta proposta?') && start(() => excluirProposta(proposta.id, proposta.lead_id))}
            aria-label="Apagar proposta"
            className="rounded-md p-2 text-faint hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 size={16} />
          </button>
        </section>
      </div>

      <div className="min-w-0 xl:sticky xl:top-4">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Prévia</p>
        <div className="origin-top-left">
          <PropostaDoc
            p={{ ...proposta, ...dados() }}
            para={lead?.nome ?? 'Cliente'}
            contato={lead?.contato}
            cidade={lead?.cidade}
          />
        </div>
      </div>
    </div>
  );
}

import type { Client } from '@/lib/db';
import { Field } from './dialog';

// Campos do cadastro do cliente, usados no modal de novo cliente e na aba Dados.
export default function ClientFields({ c }: { c?: Partial<Client> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nome do cliente *" className="sm:col-span-2">
        <input name="nome" required defaultValue={c?.nome} className="field" />
      </Field>
      <Field label="Segmento">
        <input name="segmento" defaultValue={c?.segmento ?? ''} className="field" placeholder="Ex.: Climatização" />
      </Field>
      <Field label="Cidade">
        <input name="cidade" defaultValue={c?.cidade ?? ''} className="field" />
      </Field>
      <Field label="Serviço">
        <select name="plataforma" defaultValue={c?.plataforma ?? 'google'} className="field">
          <option value="google">Google Ads</option>
          <option value="meta">Meta Ads</option>
          <option value="google_meta">Google + Meta</option>
        </select>
      </Field>
      <Field label="Mensalidade (R$)">
        <input name="mensalidade" inputMode="decimal" defaultValue={c?.mensalidade ?? ''} className="field" placeholder="2000" />
      </Field>
      <Field label="Dia do vencimento">
        <input name="dia_vencimento" type="number" min={1} max={28} defaultValue={c?.dia_vencimento ?? 10} className="field" />
      </Field>
      <Field label="Cliente desde">
        <input name="inicio" type="date" defaultValue={c?.inicio ?? ''} className="field" />
      </Field>
      <Field label="Responsável">
        <input name="responsavel" defaultValue={c?.responsavel ?? ''} className="field" />
      </Field>
      <Field label="CPF ou CNPJ">
        <input name="documento" defaultValue={c?.documento ?? ''} className="field" />
      </Field>
      <Field label="WhatsApp ou telefone">
        <input name="telefone" inputMode="tel" defaultValue={c?.telefone ?? ''} className="field" />
      </Field>
      <Field label="E-mail">
        <input name="email" type="email" defaultValue={c?.email ?? ''} className="field" />
      </Field>
      <Field label="Observações" className="sm:col-span-2">
        <textarea name="observacoes" rows={3} defaultValue={c?.observacoes ?? ''} className="field" />
      </Field>
    </div>
  );
}

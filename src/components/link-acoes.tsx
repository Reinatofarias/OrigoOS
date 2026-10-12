'use client';

import { useState } from 'react';
import { Check, Copy, Download, ExternalLink, MessageCircle } from 'lucide-react';
import { btn } from './ui';

// Botões pra mandar um link público (contrato, relatório) pro cliente.
export function LinkAcoes({ link, whatsapp, mensagem, aoEnviar }: { link: string; whatsapp?: string | null; mensagem: string; aoEnviar?: () => void }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      prompt('Copie o link:', link);
    }
  }
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://wa.me/${whatsapp ?? ''}?text=${encodeURIComponent(mensagem)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={aoEnviar}
          className={btn.wa}
        >
          <MessageCircle size={15} /> Enviar no WhatsApp
        </a>
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
    </div>
  );
}

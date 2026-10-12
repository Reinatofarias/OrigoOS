import type { Contract, Contratante, Empresa, ItemProposta } from './db';
import { brl } from './format';
import { totais } from './propostas';

export type Clausula = { titulo: string; paragrafos: string[] };

export const STATUS_CONTRATO: Record<Contract['status'], { label: string; tone: 'warn' | 'success' | 'neutral' }> = {
  aguardando: { label: 'Aguardando assinatura', tone: 'warn' },
  assinado: { label: 'Assinado', tone: 'success' },
  cancelado: { label: 'Cancelado', tone: 'neutral' },
};

const ou = (v: string | undefined | null, vazio = '____________________') => (v && v.trim() ? v.trim() : vazio);

export function formatDoc(v: string | undefined | null) {
  const d = (v ?? '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v ?? '';
}

function tipoDoc(v: string | undefined | null) {
  return (v ?? '').replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF';
}

// Texto do contrato de prestação de serviços da Origo, montado com os dados da proposta aceita.
export function clausulas(
  empresa: Empresa,
  c: { contratante: Contratante; itens: ItemProposta[]; desconto: number; dia_vencimento: number },
): Clausula[] {
  const t = totais(c.itens, c.desconto);
  const k = c.contratante;
  const mensais = c.itens.filter((i) => i.cobranca === 'mensal');
  const unicos = c.itens.filter((i) => i.cobranca === 'unico');
  const contratada = [
    `CONTRATADA: ${empresa.nome}`,
    empresa.documento ? `${tipoDoc(empresa.documento)} nº ${formatDoc(empresa.documento)}` : null,
    empresa.endereco ? `com endereço em ${empresa.endereco}` : null,
    `representada por ${empresa.responsavel}`,
  ]
    .filter(Boolean)
    .join(', ');
  const contratante = [
    `CONTRATANTE: ${ou(k.nome)}`,
    `${tipoDoc(k.documento)} nº ${ou(formatDoc(k.documento))}`,
    `com endereço em ${ou(k.endereco)}`,
    `representada por ${ou(k.representante)}${k.representante_cpf ? `, CPF nº ${formatDoc(k.representante_cpf)}` : ''}`,
  ].join(', ');

  const pagamento: string[] = [];
  if (t.mensal > 0) {
    pagamento.push(
      `Pelos serviços mensais, o CONTRATANTE pagará à CONTRATADA ${brl(t.mensalFinal)} por mês${t.desconto > 0 ? ` (já com desconto de ${brl(t.desconto)})` : ''}, com vencimento todo dia ${c.dia_vencimento}. A primeira mensalidade vence em até 3 dias após a assinatura.`,
    );
  }
  if (t.unico > 0) {
    pagamento.push(`Pelos serviços de pagamento único (${unicos.map((i) => i.nome).join(', ')}), o CONTRATANTE pagará ${brl(t.unico)}, em até 3 dias após a assinatura.`);
  }
  pagamento.push(
    'Os pagamentos serão feitos por Pix, boleto ou cartão, pela fatura enviada pela CONTRATADA. Em caso de atraso, incidem multa de 2% e juros de 1% ao mês sobre o valor devido.',
    'O investimento em anúncios (mídia) não está incluso nos valores acima e é pago pelo CONTRATANTE diretamente às plataformas (Google, Meta e outras).',
  );

  return [
    { titulo: 'Das partes', paragrafos: [contratada + '.', contratante + '.'] },
    {
      titulo: 'Do objeto',
      paragrafos: [
        'Este contrato tem por objeto a prestação dos seguintes serviços de marketing digital pela CONTRATADA:',
        ...[...mensais, ...unicos].map((i) => `• ${i.nome}${i.descricao ? `: ${i.descricao.replace(/\.$/, '')}` : ''} (${i.cobranca === 'mensal' ? `${brl(i.valor)} por mês` : `${brl(i.valor)}, pagamento único`}).`),
      ],
    },
    { titulo: 'Do valor e do pagamento', paragrafos: pagamento },
    {
      titulo: 'Do prazo e da rescisão',
      paragrafos: [
        'Este contrato começa a valer na data da assinatura e tem prazo indeterminado, sem fidelidade.',
        'Qualquer das partes pode encerrá-lo a qualquer momento, avisando a outra por escrito (WhatsApp ou e-mail) com 30 dias de antecedência. A mensalidade do período de aviso é devida.',
        'Valores de pagamento único não são devolvidos depois de iniciada a execução do serviço correspondente.',
      ],
    },
    {
      titulo: 'Das obrigações da CONTRATADA',
      paragrafos: [
        'Executar os serviços com zelo e técnica, criando, acompanhando e otimizando as campanhas de forma contínua.',
        'Enviar relatório mensal de resultados e manter acompanhamento pelo WhatsApp em horário comercial.',
        'Seguir as políticas das plataformas de anúncio e, quando aplicável, as normas de publicidade do conselho profissional do CONTRATANTE.',
      ],
    },
    {
      titulo: 'Das obrigações do CONTRATANTE',
      paragrafos: [
        'Fornecer os acessos, informações e materiais necessários (contas de anúncio, site, perfis, fotos e dados do negócio).',
        'Aprovar ou pedir ajustes nos anúncios em até 2 dias úteis e manter ativa a forma de pagamento das plataformas.',
        'Responder pela veracidade das informações fornecidas e pelo atendimento dos contatos gerados pelas campanhas.',
      ],
    },
    {
      titulo: 'Dos resultados',
      paragrafos: [
        'A CONTRATADA se compromete com a qualidade do trabalho, não com um número garantido de vendas ou contatos, porque os resultados também dependem de fatores fora do seu controle, como mercado, orçamento de mídia, atendimento e regras das plataformas.',
      ],
    },
    {
      titulo: 'Da confidencialidade e dos dados',
      paragrafos: [
        'As partes manterão sigilo sobre as informações a que tiverem acesso e tratarão dados pessoais apenas para a execução deste contrato, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).',
        'As contas de anúncio e os dados das campanhas pertencem ao CONTRATANTE. Ao fim do contrato, a CONTRATADA devolve ou remove os acessos recebidos.',
      ],
    },
    {
      titulo: 'Da assinatura eletrônica',
      paragrafos: [
        'As partes reconhecem a validade da assinatura eletrônica deste contrato, nos termos do art. 10, § 2º, da Medida Provisória 2.200-2/2001, registrada com data, hora, endereço IP e código de verificação do documento.',
      ],
    },
    { titulo: 'Do foro', paragrafos: [`Fica eleito o foro da comarca de ${empresa.cidade || 'Igarassu-PE'} para resolver qualquer questão deste contrato.`] },
  ];
}

export function numeroContrato(n: number) {
  return String(n).padStart(4, '0');
}

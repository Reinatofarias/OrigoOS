import type { Contract, Contratante, Empresa, ItemProposta, ModeloContrato, Rede, TipoContrato } from './db';
import { brl } from './format';
import { totais } from './propostas';

// semNumero: a abertura ("Das partes") não leva número, como no modelo da Origo.
export type Clausula = { titulo: string; paragrafos: string[]; semNumero?: boolean };

export const STATUS_CONTRATO: Record<Contract['status'], { label: string; tone: 'warn' | 'success' | 'neutral' }> = {
  aguardando: { label: 'Aguardando assinatura', tone: 'warn' },
  assinado: { label: 'Assinado', tone: 'success' },
  cancelado: { label: 'Cancelado', tone: 'neutral' },
};

export const TIPOS: Record<TipoContrato, { label: string; titulo: string; subtitulo: string; dica: string }> = {
  trafego: {
    label: 'Tráfego pago',
    titulo: 'Contrato de prestação de serviços de tráfego pago',
    subtitulo: 'Gestão estratégica e operacional de campanhas digitais',
    dica: 'Gestão de campanhas nas redes que você marcar',
  },
  mentoria: {
    label: 'Mentoria',
    titulo: 'Contrato de prestação de serviços de mentoria',
    subtitulo: 'Mentoria estratégica em marketing, posicionamento e vendas',
    dica: 'Encontros, plano de ação e acompanhamento',
  },
  servicos: {
    label: 'Outros serviços',
    titulo: 'Contrato de prestação de serviços de marketing digital',
    subtitulo: 'Serviços estratégicos e operacionais de marketing',
    dica: 'Estratégia, IA, assessoria ou o que você marcar',
  },
};

export const REDES: Record<Rede, string> = {
  meta: 'Meta Ads (Instagram e Facebook)',
  google: 'Google Ads',
  youtube: 'YouTube Ads',
  tiktok: 'TikTok Ads',
  linkedin: 'LinkedIn Ads',
};
const REDE_CURTA: Record<Rede, string> = { meta: 'Meta Ads', google: 'Google Ads', youtube: 'YouTube Ads', tiktok: 'TikTok Ads', linkedin: 'LinkedIn Ads' };

export const VIGENCIAS = [3, 6, 12];

// Contratos antigos (ou vindos de proposta) não têm modelo: deduz pelo que foi contratado.
export function modeloDe(c: Pick<Contract, 'modelo' | 'itens'>): Required<Pick<ModeloContrato, 'tipo' | 'redes' | 'vigencia_meses'>> & ModeloContrato {
  const m = c.modelo ?? {};
  const ps = new Set(c.itens.flatMap((i) => (i.plataforma === 'google_meta' ? ['google', 'meta'] : i.plataforma ? [i.plataforma] : [])) as Rede[]);
  const mentoria = c.itens.length > 0 && c.itens.every((i) => /mentoria/i.test(i.nome));
  return {
    ...m,
    tipo: m.tipo ?? (ps.size ? 'trafego' : mentoria ? 'mentoria' : 'servicos'),
    redes: m.redes?.length ? m.redes : [...ps],
    vigencia_meses: m.vigencia_meses ?? 6,
  };
}

export const tituloContrato = (c: Pick<Contract, 'modelo' | 'itens'>) => TIPOS[modeloDe(c).tipo];

const ou = (v: string | undefined | null, vazio = '____________________') => (v && v.trim() ? v.trim() : vazio);
const caixa = (v: string | undefined | null) => ou(v).toUpperCase();

export function formatDoc(v: string | undefined | null) {
  const d = (v ?? '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v ?? '';
}

// Confere os dígitos verificadores do CPF (pega erro de digitação antes de assinar).
export function cpfValido(v: string) {
  const d = v.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

function tipoDoc(v: string | undefined | null) {
  return (v ?? '').replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF';
}

const EXTENSO: Record<number, string> = {
  1: 'um', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco', 6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez', 11: 'onze', 12: 'doze', 15: 'quinze', 18: 'dezoito', 24: 'vinte e quatro', 30: 'trinta', 36: 'trinta e seis',
};
const ext = (n: number) => (EXTENSO[n] ? `${n} (${EXTENSO[n]})` : String(n));
const meses = (n: number) => `${ext(n)} ${n === 1 ? 'mês' : 'meses'}`;

// "Meta Ads e Google Ads", "Meta Ads, Google Ads e TikTok Ads"
function lista(xs: string[]) {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`;
}

// A empresa do contratante só entra se for diferente da pessoa que assina.
export function temEmpresa(k: Contratante) {
  return !!k.nome?.trim() && k.nome.trim().toLowerCase() !== (k.representante ?? '').trim().toLowerCase();
}

function partes(empresa: Empresa, k: Contratante, titulo: string): Clausula {
  const pessoa = [
    `CONTRATANTE: ${caixa(k.representante || k.nome)}`,
    k.nacionalidade?.trim() || null,
    k.profissao?.trim() || null,
    `inscrito(a) no CPF sob o nº ${ou(formatDoc(k.representante_cpf || (tipoDoc(k.documento) === 'CPF' ? k.documento : '')))}`,
    `residente e domiciliado(a) em ${ou(k.representante_endereco || (temEmpresa(k) ? '' : k.endereco))}`,
  ]
    .filter(Boolean)
    .join(', ');
  const cnpj = tipoDoc(k.documento) === 'CNPJ' ? `, inscrito no CNPJ sob o nº ${formatDoc(k.documento)}` : '';
  const negocio = temEmpresa(k) ? `, responsável pelo estabelecimento comercial ${k.nome!.trim().toUpperCase()}${cnpj}, situado em ${ou(k.endereco)}` : '';
  const contratada = [
    `CONTRATADA: ${empresa.nome.toUpperCase()}`,
    tipoDoc(empresa.documento) === 'CNPJ' || !empresa.documento ? `pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${ou(formatDoc(empresa.documento))}` : `inscrita no CPF sob o nº ${formatDoc(empresa.documento)}`,
    `com sede em ${ou(empresa.endereco)}`,
    `neste ato representada por seu sócio administrador ${empresa.responsavel.toUpperCase()}${empresa.responsavel_cpf ? `, inscrito no CPF sob o nº ${formatDoc(empresa.responsavel_cpf)}` : ''}`,
  ].join(', ');
  return {
    titulo: 'Das partes',
    semNumero: true,
    paragrafos: [
      `${pessoa}${negocio}, doravante denominado(a) CONTRATANTE.`,
      `${contratada}, doravante denominada CONTRATADA.`,
      `As partes resolvem celebrar o presente ${titulo}, que será regido pelas cláusulas e condições seguintes.`,
    ],
  };
}

const servicosContratados = (itens: ItemProposta[]) => itens.map((i) => `• ${i.nome}${i.descricao ? `: ${i.descricao.replace(/\.$/, '')}` : ''};`);

function precoEPagamento(empresa: Empresa, c: { itens: ItemProposta[]; desconto: number; dia_vencimento: number }, m: ModeloContrato, vig: number, tipo: TipoContrato): Clausula {
  const t = totais(c.itens, c.desconto);
  const unicos = c.itens.filter((i) => i.cobranca === 'unico');
  const p: string[] = [];
  const promo = Number(m.promo_valor) > 0 && Number(m.promo_meses) > 0 && Number(m.promo_meses) < vig && t.mensal > 0;
  if (promo) {
    const pm = Number(m.promo_meses);
    p.push(
      `O presente contrato terá vigência de ${meses(vig)}. Durante os ${ext(pm)} primeiros meses, a CONTRATANTE pagará à CONTRATADA o valor promocional mensal de ${brl(Number(m.promo_valor))}, correspondente a uma condição comercial especial concedida para a fase inicial do projeto.`,
      `Após o término dos ${ext(pm)} primeiros meses, o valor mensal dos serviços será revisto com base na evolução, desempenho e complexidade do projeto, considerando, entre outros fatores, o volume de campanhas, as demandas operacionais, os resultados obtidos e a necessidade de ampliação da estratégia. Como referência, o valor mensal regular dos serviços contratados é de ${brl(t.mensalFinal)}.`,
      `O novo valor aplicável aos meses restantes deverá ser previamente apresentado à CONTRATANTE e formalizado mediante acordo entre as partes, por escrito ou por termo aditivo, antes do início do mês seguinte ao período promocional.`,
      'Caso não haja acordo entre as partes acerca do novo valor, qualquer uma delas poderá solicitar a rescisão do contrato, sem aplicação de multa, desde que comunique a outra parte por escrito com antecedência mínima de 15 (quinze) dias.',
    );
  } else if (t.mensal > 0) {
    p.push(
      `Pelos serviços contratados, a CONTRATANTE pagará à CONTRATADA o valor mensal de ${brl(t.mensalFinal)}${t.desconto > 0 ? ` (já com desconto de ${brl(t.desconto)})` : ''}, durante toda a vigência deste contrato.`,
    );
    const mensais = c.itens.filter((i) => i.cobranca === 'mensal');
    if (mensais.length > 1) p.push(...mensais.map((i) => `• ${i.nome}: ${brl(i.valor)} por mês;`));
  }
  if (unicos.length) {
    p.push(`Pelos serviços de pagamento único (${unicos.map((i) => `${i.nome}: ${brl(i.valor)}`).join('; ')}), a CONTRATANTE pagará o total de ${brl(t.unico)}, com vencimento em até 3 (três) dias após a assinatura, salvo parcelamento combinado por escrito entre as partes.`);
  }
  const forma = empresa.pix?.trim() ? `por PIX, utilizando a chave ${empresa.pix.trim()}` : 'por PIX, boleto ou cartão, pela fatura enviada pela CONTRATADA';
  p.push(t.mensal > 0 ? `O pagamento será realizado ${forma}, com vencimento no dia ${c.dia_vencimento} de cada mês.` : `O pagamento será realizado ${forma}.`);
  p.push(
    tipo === 'trafego'
      ? 'O valor previsto nesta cláusula refere-se exclusivamente à prestação dos serviços de gestão e não inclui investimento em mídia, ferramentas de terceiros, produção audiovisual, design, desenvolvimento de páginas, contratação de influenciadores ou quaisquer outras despesas não previstas expressamente neste contrato.'
      : 'O valor previsto nesta cláusula refere-se exclusivamente aos serviços descritos neste contrato e não inclui investimento em mídia, ferramentas de terceiros, produção audiovisual, design, desenvolvimento de páginas ou quaisquer outras despesas não previstas expressamente neste contrato.',
  );
  return { titulo: 'Do preço e da forma de pagamento', paragrafos: p };
}

function finais(empresa: Empresa, vig: number, temMensal: boolean): Clausula[] {
  return [
    {
      titulo: 'Da inadimplência',
      paragrafos: [
        'O atraso superior a 10 (dez) dias poderá ocasionar a suspensão dos serviços, sem responsabilidade da CONTRATADA por eventuais impactos de desempenho.',
        'O atraso superior a 30 (trinta) dias poderá resultar na rescisão do contrato, sem prejuízo da cobrança dos valores vencidos.',
      ],
    },
    {
      titulo: 'Da vigência',
      paragrafos: [
        `O presente contrato terá vigência de ${meses(vig)}, iniciando-se na data de sua assinatura.`,
        ...(vig > 3 ? ['Após o período mínimo de 90 (noventa) dias, o contrato poderá ser rescindido por qualquer das partes, observadas as condições da cláusula seguinte.'] : []),
        'Encerrado o prazo inicial sem manifestação contrária, o contrato poderá ser renovado por acordo entre as partes.',
      ],
    },
    {
      titulo: 'Da rescisão',
      paragrafos: [
        `${vig > 3 ? 'Após o período mínimo de 90 (noventa) dias, qualquer' : 'Qualquer'} das partes poderá rescindir o contrato sem multa, mediante aviso prévio por escrito de 30 (trinta) dias.`,
        temMensal
          ? 'Na hipótese de cancelamento imediato, sem o cumprimento do aviso prévio, será devido o valor correspondente a 1 (uma) mensalidade adicional.'
          : 'Valores de pagamento único não são devolvidos depois de iniciada a execução do serviço correspondente.',
        'O contrato poderá ser rescindido imediatamente em caso de:',
        '• Falta de pagamento;',
        '• Falta reiterada de colaboração ou fornecimento de informações essenciais;',
        '• Violação de confidencialidade;',
        '• Prática de ato ilícito ou violação das políticas das plataformas;',
        '• Descumprimento relevante das obrigações previstas neste instrumento.',
      ],
    },
    {
      titulo: 'Da confidencialidade',
      paragrafos: [
        'As partes se comprometem a manter sigilo sobre informações comerciais, estratégicas, financeiras, técnicas, credenciais, dados de clientes e demais informações não públicas acessadas em razão deste contrato.',
        'A obrigação de confidencialidade permanecerá válida por 5 (cinco) anos após o encerramento do contrato.',
        'A violação comprovada desta cláusula sujeitará a parte infratora ao pagamento de multa de R$ 30.000,00 (trinta mil reais), sem prejuízo da apuração de perdas e danos adicionais.',
      ],
    },
    {
      titulo: 'Da proteção de dados',
      paragrafos: [
        'As partes declaram que tratarão dados pessoais em conformidade com a Lei nº 13.709/2018 - Lei Geral de Proteção de Dados Pessoais (LGPD), utilizando-os somente para as finalidades necessárias à execução deste contrato.',
        'Cada parte será responsável pelos dados e operações de tratamento realizados sob sua gestão, adotando medidas razoáveis de segurança e confidencialidade.',
      ],
    },
    {
      titulo: 'Das disposições gerais',
      paragrafos: [
        '• Este contrato não estabelece vínculo empregatício, societário, representação comercial, exclusividade ou subordinação entre as partes;',
        '• Qualquer alteração do escopo, preço ou condições deverá ser formalizada por escrito, inclusive por aditivo contratual;',
        '• Cada parte será responsável por suas obrigações fiscais, trabalhistas e tributárias;',
        '• A eventual tolerância de uma parte quanto ao descumprimento de obrigação não implicará renúncia de direito ou alteração contratual;',
        '• Comunicações e aprovações realizadas por e-mail ou WhatsApp poderão ser utilizadas como registro da execução dos serviços.',
      ],
    },
    {
      titulo: 'Da assinatura eletrônica',
      paragrafos: [
        'As partes reconhecem a validade da assinatura eletrônica deste contrato, nos termos da Lei nº 14.063/2020 e do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001. O envio do formulário de dados pela CONTRATANTE, com a confirmação de leitura e concordância, vale como sua assinatura e fica registrado com data, hora, endereço IP e código de verificação do documento.',
      ],
    },
    {
      titulo: 'Do foro',
      paragrafos: [
        `Fica eleito o foro da Comarca de ${(empresa.cidade || 'Igarassu/PE').replace('-', '/')} para dirimir quaisquer controvérsias decorrentes deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.`,
        'E, por estarem de acordo, as partes assinam o presente instrumento eletronicamente.',
      ],
    },
  ];
}

function trafego(c: { itens: ItemProposta[] }, redes: Rede[]): Clausula[] {
  const nomes = redes.map((r) => REDE_CURTA[r]);
  const plataformas = nomes.length ? lista(nomes) : 'Meta Ads e/ou Google Ads';
  const extras = c.itens.filter((i) => !i.plataforma && !/tr[aá]fego/i.test(i.nome));
  return [
    {
      titulo: 'Do objeto',
      paragrafos: [
        `O presente contrato tem por objeto a prestação de serviços de gestão de tráfego pago em plataformas digitais, especialmente ${plataformas}, de acordo com a estratégia aprovada entre as partes, incluindo:`,
        '• Planejamento estratégico das campanhas;',
        '• Criação, configuração e gerenciamento das campanhas;',
        '• Definição de público-alvo, segmentação e posicionamento;',
        '• Desenvolvimento de copies e direcionamentos para criativos, quando aplicável;',
        '• Otimização contínua com base em dados e desempenho;',
        '• Análise de métricas, conversões e oportunidades de melhoria;',
        '• Estruturação de jornadas e funis de aquisição de clientes;',
        '• Apresentação de relatórios periódicos de desempenho.',
        ...(extras.length ? ['Também fazem parte deste contrato os seguintes serviços:', ...servicosContratados(extras)] : []),
        'A atuação da CONTRATADA será estratégica e operacional, com foco na geração de tráfego qualificado, alcance, contatos e oportunidades comerciais, sem promessa ou garantia de resultado financeiro específico.',
      ],
    },
    {
      titulo: 'Das plataformas e do investimento em mídia',
      paragrafos: [
        `Os serviços serão executados nas plataformas definidas no planejamento estratégico, podendo incluir ${plataformas}.`,
        'Todo valor destinado ao investimento em anúncios, impulsionamentos ou mídia será de responsabilidade exclusiva da CONTRATANTE e não está incluído na remuneração da CONTRATADA.',
        'As contas de anúncios deverão, preferencialmente, ser de titularidade da CONTRATANTE, que permanecerá proprietária dos seus ativos, históricos e dados.',
      ],
    },
    {
      titulo: 'Das obrigações da CONTRATANTE',
      paragrafos: [
        'A CONTRATANTE se compromete a:',
        '• Fornecer os acessos necessários às contas, páginas, perfis, sites e ferramentas;',
        '• Disponibilizar informações, materiais, ofertas, preços, imagens e aprovações em tempo hábil;',
        '• Manter meios de pagamento válidos nas plataformas de anúncios;',
        '• Participar das reuniões estratégicas quando necessário;',
        '• Garantir que seus produtos, serviços, atendimento e condições comerciais estejam aptos à conversão;',
        '• Responder pelos conteúdos, alegações, promoções, preços e condições divulgados em seu negócio;',
        '• Realizar o atendimento dos leads e clientes gerados pelas campanhas com agilidade e qualidade.',
        'A CONTRATANTE reconhece que o desempenho das campanhas depende de fatores externos à gestão de mídia, incluindo qualidade da oferta, reputação, atendimento comercial, processo de vendas, disponibilidade de produtos, orçamento e condições de mercado.',
      ],
    },
    {
      titulo: 'Das obrigações da CONTRATADA',
      paragrafos: [
        'A CONTRATADA se compromete a:',
        '• Planejar, executar, acompanhar e otimizar as campanhas com base em boas práticas;',
        '• Monitorar indicadores e realizar ajustes compatíveis com o orçamento e os dados disponíveis;',
        '• Prestar suporte estratégico durante a vigência contratual;',
        '• Apresentar relatórios periódicos de desempenho;',
        '• Atuar em conformidade com as políticas das plataformas de anúncios;',
        '• Comunicar à CONTRATANTE impedimentos técnicos, bloqueios ou riscos relevantes identificados.',
        'A CONTRATADA não garante faturamento, quantidade mínima de contatos, vendas, lucro, retorno sobre investimento ou qualquer resultado específico, por depender de fatores alheios ao seu controle.',
      ],
    },
    direitos('as contas, campanhas e dados vinculados ao seu negócio'),
  ];
}

function direitos(acesso: string): Clausula {
  return {
    titulo: 'Dos direitos das partes',
    paragrafos: [
      'São direitos da CONTRATANTE:',
      '• Solicitar esclarecimentos e ajustes estratégicos compatíveis com o escopo contratado;',
      '• Acompanhar os resultados, relatórios e principais indicadores;',
      `• Ter acesso às ${acesso}.`,
      'São direitos da CONTRATADA:',
      '• Sugerir alterações em ofertas, criativos, páginas, atendimento e processo comercial;',
      '• Recusar solicitações que violem políticas das plataformas, legislação ou boas práticas;',
      '• Utilizar resultados gerais como portfólio, desde que não exponha dados pessoais, estratégicos ou sensíveis da CONTRATANTE.',
    ],
  };
}

function mentoria(c: { itens: ItemProposta[] }): Clausula[] {
  const extras = c.itens.filter((i) => !/mentoria/i.test(i.nome));
  return [
    {
      titulo: 'Do objeto',
      paragrafos: [
        'O presente contrato tem por objeto a prestação de serviços de mentoria individual em marketing, posicionamento e vendas, no formato combinado entre as partes, incluindo:',
        '• Diagnóstico inicial do negócio e definição de objetivos;',
        '• Encontros de mentoria, online ou presenciais, com orientação estratégica;',
        '• Plano de ação com prioridades e tarefas entre os encontros;',
        '• Acompanhamento e esclarecimento de dúvidas pelos canais combinados;',
        '• Revisão periódica de indicadores e ajustes no plano.',
        ...(extras.length ? ['Também fazem parte deste contrato os seguintes serviços:', ...servicosContratados(extras)] : []),
        'A mentoria tem caráter orientativo: a CONTRATADA transmite conhecimento, método e direcionamento, cabendo à CONTRATANTE a execução das ações e as decisões do seu negócio, sem promessa ou garantia de resultado financeiro específico.',
      ],
    },
    {
      titulo: 'Dos encontros e materiais',
      paragrafos: [
        'Os encontros serão agendados previamente entre as partes. Remarcações devem ser pedidas com pelo menos 24 (vinte e quatro) horas de antecedência; a ausência sem aviso conta como encontro realizado.',
        'Materiais, gravações e documentos entregues durante a mentoria são de uso exclusivo da CONTRATANTE, sendo vedada sua reprodução ou distribuição a terceiros.',
      ],
    },
    {
      titulo: 'Das obrigações da CONTRATANTE',
      paragrafos: [
        'A CONTRATANTE se compromete a:',
        '• Participar dos encontros com pontualidade e preparo;',
        '• Executar as tarefas e ações combinadas entre os encontros;',
        '• Fornecer as informações do negócio necessárias à mentoria, com veracidade;',
        '• Responder pelas decisões e pelos resultados das ações executadas em seu negócio.',
      ],
    },
    {
      titulo: 'Das obrigações da CONTRATADA',
      paragrafos: [
        'A CONTRATADA se compromete a:',
        '• Preparar e conduzir os encontros com base em boas práticas e na realidade do negócio;',
        '• Entregar e atualizar o plano de ação;',
        '• Esclarecer dúvidas pelos canais combinados, em horário comercial;',
        '• Comunicar à CONTRATANTE riscos relevantes identificados.',
        'A CONTRATADA não garante faturamento, vendas, lucro ou qualquer resultado específico, por depender de fatores alheios ao seu controle.',
      ],
    },
  ];
}

function servicos(c: { itens: ItemProposta[] }): Clausula[] {
  return [
    {
      titulo: 'Do objeto',
      paragrafos: [
        'O presente contrato tem por objeto a prestação dos seguintes serviços pela CONTRATADA, de acordo com o escopo aprovado entre as partes:',
        ...servicosContratados(c.itens),
        'A atuação da CONTRATADA será estratégica e operacional, sem promessa ou garantia de resultado financeiro específico.',
      ],
    },
    {
      titulo: 'Da execução',
      paragrafos: [
        'Os serviços serão executados conforme o cronograma e o escopo combinados entre as partes. Demandas fora do escopo serão orçadas à parte.',
        'Ferramentas, licenças, mídia e custos de terceiros necessários à execução são de responsabilidade da CONTRATANTE, salvo acordo em contrário por escrito.',
      ],
    },
    {
      titulo: 'Das obrigações da CONTRATANTE',
      paragrafos: [
        'A CONTRATANTE se compromete a:',
        '• Fornecer os acessos, informações e materiais necessários em tempo hábil;',
        '• Participar das reuniões e aprovações quando necessário;',
        '• Responder pelos conteúdos, ofertas e condições comerciais do seu negócio.',
      ],
    },
    {
      titulo: 'Das obrigações da CONTRATADA',
      paragrafos: [
        'A CONTRATADA se compromete a:',
        '• Executar os serviços com zelo e técnica, com base em boas práticas;',
        '• Prestar suporte estratégico durante a vigência contratual;',
        '• Comunicar à CONTRATANTE impedimentos técnicos ou riscos relevantes identificados.',
        'A CONTRATADA não garante faturamento, vendas, lucro ou qualquer resultado específico, por depender de fatores alheios ao seu controle.',
      ],
    },
    direitos('entregas, acessos e dados vinculados ao seu negócio'),
  ];
}

// Texto do contrato, montado a partir do modelo da Origo, do tipo escolhido e dos dados do cliente.
export function clausulas(
  empresa: Empresa,
  c: { contratante: Contratante; itens: ItemProposta[]; desconto: number; dia_vencimento: number; modelo?: ModeloContrato | null },
): Clausula[] {
  const m = modeloDe({ modelo: c.modelo ?? null, itens: c.itens });
  const corpo = m.tipo === 'trafego' ? trafego(c, m.redes) : m.tipo === 'mentoria' ? mentoria(c) : servicos(c);
  return [
    partes(empresa, c.contratante, TIPOS[m.tipo].titulo),
    ...corpo,
    precoEPagamento(empresa, c, m, m.vigencia_meses, m.tipo),
    ...finais(empresa, m.vigencia_meses, totais(c.itens, c.desconto).mensal > 0),
  ];
}

export function numeroContrato(n: number) {
  return String(n).padStart(4, '0');
}

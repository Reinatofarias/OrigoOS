import type { Lead, LeadStatus } from './db';

export const NICHO: Record<Lead['nicho'], string> = {
  clima: 'Climatização',
  adv: 'Advocacia',
  odonto: 'Odontologia',
  outro: 'Outro',
};

const CASE: Record<Lead['nicho'], string> = {
  clima: 'Hoje cuido do Google da Invertech, em Palmas, que é do mesmo ramo.',
  adv: 'Hoje atendo a Dra. Josimara Lima, advogada previdenciária em Araripina, sempre dentro das regras da OAB (Provimento 205/2021).',
  odonto: 'Gestão de anúncios no Google e no Instagram é o que eu faço, e sou aqui da região, de Igarassu.',
  outro: 'Gestão de tráfego pago é o que eu faço todos os dias.',
};

const BUSCA: Record<Lead['nicho'], string> = {
  clima: 'instalação de ar-condicionado',
  adv: 'advogado INSS',
  odonto: 'implante dentário',
  outro: 'o seu serviço',
};

export type Passo = 'm1' | 'm2' | 'm3' | 'm4';

export const PASSOS: { passo: Passo; titulo: string; quando: string }[] = [
  { passo: 'm1', titulo: 'M1', quando: 'Primeiro contato' },
  { passo: 'm2', titulo: 'M2', quando: '2 dias depois: vídeo-diagnóstico' },
  { passo: 'm3', titulo: 'M3', quando: '3 dias depois: case' },
  { passo: 'm4', titulo: 'M4', quando: '5 dias depois: despedida' },
];

export type Modelos = Record<Passo, string>;

// Textos padrão. Em Configurações > Mensagens dá pra mudar; as chaves entre {} viram os dados do lead.
export const MODELOS_PADRAO: Modelos = {
  m1: 'Oi, {trato}? Aqui é o Renato, da Origo. Pesquisei "{busca}" no Google agora e vi uma oportunidade clara pra {nome} aparecer pra quem está procurando esse serviço hoje. {case} Posso te mandar um vídeo rápido, de 1 minuto, mostrando o que eu vi?',
  m2: 'Gravei esse vídeo pra {nome}: [cole o link do vídeo]. Em 1 minuto mostro quem aparece quando alguém pesquisa "{busca}" e o que eu faria no lugar de vocês. Faz sentido a gente conversar 20 minutos essa semana?',
  m3: 'Só pra você ter uma ideia do que é possível: [resultado real, ex.: "a Invertech recebe X pedidos de orçamento por mês pelo Google"]. Quer que eu te mostre como eu montaria isso pra {nome}?',
  m4: 'Não quero ser chato, então essa é minha última mensagem. Se em algum momento fizer sentido trazer mais clientes pelo Google pra {nome}, é só me chamar aqui. Sucesso pra vocês!',
};

export const CHAVES_MENSAGEM: { chave: string; o_que: string }[] = [
  { chave: '{nome}', o_que: 'nome da empresa' },
  { chave: '{contato}', o_que: 'nome de quem atende (ou "tudo bem")' },
  { chave: '{cidade}', o_que: 'cidade' },
  { chave: '{busca}', o_que: 'o que o cliente dele pesquisa + cidade' },
  { chave: '{case}', o_que: 'frase do case do mesmo ramo' },
  { chave: '{trato}', o_que: '"Dr(a)., tudo bem" na advocacia, "tudo bem" no resto' },
];

export function mensagem(passo: Passo, lead: Pick<Lead, 'nome' | 'cidade' | 'nicho'> & { contato?: string | null }, modelos?: Partial<Modelos> | null) {
  const valores: Record<string, string> = {
    nome: lead.nome,
    contato: lead.contato?.trim().split(/\s+/)[0] || 'tudo bem',
    cidade: lead.cidade ?? '',
    busca: `${BUSCA[lead.nicho]} ${lead.cidade ?? ''}`.trim(),
    case: CASE[lead.nicho],
    trato: lead.nicho === 'adv' ? 'Dr(a)., tudo bem' : 'tudo bem',
  };
  const modelo = modelos?.[passo]?.trim() || MODELOS_PADRAO[passo];
  return modelo.replace(/\{(\w+)\}/g, (m, k: string) => valores[k] ?? m).replace(/ {2,}/g, ' ');
}

// Qual mensagem mandar agora, conforme o status.
export function proximoPasso(status: LeadStatus): Passo | null {
  return ({ novo: 'm1', m1: 'm2', m2: 'm3', m3: 'm4' } as Partial<Record<LeadStatus, Passo>>)[status] ?? null;
}

// Dias até o próximo toque depois de mandar cada mensagem.
export const ESPERA: Record<Passo, number | null> = { m1: 2, m2: 3, m3: 5, m4: null };

export const COLUNAS: { status: LeadStatus; titulo: string }[] = [
  { status: 'novo', titulo: 'Novos' },
  { status: 'm1', titulo: 'M1 enviada' },
  { status: 'm2', titulo: 'M2 enviada' },
  { status: 'm3', titulo: 'M3 enviada' },
  { status: 'm4', titulo: 'M4 enviada' },
  { status: 'respondeu', titulo: 'Respondeu' },
  { status: 'call', titulo: 'Call marcada' },
  { status: 'proposta', titulo: 'Proposta enviada' },
  { status: 'fechou', titulo: 'Ganho' },
  { status: 'perdido', titulo: 'Perdido' },
];

// Etapas do funil comercial (colunas do quadro). A cadência M1 a M4 fica toda numa etapa só.
export type Etapa = { id: string; titulo: string; status: LeadStatus[]; destino: LeadStatus; cor: string };

export const ETAPAS: Etapa[] = [
  { id: 'novo', titulo: 'Novos leads', status: ['novo'], destino: 'novo', cor: '#9a9cb5' },
  { id: 'cadencia', titulo: 'Em cadência', status: ['m1', 'm2', 'm3', 'm4'], destino: 'm1', cor: '#1aa7e8' },
  { id: 'respondeu', titulo: 'Respondeu', status: ['respondeu'], destino: 'respondeu', cor: '#3a6bff' },
  { id: 'call', titulo: 'Call marcada', status: ['call'], destino: 'call', cor: '#6a4cff' },
  { id: 'proposta', titulo: 'Proposta', status: ['proposta'], destino: 'proposta', cor: '#a23cff' },
  { id: 'fechou', titulo: 'Ganho', status: ['fechou'], destino: 'fechou', cor: '#0f9a64' },
];

export function etapaDe(status: LeadStatus) {
  return ETAPAS.find((e) => e.status.includes(status));
}

export function formatWhatsapp(numero: string) {
  const d = numero.slice(2, 4);
  const n = numero.slice(4);
  return `(${d}) ${n.slice(0, n.length - 4)}-${n.slice(-4)}`;
}

// Aceita "(81) 99999-9999", "81999999999" ou "+55 81 ..." e devolve só dígitos com 55 na frente.
export function normalizeWhatsapp(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  return digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`;
}

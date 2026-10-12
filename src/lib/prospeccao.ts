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

export function mensagem(passo: Passo, lead: Pick<Lead, 'nome' | 'cidade' | 'nicho'>) {
  const trato = lead.nicho === 'adv' ? 'Dr(a)., tudo bem' : 'tudo bem';
  const busca = `${BUSCA[lead.nicho]} ${lead.cidade ?? ''}`.trim();
  switch (passo) {
    case 'm1':
      return `Oi, ${trato}? Aqui é o Renato, da Origo. Pesquisei "${busca}" no Google agora e vi uma oportunidade clara pra ${lead.nome} aparecer pra quem está procurando esse serviço hoje. ${CASE[lead.nicho]} Posso te mandar um vídeo rápido, de 1 minuto, mostrando o que eu vi?`;
    case 'm2':
      return `Gravei esse vídeo pra ${lead.nome}: [cole o link do vídeo]. Em 1 minuto mostro quem aparece quando alguém pesquisa "${busca}" e o que eu faria no lugar de vocês. Faz sentido a gente conversar 20 minutos essa semana?`;
    case 'm3':
      return `Só pra você ter uma ideia do que é possível: [resultado real, ex.: "a Invertech recebe X pedidos de orçamento por mês pelo Google"]. Quer que eu te mostre como eu montaria isso pra ${lead.nome}?`;
    case 'm4':
      return `Não quero ser chato, então essa é minha última mensagem. Se em algum momento fizer sentido trazer mais clientes pelo Google pra ${lead.nome}, é só me chamar aqui. Sucesso pra vocês!`;
  }
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
  { status: 'fechou', titulo: 'Fechou' },
  { status: 'perdido', titulo: 'Sem interesse' },
];

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

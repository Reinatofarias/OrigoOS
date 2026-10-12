// O que todo cliente novo precisa mandar. Vira a lista "O que preciso de você" no portal.
export const PEDIDOS_PADRAO: { titulo: string; descricao: string }[] = [
  { titulo: 'Acesso à conta do Google Ads', descricao: 'Em Google Ads > Administrador > Acesso e segurança, convide o e-mail do Renato como Administrador.' },
  { titulo: 'Acesso ao Gerenciador de Negócios da Meta', descricao: 'Em business.facebook.com > Configurações > Parceiros, adicione a Origo Company como parceira da conta de anúncios, da página e do Instagram.' },
  { titulo: 'Acesso ao Perfil da Empresa no Google (Maps)', descricao: 'No perfil da empresa, em Pessoas e acesso, adicione o e-mail do Renato como Administrador.' },
  { titulo: 'Logo em boa qualidade', descricao: 'De preferência em PNG com fundo transparente ou o arquivo original.' },
  { titulo: 'Fotos e vídeos do negócio', descricao: 'Fachada, equipe, serviço sendo feito, antes e depois. Pode mandar o link de uma pasta do Google Drive.' },
  { titulo: 'Principais serviços e diferenciais', descricao: 'Os serviços que mais dão lucro, a região que atende e o que faz vocês diferentes da concorrência.' },
];

export const STATUS_PEDIDO = {
  pendente: { label: 'Pendente', tone: 'warn' },
  enviado: { label: 'Cliente enviou', tone: 'info' },
  ok: { label: 'Concluído', tone: 'success' },
} as const;

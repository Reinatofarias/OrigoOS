-- Origo OS v1: tarefas, clientes, rotina de tráfego e funil de prospecção.
-- O app acessa o banco só pelo servidor, com a service role. RLS fica ligado e sem políticas,
-- então a chave pública (anon) não lê nem escreve nada.

create extension if not exists pgcrypto;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  segmento text,
  cidade text,
  plataforma text not null check (plataforma in ('google', 'meta', 'google_meta')),
  mensalidade numeric(10,2),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  data date,
  client_id uuid references clients(id) on delete set null,
  feita boolean not null default false,
  feita_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tasks_aberta_idx on tasks (feita, data);

create table if not exists routine_checks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  tipo text not null,
  data date not null,
  created_at timestamptz not null default now(),
  unique (client_id, tipo, data)
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text,
  nicho text not null check (nicho in ('clima', 'adv', 'odonto', 'outro')),
  endereco text,
  whatsapp text,
  whatsapp_confirmado boolean not null default false,
  instagram text,
  status text not null default 'novo'
    check (status in ('novo', 'm1', 'm2', 'm3', 'm4', 'respondeu', 'call', 'fechou', 'perdido')),
  proxima_acao date,
  ordem int not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_status_idx on leads (status, proxima_acao);

alter table clients enable row level security;
alter table tasks enable row level security;
alter table routine_checks enable row level security;
alter table leads enable row level security;

-- Origo OS v2: tarefas estilo lista (status, prioridade, descrição), funil comercial com valor,
-- cadastro completo de clientes, cobranças e despesas. Só acrescenta; não apaga nada da v1.

-- Tarefas
alter table tasks add column if not exists status text not null default 'todo';
alter table tasks add column if not exists prioridade text not null default 'normal';
alter table tasks add column if not exists descricao text;
update tasks set status = 'done' where feita and status <> 'done';
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check check (status in ('todo', 'doing', 'done'));
alter table tasks drop constraint if exists tasks_prioridade_check;
alter table tasks add constraint tasks_prioridade_check check (prioridade in ('urgente', 'alta', 'normal', 'baixa'));

-- Funil comercial
alter table leads add column if not exists valor numeric(10,2) not null default 2000;
alter table leads add column if not exists contato text;
alter table leads add column if not exists client_id uuid references clients(id) on delete set null;
alter table leads drop constraint if exists leads_status_check;
alter table leads add constraint leads_status_check
  check (status in ('novo', 'm1', 'm2', 'm3', 'm4', 'respondeu', 'call', 'proposta', 'fechou', 'perdido'));

-- Clientes
alter table clients add column if not exists responsavel text;
alter table clients add column if not exists email text;
alter table clients add column if not exists telefone text;
alter table clients add column if not exists documento text;
alter table clients add column if not exists dia_vencimento int not null default 10;
alter table clients add column if not exists inicio date;
alter table clients add column if not exists observacoes text;

-- Cobranças (uma por cliente por mês quando é mensalidade)
create table if not exists charges (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  descricao text not null,
  valor numeric(10,2) not null,
  vencimento date not null,
  competencia text,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  pago_em date,
  forma text check (forma in ('pix', 'boleto', 'transferencia', 'cartao', 'dinheiro')),
  created_at timestamptz not null default now(),
  unique (client_id, competencia)
);
create index if not exists charges_venc_idx on charges (vencimento, status);

-- Despesas da agência
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  categoria text not null default 'outros',
  valor numeric(10,2) not null,
  data date not null,
  pago boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists expenses_data_idx on expenses (data);

alter table charges enable row level security;
alter table expenses enable row level security;

-- Origo OS v3: serviços e propostas, onboarding e tarefas recorrentes, cobrança pelo Asaas e metas.
-- Só acrescenta; não apaga nada da v2. Pode rodar mais de uma vez.

-- Catálogo de serviços (a tabela de preços da Origo)
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  preco numeric(10,2) not null default 0,
  cobranca text not null default 'mensal' check (cobranca in ('mensal', 'unico')),
  plataforma text check (plataforma in ('google', 'meta', 'google_meta')),
  ativo boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

insert into services (ordem, nome, descricao, preco, cobranca, plataforma)
select * from (values
  (1, 'Gestão de tráfego: Google Ads', 'Criação, gestão e otimização semanal das campanhas no Google (Pesquisa, Maps e Performance Max), com relatório mensal.', 2000, 'mensal', 'google'),
  (2, 'Gestão de tráfego: Meta Ads', 'Campanhas no Instagram e no Facebook, com gestão de públicos, testes de criativos e relatório mensal.', 2000, 'mensal', 'meta'),
  (3, 'Gestão de tráfego: Google + Meta', 'Google Ads e Meta Ads trabalhando juntos: quem pesquisa e quem ainda não conhece a sua empresa.', 3000, 'mensal', 'google_meta'),
  (4, 'Estratégia digital', 'Diagnóstico do negócio, posicionamento, funil de vendas e plano de ação de 90 dias.', 5000, 'unico', null),
  (5, 'Implementação de IA', 'Atendimento e processos com inteligência artificial: agente no WhatsApp, automações e treinamento da equipe.', 7000, 'unico', null),
  (6, 'Assessoria completa', 'Tráfego, estratégia, acompanhamento comercial e reuniões quinzenais de resultado.', 9000, 'mensal', 'google_meta'),
  (7, 'Mentoria', 'Mentoria individual em marketing e vendas, com encontros semanais.', 10000, 'unico', null)
) as v(ordem, nome, descricao, preco, cobranca, plataforma)
where not exists (select 1 from services);

-- Propostas comerciais (o cliente abre pelo link /p/<token>)
create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  numero int generated by default as identity,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  lead_id uuid references leads(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  titulo text not null default 'Proposta comercial',
  introducao text,
  itens jsonb not null default '[]',
  desconto numeric(10,2) not null default 0,
  validade date,
  condicoes text,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviada', 'aceita', 'recusada')),
  aceita_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists proposals_lead_idx on proposals (lead_id);

-- Modelos de tarefa: onboarding de cliente novo e rotina recorrente por cliente
create table if not exists task_templates (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('onboarding', 'recorrente')),
  titulo text not null,
  descricao text,
  prioridade text not null default 'normal' check (prioridade in ('urgente', 'alta', 'normal', 'baixa')),
  dias int not null default 0,
  frequencia text not null default 'semanal' check (frequencia in ('semanal', 'mensal')),
  dia_semana int check (dia_semana between 0 and 6),
  dia_mes int check (dia_mes between 1 and 28),
  plataforma text not null default 'todas' check (plataforma in ('todas', 'google', 'meta')),
  ativo boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

insert into task_templates (tipo, ordem, titulo, dias, prioridade, plataforma)
select * from (values
  ('onboarding', 1, 'Reunião de briefing e metas com o cliente', 0, 'alta', 'todas'),
  ('onboarding', 2, 'Receber acessos (contas de anúncio, Analytics, site e Perfil da Empresa)', 1, 'alta', 'todas'),
  ('onboarding', 3, 'Configurar conversões: tag do Google e GA4', 2, 'alta', 'google'),
  ('onboarding', 4, 'Configurar pixel e API de conversões da Meta', 2, 'alta', 'meta'),
  ('onboarding', 5, 'Pesquisa de palavras-chave, concorrentes e públicos', 3, 'normal', 'todas'),
  ('onboarding', 6, 'Criar anúncios e criativos e mandar pra aprovação', 5, 'normal', 'todas'),
  ('onboarding', 7, 'Publicar as primeiras campanhas', 7, 'urgente', 'todas'),
  ('onboarding', 8, 'Primeira otimização e checagem das conversões', 10, 'normal', 'todas'),
  ('onboarding', 9, 'Relatório de 15 dias e reunião de resultado', 15, 'alta', 'todas')
) as v(tipo, ordem, titulo, dias, prioridade, plataforma)
where not exists (select 1 from task_templates where tipo = 'onboarding');

insert into task_templates (tipo, ordem, titulo, frequencia, dia_semana, dia_mes, prioridade)
select * from (values
  ('recorrente', 1, 'Feedback semanal pro cliente', 'semanal', 1, null, 'normal'),
  ('recorrente', 2, 'Otimização 1', 'semanal', 2, null, 'normal'),
  ('recorrente', 3, 'Otimização 2 e criativos', 'semanal', 4, null, 'normal'),
  ('recorrente', 4, 'Fechamento da semana', 'semanal', 5, null, 'normal'),
  ('recorrente', 5, 'Relatório mensal', 'mensal', null, 5, 'alta')
) as v(tipo, ordem, titulo, frequencia, dia_semana, dia_mes, prioridade)
where not exists (select 1 from task_templates where tipo = 'recorrente');

-- De onde veio cada tarefa, e o registro de tarefas já geradas (apagar uma não faz ela voltar)
alter table tasks add column if not exists origem text not null default 'manual';
alter table tasks add column if not exists template_id uuid references task_templates(id) on delete set null;
alter table tasks drop constraint if exists tasks_origem_check;
alter table tasks add constraint tasks_origem_check check (origem in ('manual', 'onboarding', 'recorrente'));

create table if not exists task_runs (
  template_id uuid not null references task_templates(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  data date not null,
  primary key (template_id, client_id, data)
);

-- Clientes: serviços contratados, rotina ligada e cadastro no Asaas
alter table clients add column if not exists servicos jsonb not null default '[]';
alter table clients add column if not exists recorrentes boolean not null default true;
alter table clients add column if not exists asaas_customer_id text;

-- Cobranças emitidas no Asaas
alter table charges add column if not exists asaas_id text unique;
alter table charges add column if not exists asaas_url text;
alter table charges add column if not exists asaas_status text;

-- Configurações gerais (metas)
create table if not exists settings (
  chave text primary key,
  valor jsonb not null,
  updated_at timestamptz not null default now()
);
insert into settings (chave, valor)
values ('metas', '{"clientes": 15, "receita": 30000, "custo_contratacao": 3000, "prazo": null}')
on conflict (chave) do nothing;

alter table services enable row level security;
alter table proposals enable row level security;
alter table task_templates enable row level security;
alter table task_runs enable row level security;
alter table settings enable row level security;

-- Origo OS v4: contrato com assinatura pelo link, relatório mensal do cliente e lembrete no celular.
-- Só acrescenta; não apaga nada da v3. Pode rodar mais de uma vez.

alter table clients add column if not exists endereco text;

-- Contratos: nascem quando a proposta é aceita; o cliente assina pelo link /c/<token>
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  numero int generated by default as identity,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  proposal_id uuid references proposals(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  contratante jsonb not null default '{}',
  itens jsonb not null default '[]',
  desconto numeric(10,2) not null default 0,
  dia_vencimento int not null default 10,
  status text not null default 'aguardando' check (status in ('aguardando', 'assinado', 'cancelado')),
  conteudo text,
  hash text,
  assinado_em timestamptz,
  assinado_nome text,
  assinado_documento text,
  assinado_ip text,
  assinado_navegador text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contracts_proposal_idx on contracts (proposal_id);
create index if not exists contracts_client_idx on contracts (client_id);

-- Relatório mensal de resultados (o cliente abre pelo link /r/<token>)
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  client_id uuid not null references clients(id) on delete cascade,
  competencia text not null,
  investimento numeric(12,2),
  impressoes int,
  cliques int,
  conversoes int,
  conversao_nome text not null default 'Contatos',
  destaques text,
  proximos_passos text,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, competencia)
);

-- Celulares que recebem o lembrete das 7h51
create table if not exists push_subscriptions (
  endpoint text primary key,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

-- Dados da Origo que vão no contrato
insert into settings (chave, valor)
values ('empresa', '{"nome": "Origo Company", "responsavel": "Renato Farias", "documento": "", "endereco": "", "cidade": "Igarassu-PE", "email": ""}')
on conflict (chave) do nothing;

alter table contracts enable row level security;
alter table reports enable row level security;
alter table push_subscriptions enable row level security;

-- Origo OS v5: números dos anúncios, saúde dos clientes, prospecção no piloto, portal do cliente e segurança.
-- Só acrescenta; não apaga nada da v4. Pode rodar mais de uma vez.

-- Clientes: contas de anúncio, último contato e link do portal
alter table clients add column if not exists meta_conta text;
alter table clients add column if not exists meta_conversoes text;
alter table clients add column if not exists google_conta text;
alter table clients add column if not exists ultimo_contato date;
alter table clients add column if not exists portal_token text unique default encode(gen_random_bytes(16), 'hex');
update clients set portal_token = encode(gen_random_bytes(16), 'hex') where portal_token is null;

-- Números diários das campanhas (Meta pela API, Google pelo script do Google Ads)
create table if not exists ad_metrics (
  client_id uuid not null references clients(id) on delete cascade,
  plataforma text not null check (plataforma in ('google', 'meta')),
  data date not null,
  investimento numeric(12,2) not null default 0,
  impressoes int not null default 0,
  cliques int not null default 0,
  conversoes numeric(12,2) not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (client_id, plataforma, data)
);

-- O que o cliente precisa mandar (aparece no portal)
create table if not exists client_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  titulo text not null,
  descricao text,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'ok')),
  resposta text,
  respondido_em timestamptz,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists client_requests_client_idx on client_requests (client_id);

-- Leads: de onde veio
alter table leads add column if not exists origem text not null default 'manual';

-- Registro de acessos (login, tentativas erradas, formulário do site)
create table if not exists access_log (
  id bigint generated by default as identity primary key,
  evento text not null,
  ip text,
  navegador text,
  aparelho text,
  created_at timestamptz not null default now()
);
create index if not exists access_log_created_idx on access_log (created_at desc);
create index if not exists access_log_ip_idx on access_log (ip, evento, created_at desc);

insert into settings (chave, valor) values ('seguranca', '{"sessao_versao": 1, "totp_ativo": false}') on conflict (chave) do nothing;

alter table ad_metrics enable row level security;
alter table client_requests enable row level security;
alter table access_log enable row level security;

-- Dados iniciais: os 5 clientes e os 25 leads da semana 1 (contatos levantados em 12/10/2026).
insert into clients (nome, segmento, cidade, plataforma) values
  ('Invertech Palmas', 'Climatização', 'Palmas-TO', 'google'),
  ('Dra. Josimara Lima', 'Advocacia previdenciária', 'Araripina-PE', 'google'),
  ('Matheus Morari', 'Psicologia', null, 'google'),
  ('Style Store For Men', 'Loja de roupas', null, 'meta'),
  ('Delegada Gleide Angelo', 'Política', null, 'meta');

insert into leads (ordem, nome, cidade, nicho, endereco, whatsapp, whatsapp_confirmado, instagram) values
  (1, 'Bom Frio Refrigeração', 'Teresina', 'clima', 'R. Ivan Tito de Oliveira, 1185, Lourival Parente', '5586981582747', true, 'bom_frio_refrige'),
  (2, '3E Refrigeração', 'Teresina', 'clima', 'R. Francisco Nunes da Rocha, 2877, Santa Maria', '5586999012554', true, null),
  (3, 'Parque Sul Refrigeração', 'Teresina', 'clima', 'R. Dr. Airton Freitas, 13, Santo Antônio', '5586988066624', true, null),
  (4, 'EGS Ar-condicionado', 'Teresina', 'clima', null, '5586988522973', true, null),
  (5, 'Classe A Climatização', 'Teresina', 'clima', 'Av. Presidente Kennedy, 7, São Cristóvão', '5586995741646', true, null),
  (6, 'Tocantins Climatização', 'Araguaína', 'clima', null, '5563992391027', true, 'tocantins_climatizacao'),
  (7, 'Servitec Climatização', 'Teresina', 'clima', 'Residencial Zilda Arns, Nova Brasília', '5586999546537', false, null),
  (8, 'Split Clean Refrigeração', 'Teresina', 'clima', 'Av. Gonçalves Dias, 2402, Morada Nova', '5586998502121', false, null),
  (9, 'K Moura Climatização', 'Teresina', 'clima', null, '5586988096979', false, null),
  (10, 'Marinho Refrigeração', 'Araguaína', 'clima', 'Av. Guanabara, 148, Setor Carajá', '5563984240785', false, null),
  (11, 'Glaubert Felix Oliveira Advocacia Previdenciária', 'Guaraí', 'adv', 'Av. Goiás, 1322, Centro', '5563992921038', true, null),
  (12, 'ELS Cordeiro Advogada', 'Serra Talhada', 'adv', null, '5587999971219', true, null),
  (13, 'Rafael Ramos Advocacia', 'Salgueiro', 'adv', 'Salgueiro Shopping, 1º andar', '5587996454040', true, null),
  (14, 'Juliana Roriz Advocacia', 'Petrolina', 'adv', null, '5587974006321', false, null),
  (15, 'Ingrid Alencar Advocacia', 'Serra Talhada', 'adv', null, '5587999400264', false, null),
  (16, 'AR Advocacia (Aristelia Rodrigues)', 'Gurupi', 'adv', 'Alameda Madrid, 191', null, false, 'adv.aristeliarodrigues'),
  (17, 'NEO Especialidades Odontológicas', 'Igarassu', 'odonto', 'Av. Mário Melo, Centro', '5581994529225', true, 'neoigarassu'),
  (18, 'LDB Odontologia', 'Igarassu', 'odonto', 'R. Santina Gomes de Andrade, 04, Centro', '5581984284252', false, 'ldbodontologia'),
  (19, 'Vitória Delgado Odontologia e Harmonização', 'Igarassu', 'odonto', null, '5581994284750', true, null),
  (20, 'Visage Odontologia', 'Paulista', 'odonto', 'Janga', '5581971163005', true, 'consultoriosvisage'),
  (21, 'Saudental Centro Odontológico', 'Paulista', 'odonto', 'Centro', '5581991428730', true, 'saudental_paulista'),
  (22, 'COP Centro Odontológico de Paulista', 'Paulista', 'odonto', 'R. Milton Souza Lopes, 213', '5581988651951', true, 'cop.centro_odontologico'),
  (23, 'Clínica Odontovieira', 'Paulista', 'odonto', 'R. Cinquenta e Um, 35, Jardim Paulista', '5581985764378', true, 'clinicaodontovieira'),
  (24, 'Kaly Odontologia', 'Paulista', 'odonto', 'Jardim Paulista', '5581996927089', true, null),
  (25, 'Max Sorriso Saúde e Estética Oral', 'Paulista', 'odonto', 'R. Cidade Universitária, 160, Janga', '5581985342919', false, null);

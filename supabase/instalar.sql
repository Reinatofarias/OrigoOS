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

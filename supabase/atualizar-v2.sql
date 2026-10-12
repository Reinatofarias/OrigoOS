-- Atualização para o Origo OS v2. Rode uma vez no SQL Editor do Supabase (projeto OrigoOS).
-- Só acrescenta colunas e tabelas; não apaga nenhum dado.

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

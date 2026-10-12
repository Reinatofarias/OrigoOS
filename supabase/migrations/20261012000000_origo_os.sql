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

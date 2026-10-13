-- Origo OS v6: detalhes da tarefa (subtarefas e comentários com histórico), como no ClickUp.
-- Só acrescenta; não apaga nada da v5. Pode rodar mais de uma vez.

-- Subtarefas (checklist dentro da tarefa)
create table if not exists task_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  titulo text not null,
  feita boolean not null default false,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists task_items_task_idx on task_items (task_id, ordem);

-- Comentários e histórico da tarefa (tipo 'atividade' é gerado pelo sistema)
create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  texto text not null,
  tipo text not null default 'comentario' check (tipo in ('comentario', 'atividade')),
  created_at timestamptz not null default now()
);
create index if not exists task_comments_task_idx on task_comments (task_id, created_at);

alter table task_items enable row level security;
alter table task_comments enable row level security;

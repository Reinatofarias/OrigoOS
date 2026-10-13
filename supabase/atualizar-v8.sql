-- Origo OS v8: notificações no celular (agenda, tarefas, financeiro, prospecção e saúde dos clientes).
-- Só acrescenta; não apaga nada. Pode rodar mais de uma vez. (A v7, do Google Agenda, não tem SQL.)

-- Avisos já mandados (cada aviso sai uma vez só)
create table if not exists avisos_enviados (
  chave text primary key,
  enviado_em timestamptz not null default now()
);
create index if not exists avisos_enviados_em_idx on avisos_enviados (enviado_em);
alter table avisos_enviados enable row level security;

-- Relógio de 5 em 5 minutos, rodando no próprio Supabase (pg_cron + pg_net), sem VPS e sem plano pago na Vercel.
-- Ele chama /api/avisos do Origo OS com o endereço e a senha que o sistema guarda em settings ('avisos_relogio').
-- Esses dois são criados sozinhos quando você abre Configurações > Notificações.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'origo-avisos';
select cron.schedule(
  'origo-avisos',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := s.valor ->> 'url',
    headers := jsonb_build_object('authorization', 'Bearer ' || (s.valor ->> 'token')),
    timeout_milliseconds := 25000
  )
  from public.settings s
  where s.chave = 'avisos_relogio';
  $$
);

-- O pg_net guarda cada resposta; apaga as antigas uma vez por dia pra não crescer.
select cron.unschedule(jobid) from cron.job where jobname = 'origo-avisos-limpeza';
select cron.schedule('origo-avisos-limpeza', '0 7 * * *', $$ delete from net._http_response where created < now() - interval '1 day' $$);

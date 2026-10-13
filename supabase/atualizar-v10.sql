-- Origo OS v10: tarefas que se repetem (todo dia, dias úteis, toda semana, todo mês, a cada N dias), como no ClickUp.
-- Rode uma vez no Supabase: SQL Editor > cole tudo > Run.

alter table tasks add column if not exists repeticao jsonb;

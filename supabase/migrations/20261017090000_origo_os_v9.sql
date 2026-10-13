-- Origo OS v9: contrato por tipo (tráfego, mentoria, outros serviços), com redes, vigência e condição de entrada.
-- Rode uma vez no Supabase: SQL Editor > cole tudo > Run.

alter table contracts add column if not exists modelo jsonb;

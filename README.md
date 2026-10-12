# Origo OS

Sistema interno da Origo Company: tarefas do dia, rotina de tráfego dos clientes e funil de prospecção.

Stack: Next.js 16 (App Router) + Supabase + Vercel. Sem servidor próprio.

## Telas

- **Hoje** (`/`): tarefas do dia, tarefa rápida, rotina de tráfego do dia por cliente, follow-ups e novos leads do dia, rotina pessoal.
- **Prospecção** (`/prospeccao`): funil por etapa (Novos, M1…M4, Respondeu, Call, Fechou, Sem interesse), mensagens M1–M4 prontas, botão de WhatsApp com a mensagem preenchida e cadastro de lead.
- **Clientes** (`/clientes`): clientes ativos, semana do tráfego e checklists de Google e Meta.

## Instalação

1. **Banco:** no Supabase, abra *SQL Editor*, cole o conteúdo de `supabase/instalar.sql` e rode. Isso cria as tabelas e cadastra os 5 clientes e os 25 leads iniciais.
2. **Vercel:** importe este repositório e cadastre as variáveis de `.env.example`:
   - `SUPABASE_URL`: em Supabase > Settings > API (Project URL)
   - `SUPABASE_SECRET_KEY`: uma Secret key (sb_secret_...) em Supabase > Settings > API Keys. Nunca coloque no código. Se ela não existir, o app usa `SUPABASE_SERVICE_ROLE_KEY` (a que a integração Supabase + Vercel sincroniza).
   - `ORIGO_PASSWORD`: a senha que você vai usar para entrar.
   - `ORIGO_SESSION_SECRET`: um texto longo e aleatório.
3. Faça o deploy e entre com a senha.

## Segurança

O app fala com o banco só pelo servidor, com a service role. As tabelas têm RLS ligado e nenhuma política, então a chave pública do Supabase não lê nem escreve nada. Todas as páginas e ações checam a sessão.

## Desenvolvimento

```bash
cp .env.example .env.local   # preencha os valores
npm install
npm run dev
```

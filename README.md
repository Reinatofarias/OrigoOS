# Origo OS

Sistema interno da Origo Company: tarefas, funil comercial, clientes e financeiro.

Stack: Next.js 16 (App Router) + Supabase + Vercel. Sem servidor próprio.

## Telas

- **Início** (`/`): resumo do dia com tarefas de hoje, prospecção do dia, rotina de tráfego por cliente, cobranças da semana e rotina pessoal.
- **Tarefas** (`/tarefas`): lista no estilo ClickUp, agrupada por status (A fazer, Em andamento, Concluído), com cliente, prazo e prioridade editáveis na linha.
- **Comercial** (`/comercial`): funil no estilo Pipedrive, com quadro arrastável, lista e perdidos. Cada negócio (`/comercial/[id]`) tem barra de etapas, mensagens M1 a M4 com WhatsApp, anotações, Ganho/Perdido e "Transformar em cliente".
- **Clientes** (`/clientes`): carteira no estilo Asaas, com receita recorrente, recebido, a receber e vencido. Cada cliente (`/clientes/[id]`) tem visão geral, cobranças, tarefas e dados cadastrais.
- **Financeiro** (`/financeiro`): mês a mês, com mensalidades geradas automaticamente, baixa de pagamento, despesas e resultado.

## Instalação

1. **Banco:** no Supabase, abra *SQL Editor*, cole o conteúdo de `supabase/instalar.sql` e rode. Isso cria as tabelas e cadastra os 5 clientes e os 25 leads iniciais. Quem já tinha uma versão anterior roda só os arquivos `supabase/atualizar-vN.sql` que faltam, em ordem (v2, v3, v4, v5, v6).
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

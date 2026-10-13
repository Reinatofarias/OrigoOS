# Origo OS

Sistema interno da Origo Company: tarefas, funil comercial, clientes e financeiro.

Stack: Next.js 16 (App Router) + Supabase + Vercel. Sem servidor próprio.

## Telas

- **Início** (`/`): resumo do dia com tarefas de hoje, prospecção do dia, rotina de tráfego por cliente, cobranças da semana e rotina pessoal.
- **Tarefas** (`/tarefas`): lista no estilo ClickUp, agrupada por status (A fazer, Em andamento, Concluído), com cliente, prazo e prioridade editáveis na linha.
- **Agenda** (`/agenda`): semana com os compromissos do Google Agenda e as tarefas com prazo. Cria compromisso com link do Meet, mostra a agenda de hoje no Início e agenda direto da tarefa.
- **Comercial** (`/comercial`): funil no estilo Pipedrive, com quadro arrastável, lista e perdidos. Cada negócio (`/comercial/[id]`) tem barra de etapas, mensagens M1 a M4 com WhatsApp, anotações, Ganho/Perdido e "Transformar em cliente".
- **Clientes** (`/clientes`): carteira no estilo Asaas, com receita recorrente, recebido, a receber e vencido. Cada cliente (`/clientes/[id]`) tem visão geral, cobranças, tarefas e dados cadastrais.
- **Contratos** (`/contratos`): todos os contratos com status, o passo a passo até a assinatura e "Gerar contrato" pra quem já é cliente (também na ficha do cliente).
- **Financeiro** (`/financeiro`): mês a mês, com mensalidades geradas automaticamente, baixa de pagamento, despesas e resultado.

## Instalação

1. **Banco:** no Supabase, abra *SQL Editor*, cole o conteúdo de `supabase/instalar.sql` e rode. Isso cria as tabelas e cadastra os 5 clientes e os 25 leads iniciais. Quem já tinha uma versão anterior roda só os arquivos `supabase/atualizar-vN.sql` que faltam, em ordem (v2, v3, v4, v5, v6, v8; a v7 não tem SQL).
2. **Vercel:** importe este repositório e cadastre as variáveis de `.env.example`:
   - `SUPABASE_URL`: em Supabase > Settings > API (Project URL)
   - `SUPABASE_SECRET_KEY`: uma Secret key (sb_secret_...) em Supabase > Settings > API Keys. Nunca coloque no código. Se ela não existir, o app usa `SUPABASE_SERVICE_ROLE_KEY` (a que a integração Supabase + Vercel sincroniza).
   - `ORIGO_PASSWORD`: a senha que você vai usar para entrar.
   - `ORIGO_SESSION_SECRET`: um texto longo e aleatório.
3. Faça o deploy e entre com a senha.

## Google Agenda (opcional)

**Jeito simples (só leitura):** no Google Agenda, abra Configurações > sua agenda > Integrar agenda, copie o **Endereço secreto no formato iCal** e cadastre na Vercel como `GOOGLE_AGENDA_ICS`. A tela Agenda e o Início passam a mostrar seus compromissos (com repetições). O botão de compromisso abre o Google Agenda já preenchido pra salvar lá.

**Jeito completo (lê e cria com Meet):**
1. No Google Cloud, ative a Google Calendar API, configure a tela de permissão OAuth (Externo, **publicada em produção**, senão a conexão cai a cada 7 dias) e crie um ID do cliente OAuth do tipo Aplicativo da Web com o redirecionamento `https://SEU-SITE/api/google-agenda/callback`.
2. Na Vercel, cadastre `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` e faça um novo deploy.
3. Em Configurações > Integrações, clique em **Conectar Google Agenda**. O acesso fica guardado no banco, criptografado com o `ORIGO_SESSION_SECRET`, e fica fora do backup. Com a conta conectada, ela tem prioridade sobre o endereço iCal.

## Notificações no celular

Em Configurações > Notificações: ligue no aparelho (com o Origo OS instalado na tela inicial) e escolha o que avisar: resumo do dia, compromissos da agenda (5 a 60 min antes), prospecção, tarefas que faltam, cobranças, pagamento recebido (Asaas) e saúde dos clientes, com horário de não incomodar. Quem dispara é um relógio de 5 em 5 minutos no próprio Supabase (pg_cron + pg_net), criado pelo `supabase/atualizar-v8.sql`; ele chama `/api/avisos` com uma senha que o sistema gera sozinho.

## Segurança

O app fala com o banco só pelo servidor, com a service role. As tabelas têm RLS ligado e nenhuma política, então a chave pública do Supabase não lê nem escreve nada. Todas as páginas e ações checam a sessão.

## Desenvolvimento

```bash
cp .env.example .env.local   # preencha os valores
npm install
npm run dev
```

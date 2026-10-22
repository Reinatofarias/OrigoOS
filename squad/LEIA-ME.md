# Origo Squad

O time de agentes de IA da Origo Company roda no seu computador e tem um painel próprio.
Você manda o comando para o **Coordenador**. Ele divide o trabalho entre os especialistas, e você acompanha tudo ao vivo: quem está trabalhando, o que está fazendo e qual IA está usando.

| Agente | Faz o quê |
|---|---|
| Coordenador | Recebe seu comando, monta o plano, distribui as tarefas e junta o resultado |
| Secretário | Agenda, as 3 prioridades do dia e as tarefas |
| Prospector | Busca leads com WhatsApp e Instagram e escreve a primeira mensagem (pesquisa na web) |
| Conteúdo | Pautas, legendas, carrosséis e roteiros para os 3 perfis |
| Tráfego | Meta Ads e Google Ads: análise, ajustes, campanhas e relatórios (pesquisa na web) |
| Atendimento | Respostas de WhatsApp, qualificação de leads e follow-up |

## Como funciona a escolha da IA

No modo **IA automática**, cada agente tenta os motores na ordem dele:

- **OmniRoute** é o principal: usa todos os modelos que você conectou lá, e com o modelo `auto` o próprio OmniRoute escolhe e troca de provedor.
- **Claude** usa o login do Claude Code (seu plano Pro). É o primeiro na fila do Prospector e do Tráfego, porque pesquisa na web.
- **Codex** usa o login do Codex e também pesquisa na web.

Quando um motor bate o limite, ele fica "em pausa" no topo do painel até a hora em que libera, e o próximo assume sozinho. Você não precisa fazer nada.

> **Importante:** não conecte o login do Claude Pro dentro do OmniRoute. Usar a assinatura por ferramenta de terceiros vai contra os termos do plano e pode bloquear a conta. O squad usa o Claude pelo caminho oficial. Ele ignora o `ANTHROPIC_BASE_URL`, então mesmo que o seu Claude Code esteja apontado para o OmniRoute, o motor Claude continua no login oficial.

## Instalação no Windows (uma vez só)

1. **Node.js 22 LTS:** baixe em https://nodejs.org e instale.
2. **Claude Code logado:** você já usa no VS Code. Para conferir, abra o terminal e rode `claude`. Se ele pedir login, entre com sua conta Pro.
3. **Codex logado (opcional):** no terminal, rode `npx @openai/codex login` e entre com sua conta.
4. **OmniRoute:** veja a seção abaixo.
5. **Base de conhecimento:** copie o arquivo `origo.md` que o Claude te mandou para a pasta `squad\contexto\`. Você também pode apontar para uma pasta do Obsidian em Configurações.
6. Dê dois cliques em **`iniciar.bat`**. Na primeira vez ele instala tudo. Depois, o painel abre sozinho em http://localhost:4321.

Para desligar, feche a janela preta.

## OmniRoute

**Opção A, com Docker (recomendado):** isola o OmniRoute e ele liga sozinho com o Windows.

1. Instale o Docker Desktop.
2. Na pasta `squad\omniroute`, copie `.env.exemplo` para `.env` e troque a senha.
3. Abra o terminal nessa pasta e rode `docker compose up -d`.
4. Abra http://127.0.0.1:20128, conecte seus provedores e crie uma chave em **Endpoints**.

**Opção B, sem Docker:** no terminal, rode `npm install -g omniroute` e depois `omniroute`.

Em qualquer uma das duas, cole a chave no arquivo `squad\.env`, na linha `OMNIROUTE_KEY=`.
No painel do squad, em **Configurações**, a lista de modelos do OmniRoute aparece sozinha.

## Conexão com o Origo OS

A parte comercial (clientes, funil de leads e tarefas) fica no Origo OS, na Vercel. O squad roda aqui e conversa com ele:

- No começo de cada missão, o squad lê os clientes ativos, os leads do funil e as tarefas em aberto. Assim o Prospector não traz lead repetido e o Secretário não cria tarefa duplicada.
- O **Prospector** manda os leads novos direto para o funil de prospecção, com status "novo" e origem "squad". Lead sem WhatsApp e sem Instagram fica de fora.
- O **Secretário** e o **Atendimento** mandam as tarefas para a tela de Tarefas.
- O painel mostra no feed o que foi enviado. Se o Origo OS estiver fora do ar, o pacote fica salvo em `dados\pendentes-origo\`.

Para ligar (uma vez só):

1. No Origo OS, abra **Configurações > Integrações > Origo Squad** e copie as duas linhas.
2. Cole as duas no arquivo `squad\.env` (no lugar de `ORIGO_OS_URL=` e `ORIGO_OS_TOKEN=`).
3. Feche e abra o squad de novo.

O token é a senha do squad: fica só no `.env`, nunca no chat nem no GitHub. Os agentes operacionais (Conteúdo, Tráfego) continuam trabalhando só aqui. Para um agente novo mandar coisas, use `origo_os: leads` ou `origo_os: tarefas` no cabeçalho dele.

## Onde ficam as coisas

| Pasta / arquivo | O que é |
|---|---|
| `agentes/*.md` | As instruções de cada agente. Edite no VS Code para mudar o jeito dele trabalhar, e reinicie o squad. |
| `contexto/` | Base de conhecimento lida por todos os agentes (ou a pasta do Obsidian configurada) |
| `entregas/` | Tudo o que os agentes entregam, em Markdown, uma pasta por missão (abre no Obsidian também) |
| `dados/` | Histórico das missões e configurações |
| `.env` | Suas chaves. Fica só no computador |

### Criar um agente novo

Copie um arquivo de `agentes/`, troque o `id`, o `nome`, o `papel` e as instruções. Depois reinicie o squad.
No cabeçalho, `motores:` define a ordem das IAs, e `modelo_omniroute:` define o modelo que esse agente usa no OmniRoute. Com `precisa_web: true`, o agente pesquisa na web quando roda no Claude ou no Codex.

## Segurança

- O painel só abre no seu computador (127.0.0.1). Ninguém da sua rede acessa.
- Os agentes não alteram nem apagam seus arquivos. Eles só leem, pesquisam e escrevem a resposta, e o squad salva a entrega em `entregas/`. O Claude só tem busca na web e o Codex roda em modo somente leitura.
- As chaves ficam no `.env`, que não vai para o GitHub.

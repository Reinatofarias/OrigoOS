// Ponte com o Origo OS (o sistema da Origo na Vercel). A parte comercial mora lá:
//  - no começo da missão o squad lê clientes, leads e tarefas, para não repetir nada;
//  - quando um agente termina, o bloco ```origo-os da entrega vira lead ou tarefa lá.
// Endereço e token: Origo OS > Configurações > Integrações > Origo Squad, colados no .env.

const TEMPO = 8000;

export function origoConectado() {
  return Boolean(process.env.ORIGO_OS_URL && process.env.ORIGO_OS_TOKEN);
}

async function chamar(metodo, corpo) {
  const resposta = await fetch(process.env.ORIGO_OS_URL, {
    method: metodo,
    headers: { authorization: `Bearer ${process.env.ORIGO_OS_TOKEN}`, "content-type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(TEMPO),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (resposta.status === 401) throw new Error("token recusado: copie de novo em Configurações > Integrações");
  if (!resposta.ok) throw new Error(dados.erro || `o Origo OS respondeu ${resposta.status}`);
  return dados;
}

// Dados ao vivo em Markdown curto. Leads só vão para quem precisa (a lista pode ser grande).
export async function lerContextoOrigo() {
  const d = await chamar("GET");
  const clientes = (d.clientes || []).map((c) => `- ${c.nome}${c.segmento ? ` (${c.segmento})` : ""}${c.cidade ? `, ${c.cidade}` : ""}`).join("\n");
  const tarefas = (d.tarefas || []).map((t) => `- ${t.titulo}${t.data ? ` (até ${t.data.split("-").reverse().join("/")})` : ""}${t.prioridade && t.prioridade !== "normal" ? ` [${t.prioridade}]` : ""}`).join("\n");
  const leads = (d.leads || []).map((l) => `- ${l.nome}${l.cidade ? `, ${l.cidade}` : ""} (${l.status})${l.instagram ? ` @${l.instagram}` : ""}`).join("\n");
  const geral = [
    "# Dados ao vivo do Origo OS",
    `## Clientes ativos (${(d.clientes || []).length})\n${clientes || "- nenhum"}`,
    `## Tarefas em aberto (${(d.tarefas || []).length})\n${tarefas || "- nenhuma"}`,
  ].join("\n\n");
  const comLeads = `${geral}\n\n## Leads que já estão no funil (${(d.leads || []).length}): não traga nenhum destes de novo\n${leads || "- nenhum"}`;
  return { geral, comLeads, totais: { clientes: (d.clientes || []).length, leads: (d.leads || []).length, tarefas: (d.tarefas || []).length } };
}

// Como o agente deve escrever o bloco, conforme o que ele manda (leads ou tarefas).
export function instrucaoOrigo(tipo) {
  if (tipo === "leads") {
    return `# Enviar para o Origo OS
No fim da entrega, inclua um bloco assim com os leads novos (só os que têm WhatsApp ou Instagram de verdade). O squad cadastra eles no funil de prospecção do Origo OS e tira o bloco do arquivo:
\`\`\`origo-os
{"leads": [{"nome": "Nome da empresa", "cidade": "Cidade-UF", "nicho": "clima | adv | odonto | outro", "whatsapp": "81999998888", "instagram": "perfil sem @", "contato": "nome do dono, se souber", "notas": "por que é um bom lead + a primeira mensagem de WhatsApp"}]}
\`\`\``;
  }
  if (tipo === "tarefas") {
    return `# Enviar para o Origo OS
Quando a entrega tiver tarefas que o Renato precisa fazer, inclua no fim um bloco assim. O squad cria as tarefas no Origo OS e tira o bloco do arquivo. Não repita tarefas que já estão em aberto lá:
\`\`\`origo-os
{"tarefas": [{"titulo": "Verbo + o que fazer", "descricao": "detalhes e próximo passo", "data": "AAAA-MM-DD", "prioridade": "urgente | alta | normal | baixa", "cliente": "nome do cliente, se for de um"}]}
\`\`\``;
  }
  return "";
}

// Separa o bloco ```origo-os do resto da entrega. Junta vários blocos, se houver.
export function separarBloco(texto) {
  const pacote = { leads: [], tarefas: [] };
  let achou = false;
  const limpo = texto.replace(/```origo-os\s*([\s\S]*?)```/g, (_, json) => {
    try {
      const d = JSON.parse(json);
      if (Array.isArray(d.leads)) pacote.leads.push(...d.leads);
      if (Array.isArray(d.tarefas)) pacote.tarefas.push(...d.tarefas);
      achou = true;
    } catch {
      return _; // JSON quebrado: deixa no arquivo para o Renato ver
    }
    return "";
  });
  return { texto: limpo.trimEnd(), pacote: achou && (pacote.leads.length || pacote.tarefas.length) ? pacote : null };
}

export async function enviarParaOrigo(pacote) {
  return chamar("POST", pacote);
}

// Motores de IA do squad. Cada um roda um agente e avisa o painel do que está fazendo.
//  - omniroute: o gateway local do Renato (todos os modelos dele, endpoint compatível com OpenAI)
//  - claude: Claude Code pelo login oficial (plano Pro), com busca na web
//  - codex: Codex pelo login oficial, com busca na web
// A escolha é automática: segue a ordem do agente, pula motor desligado ou em pausa por limite
// e passa para o próximo quando um falha.
import OpenAI from "openai";
import { RAIZ } from "./caminhos.mjs";

export const NOMES = { omniroute: "OmniRoute", claude: "Claude", codex: "Codex" };

// Estado de cada motor: ok, pausado (limite atingido, com hora de volta) ou erro.
const saude = {
  omniroute: { estado: "ok" },
  claude: { estado: "ok" },
  codex: { estado: "ok" },
};
let aoMudarSaude = () => {};

export function observarSaude(fn) {
  aoMudarSaude = fn;
}

export function saudeMotores() {
  const agora = Date.now();
  for (const s of Object.values(saude)) {
    if (s.estado === "pausado" && s.ate && s.ate <= agora) Object.assign(s, { estado: "ok", ate: null, motivo: "" });
  }
  return structuredClone(saude);
}

function marcar(motor, dados) {
  saude[motor] = { estado: "ok", ate: null, motivo: "", ...dados };
  aoMudarSaude(saudeMotores());
}

export class ErroLimite extends Error {
  constructor(mensagem, ate) {
    super(mensagem);
    this.ate = ate;
  }
}

const MINUTO = 60_000;

function pareceLimite(texto) {
  return /rate.?limit|usage limit|quota|429|limit reached|too many requests|insufficient|exceeded/i.test(String(texto));
}

// Variáveis que desviariam o Claude Code para outro endereço. O motor "claude" usa sempre o
// login oficial, mesmo que o Claude Code do computador esteja apontado para o OmniRoute.
function ambienteLimpo(remover) {
  const env = { ...process.env };
  for (const chave of remover) delete env[chave];
  return env;
}

function resumirEntrada(entrada) {
  if (!entrada || typeof entrada !== "object") return "";
  const v = entrada.query || entrada.url || entrada.pattern || entrada.file_path || entrada.path || "";
  return String(v).slice(0, 140);
}

// ---------- OmniRoute ----------
async function rodarOmniroute({ agente, sistema, tarefa, config, avisar, sinal }) {
  const cliente = new OpenAI({
    baseURL: config.omniroute.url,
    apiKey: process.env.OMNIROUTE_KEY || "sem-chave",
    maxRetries: 1,
  });
  // Painel > arquivo do agente > modelo padrão do OmniRoute
  const modelo = config.agentes?.[agente.id]?.modelo || agente.modeloOmniroute || config.omniroute.modelo || "auto";
  avisar({ tipo: "status", texto: `Pensando com ${modelo} (OmniRoute)` });
  let texto = "";
  let usado = modelo;
  let ultimoAviso = 0;
  try {
    const fluxo = await cliente.chat.completions.create(
      {
        model: modelo,
        stream: true,
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: tarefa },
        ],
      },
      { signal: sinal },
    );
    for await (const parte of fluxo) {
      if (parte.model) usado = parte.model;
      texto += parte.choices?.[0]?.delta?.content || "";
      if (Date.now() - ultimoAviso > 1200 && texto) {
        ultimoAviso = Date.now();
        avisar({ tipo: "escrevendo", texto: texto.slice(-220) });
      }
    }
  } catch (erro) {
    if (sinal?.aborted) throw erro;
    const status = erro?.status;
    if (status === 429 || pareceLimite(erro?.message)) throw new ErroLimite(`OmniRoute sem cota: ${erro.message}`, Date.now() + 2 * MINUTO);
    if (erro instanceof OpenAI.APIConnectionError) throw new ErroLimite("OmniRoute desligado ou fora do endereço configurado", Date.now() + MINUTO);
    throw erro;
  }
  if (!texto.trim()) throw new Error(`O modelo ${usado} respondeu vazio`);
  return { texto, modelo: usado };
}

// ---------- Claude (login oficial do Claude Code) ----------
async function rodarClaude({ agente, sistema, tarefa, config, avisar, sinal }) {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const ferramentas = agente.precisaWeb ? ["WebSearch", "WebFetch"] : [];
  const controle = new AbortController();
  sinal?.addEventListener("abort", () => controle.abort(), { once: true });
  avisar({ tipo: "status", texto: "Pensando com Claude" });

  const conversa = query({
    prompt: tarefa,
    options: {
      systemPrompt: sistema,
      cwd: RAIZ,
      tools: ferramentas,
      allowedTools: ferramentas,
      permissionMode: "dontAsk",
      settingSources: [],
      maxTurns: 40,
      abortController: controle,
      model: config.claude.modelo || undefined,
      env: ambienteLimpo(["ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN"]),
    },
  });

  let modelo = "Claude";
  for await (const m of conversa) {
    if (m.type === "system" && m.subtype === "init" && m.model) modelo = m.model;
    if (m.type === "rate_limit_event" && m.rate_limit_info?.status === "rejected") {
      const r = m.rate_limit_info.resetsAt;
      throw new ErroLimite("Limite do Claude Pro atingido", r ? (r < 1e12 ? r * 1000 : r) : Date.now() + 30 * MINUTO);
    }
    if (m.type === "assistant") {
      if (m.error === "rate_limit" || m.error === "billing_error") throw new ErroLimite("Limite do Claude atingido", Date.now() + 30 * MINUTO);
      if (m.error === "authentication_failed") throw new ErroLimite("Claude sem login: abra o terminal e rode  claude  para entrar", Date.now() + 10 * MINUTO);
      for (const bloco of m.message?.content || []) {
        if (bloco.type === "tool_use") {
          const acao = bloco.name === "WebSearch" ? "Pesquisando na web" : bloco.name === "WebFetch" ? "Lendo página" : bloco.name;
          avisar({ tipo: "ferramenta", texto: `${acao}: ${resumirEntrada(bloco.input)}` });
        } else if (bloco.type === "text" && bloco.text.trim()) {
          avisar({ tipo: "escrevendo", texto: bloco.text.slice(-220) });
        }
      }
    }
    if (m.type === "result") {
      if (m.subtype === "success" && !m.is_error) return { texto: m.result, modelo };
      const detalhe = (m.errors || []).join("; ") || m.result || m.subtype;
      if (pareceLimite(detalhe)) throw new ErroLimite(`Limite do Claude: ${detalhe}`, Date.now() + 30 * MINUTO);
      throw new Error(`Claude não terminou: ${detalhe}`);
    }
  }
  throw new Error("Claude encerrou sem resposta");
}

// ---------- Codex (login oficial do Codex) ----------
async function rodarCodex({ agente, sistema, tarefa, config, avisar, sinal }) {
  const { Codex } = await import("@openai/codex-sdk");
  const codex = new Codex({ env: ambienteLimpo(["OPENAI_BASE_URL"]) });
  const conversa = codex.startThread({
    workingDirectory: RAIZ,
    skipGitRepoCheck: true,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    webSearchMode: agente.precisaWeb ? "live" : "disabled",
    model: config.codex.modelo || undefined,
  });
  avisar({ tipo: "status", texto: "Pensando com Codex" });
  const { events } = await conversa.runStreamed(`${sistema}\n\n---\n\nTAREFA:\n${tarefa}`, { signal: sinal });
  let texto = "";
  for await (const ev of events) {
    if (ev.type === "item.started" || ev.type === "item.completed") {
      const item = ev.item;
      if (item.type === "web_search" && ev.type === "item.started") avisar({ tipo: "ferramenta", texto: `Pesquisando na web: ${item.query}` });
      if (item.type === "command_execution" && ev.type === "item.started") avisar({ tipo: "ferramenta", texto: `Comando: ${item.command.slice(0, 140)}` });
      if (item.type === "reasoning" && ev.type === "item.completed" && item.text) avisar({ tipo: "status", texto: item.text.slice(0, 220) });
      if (item.type === "agent_message" && ev.type === "item.completed") {
        texto = item.text;
        avisar({ tipo: "escrevendo", texto: texto.slice(-220) });
      }
    }
    // "Reconnecting... 1/5" é o Codex tentando de novo sozinho: só avisa e segue.
    if (ev.type === "error" && /^Reconnecting/i.test(ev.message)) {
      avisar({ tipo: "status", texto: `Codex reconectando (${ev.message.slice(0, 40)})` });
      continue;
    }
    if (ev.type === "turn.failed" || ev.type === "error") {
      const msg = ev.type === "error" ? ev.message : ev.error.message;
      if (pareceLimite(msg)) throw new ErroLimite(`Limite do Codex: ${msg}`, Date.now() + 30 * MINUTO);
      throw new Error(`Codex: ${msg}`);
    }
  }
  if (!texto.trim()) throw new Error("Codex terminou sem resposta");
  return { texto, modelo: config.codex.modelo || "Codex" };
}

const RODAR = { omniroute: rodarOmniroute, claude: rodarClaude, codex: rodarCodex };

// Ordem de tentativa para um agente: a ordem dele, só motores ligados, os pausados no fim.
export function ordemMotores(agente, config, forcar) {
  const base = forcar && forcar !== "auto" ? [forcar] : agente.motores;
  const ligados = base.filter((m) => RODAR[m] && config[m]?.ativo !== false);
  const s = saudeMotores();
  const livres = ligados.filter((m) => s[m].estado !== "pausado");
  const pausados = ligados.filter((m) => s[m].estado === "pausado").sort((a, b) => (s[a].ate || 0) - (s[b].ate || 0));
  return [...livres, ...pausados];
}

// Roda o agente tentando os motores em ordem até um responder.
export async function rodarAgente({ agente, sistema, tarefa, config, forcar, avisar, sinal }) {
  const ordem = ordemMotores(agente, config, forcar);
  if (!ordem.length) throw new Error("Nenhum motor ligado. Ligue pelo menos um em Configurações.");
  const falhas = [];
  for (const motor of ordem) {
    if (sinal?.aborted) throw new Error("Missão parada");
    avisar({ tipo: "motor", motor, texto: `Usando ${NOMES[motor]}` });
    try {
      const r = await RODAR[motor]({ agente, sistema, tarefa, config, avisar, sinal });
      if (saude[motor].estado !== "ok") marcar(motor, { estado: "ok" });
      return { ...r, motor };
    } catch (erro) {
      if (sinal?.aborted) throw new Error("Missão parada");
      const mensagem = erro?.message || String(erro);
      if (erro instanceof ErroLimite) marcar(motor, { estado: "pausado", ate: erro.ate, motivo: mensagem });
      else marcar(motor, { estado: "erro", motivo: mensagem });
      falhas.push(`${NOMES[motor]}: ${mensagem}`);
      avisar({ tipo: "troca", motor, texto: `${NOMES[motor]} falhou (${mensagem.slice(0, 160)}). Tentando o próximo.` });
    }
  }
  throw new Error(`Todos os motores falharam. ${falhas.join(" | ")}`);
}

export async function listarModelosOmniroute(config) {
  const cliente = new OpenAI({ baseURL: config.omniroute.url, apiKey: process.env.OMNIROUTE_KEY || "sem-chave", maxRetries: 0, timeout: 5000 });
  const lista = [];
  for await (const m of cliente.models.list()) lista.push(m.id);
  return lista.sort();
}

// Confere de tempos em tempos se o OmniRoute está aberto, para o painel mostrar a verdade
// e o squad nem tentar usá-lo enquanto ele estiver fechado.
export async function verificarOmniroute(config) {
  if (config.omniroute?.ativo === false) return;
  try {
    await listarModelosOmniroute(config);
    if (saude.omniroute.estado !== "ok") marcar("omniroute", { estado: "ok" });
  } catch {
    marcar("omniroute", { estado: "pausado", ate: Date.now() + 70_000, motivo: `OmniRoute não encontrado em ${config.omniroute.url}` });
  }
}

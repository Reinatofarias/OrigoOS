// Fluxo de uma missão: o Coordenador planeja, os especialistas trabalham em paralelo
// e o Coordenador junta tudo numa resposta para o Renato. Cada passo vira evento no painel.
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { DADOS, ENTREGAS } from "./caminhos.mjs";
import { carregarAgentes, especialistas } from "./agentes.mjs";
import { lerConfig, lerContexto } from "./config.mjs";
import { rodarAgente } from "./motores.mjs";
import { gerarImagens, instrucaoImagens, trazerImagensCodex } from "./imagens.mjs";
import { criarAgendamento } from "./agenda.mjs";
import { origoConectado, lerContextoOrigo, instrucaoOrigo, separarBloco, enviarParaOrigo } from "./origoos.mjs";

export const eventos = new EventEmitter();
eventos.setMaxListeners(50);

const PASTA_MISSOES = path.join(DADOS, "missoes");
const ativas = new Map(); // id -> AbortController

function agoraIso() {
  return new Date().toISOString();
}

function slug(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "missao";
}

function salvar(missao) {
  fs.mkdirSync(PASTA_MISSOES, { recursive: true });
  fs.writeFileSync(path.join(PASTA_MISSOES, `${missao.id}.json`), JSON.stringify(missao, null, 2));
}

export function listarMissoes() {
  if (!fs.existsSync(PASTA_MISSOES)) return [];
  return fs
    .readdirSync(PASTA_MISSOES)
    .filter((a) => a.endsWith(".json"))
    .map((a) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(PASTA_MISSOES, a), "utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}

export function lerMissao(id) {
  const arquivo = path.join(PASTA_MISSOES, `${path.basename(id)}.json`);
  return fs.existsSync(arquivo) ? JSON.parse(fs.readFileSync(arquivo, "utf8")) : null;
}

export function pararMissao(id) {
  ativas.get(id)?.abort();
}

// origo: dados ao vivo do Origo OS (ou null quando o squad não está conectado).
function sistemaDe(agente, contexto, origo) {
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Recife" });
  const verLeads = agente.id === "coordenador" || agente.origoOs === "leads";
  return [
    agente.instrucoes,
    `Hoje é ${hoje}.`,
    contexto ? `# Contexto da Origo Company\n\n${contexto}` : "",
    origo ? (verLeads ? origo.comLeads : origo.geral) : "",
    origo ? instrucaoOrigo(agente.origoOs) : "",
    agente.imagens ? instrucaoImagens() : "",
    "Responda sempre em português do Brasil.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Tira o primeiro objeto JSON do texto do modelo (com ou sem bloco ```json).
function extrairJson(texto) {
  const bloco = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  const fonte = bloco ? bloco[1] : texto;
  const inicio = fonte.indexOf("{");
  const fim = fonte.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) return null;
  try {
    return JSON.parse(fonte.slice(inicio, fim + 1));
  } catch {
    return null;
  }
}

function pedidoDePlano(texto, time, historico) {
  const lista = time.map((a) => `- ${a.id}: ${a.nome} (${a.papel})`).join("\n");
  const anteriores = historico.length
    ? `\n\nÚltimas missões (para continuidade):\n${historico.map((m) => `- "${m.texto}" → ${(m.resposta || "").slice(0, 300)}`).join("\n")}`
    : "";
  return `Pedido do Renato:\n"""${texto}"""${anteriores}

Especialistas disponíveis:
${lista}

Responda SOMENTE com um JSON neste formato:
{
  "entendi": "uma frase dizendo o que você entendeu do pedido",
  "tarefas": [ { "agente": "id do especialista", "tarefa": "tarefa completa e autossuficiente para ele" } ],
  "resposta_direta": "preencha só quando não precisar de nenhum especialista",
  "agendamento": null
}

Se o Renato pedir para repetir ou programar algo ("todo dia", "toda segunda", "amanhã às 9h", "de segunda a sexta"), preencha "agendamento" assim:
{ "comando": "o pedido completo que o squad deve executar em cada vez, escrito como se o Renato pedisse na hora", "hora": "HH:MM", "dias": [0 a 6, onde 0 é domingo; vazio = todo dia], "data": "AAAA-MM-DD só quando for uma vez só" }
Nesse caso, deixe "tarefas" vazio, a não ser que ele também peça para fazer agora.`;
}

function pedidoDeResumo(texto, tarefas) {
  const partes = tarefas
    .map((t) => `## ${t.nome}\nTarefa: ${t.tarefa}\n\n${t.status === "concluida" ? (t.resultado || "").slice(0, 8000) : `Não concluiu: ${t.erro}`}${t.origo ? `\n\n${t.origo}` : ""}${t.imagens?.length ? `\n\nImagens geradas: ${t.imagens.map((i) => i.caminho).join(", ")}` : ""}`)
    .join("\n\n");
  return `O Renato pediu:\n"""${texto}"""\n\nO time entregou:\n\n${partes}\n\nEscreva para o Renato uma resposta curta (até 12 linhas): o que foi feito, o principal de cada entrega e o próximo passo que ele deve dar. Não repita as entregas inteiras, elas já estão salvas em arquivos.`;
}

async function emLotes(itens, limite, fn) {
  let i = 0;
  const trabalhadores = Array.from({ length: Math.max(1, Math.min(limite, itens.length)) }, async () => {
    while (i < itens.length) {
      const atual = itens[i++];
      await fn(atual);
    }
  });
  await Promise.all(trabalhadores);
}

// Manda leads e tarefas do agente para o Origo OS e devolve uma frase do que aconteceu.
async function mandarProOrigo(pacote, agenteId, emitir) {
  const qtd = [pacote.leads.length ? `${pacote.leads.length} lead(s)` : "", pacote.tarefas.length ? `${pacote.tarefas.length} tarefa(s)` : ""].filter(Boolean).join(" e ");
  if (!origoConectado()) {
    const frase = `Preparei ${qtd} para o Origo OS, mas o squad não está conectado (falta ORIGO_OS_URL e ORIGO_OS_TOKEN no .env).`;
    emitir({ agente: agenteId, tipo: "troca", texto: frase });
    return frase;
  }
  emitir({ agente: agenteId, tipo: "ferramenta", texto: `Enviando ${qtd} para o Origo OS` });
  try {
    const r = await enviarParaOrigo(pacote);
    const partes = [];
    if (pacote.leads.length) partes.push(`${r.leadsCriados} lead(s) novo(s) no funil`);
    if (r.leadsRepetidos?.length) partes.push(`${r.leadsRepetidos.length} já existia(m) (${r.leadsRepetidos.join(", ")})`);
    if (r.leadsSemContato?.length) partes.push(`${r.leadsSemContato.length} sem WhatsApp/Instagram ficaram de fora (${r.leadsSemContato.join(", ")})`);
    if (pacote.tarefas.length) partes.push(`${r.tarefasCriadas} tarefa(s) criada(s)`);
    const frase = `Origo OS: ${partes.join("; ")}.`;
    emitir({ agente: agenteId, tipo: "status", texto: frase });
    return frase;
  } catch (erro) {
    const frase = `Não consegui enviar ${qtd} para o Origo OS (${erro?.message || erro}). O bloco ficou em dados/pendentes-origo.`;
    guardarPendente(pacote);
    emitir({ agente: agenteId, tipo: "erro", texto: frase });
    return frase;
  }
}

// Se o Origo OS estiver fora do ar, nada se perde: o pacote fica salvo para mandar depois.
function guardarPendente(pacote) {
  const pasta = path.join(DADOS, "pendentes-origo");
  fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(path.join(pasta, `${Date.now()}.json`), JSON.stringify(pacote, null, 2));
}

// origem: "painel", "rotina" (agendada) ou "edicao" (pedido corrigido de outra missão, em refazDe).
export function criarMissao(texto, { motor = "auto", origem = "painel", refazDe = null, rotina = null } = {}) {
  const criadaEm = agoraIso();
  const id = `${criadaEm.slice(0, 19).replace(/[:T]/g, "-")}-${slug(texto)}`;
  const missao = { id, criadaEm, texto, motor, origem, refazDe, rotina, status: "planejando", entendi: "", tarefas: [], resposta: "", pasta: "", log: [] };
  salvar(missao);
  executar(missao).catch(() => {});
  return missao;
}

async function executar(missao) {
  const controle = new AbortController();
  ativas.set(missao.id, controle);
  const config = lerConfig();
  const agentes = carregarAgentes();
  const contexto = lerContexto(config);
  const time = especialistas(agentes);
  const pasta = path.join(ENTREGAS, missao.id);
  missao.pasta = path.relative(ENTREGAS, pasta);

  const emitir = (dados) => {
    const ev = { ...dados, missaoId: missao.id, quando: agoraIso() };
    // O texto parcial ("escrevendo") só vai ao vivo para o painel; não entra no histórico.
    if (ev.tipo !== "escrevendo") {
      missao.log.push(ev);
      if (missao.log.length > 600) missao.log.splice(0, missao.log.length - 600);
    }
    eventos.emit("evento", ev);
  };
  const mudou = () => {
    salvar(missao);
    eventos.emit("missao", missao);
  };
  const avisoDe = (agenteId) => (dados) => {
    // O plano do Coordenador sai em JSON: no painel aparece só que ele está escrevendo.
    if (agenteId === "coordenador" && dados.tipo === "escrevendo") return emitir({ agente: agenteId, ...dados, texto: "" });
    emitir({ agente: agenteId, ...dados });
  };

  try {
    // 0) Dados ao vivo do Origo OS (clientes, leads e tarefas), se o squad estiver conectado
    let origo = null;
    if (origoConectado()) {
      try {
        origo = await lerContextoOrigo();
        const { clientes, leads, tarefas } = origo.totais;
        emitir({ agente: "coordenador", tipo: "status", texto: `Li o Origo OS: ${clientes} cliente(s), ${leads} lead(s), ${tarefas} tarefa(s) em aberto` });
      } catch (erro) {
        emitir({ agente: "coordenador", tipo: "troca", texto: `Não consegui ler o Origo OS (${erro?.message || erro}). Sigo sem os dados de lá.` });
      }
    }

    // 1) Coordenador planeja
    emitir({ agente: "coordenador", tipo: "inicio", texto: "Recebi o pedido e estou planejando" });
    const historico = listarMissoes()
      .filter((m) => m.id !== missao.id && m.status === "concluida")
      .slice(0, 3);
    const plano = await rodarAgente({
      agente: agentes.coordenador,
      sistema: sistemaDe(agentes.coordenador, contexto, origo),
      tarefa: pedidoDePlano(missao.texto, time, historico),
      config,
      forcar: missao.motor,
      avisar: avisoDe("coordenador"),
      sinal: controle.signal,
    });
    const json = extrairJson(plano.texto);
    if (!json) {
      // O modelo não devolveu plano: a resposta dele vira a resposta da missão.
      missao.resposta = plano.texto;
    } else {
      missao.entendi = json.entendi || "";
      missao.tarefas = (json.tarefas || [])
        .filter((t) => agentes[t.agente] && t.agente !== "coordenador" && t.tarefa)
        .map((t) => ({ agente: t.agente, nome: agentes[t.agente].nome, tarefa: t.tarefa, status: "na_fila", motor: "", modelo: "", inicio: null, fim: null, arquivo: "", resultado: "", erro: "" }));
      if (!missao.tarefas.length) missao.resposta = json.resposta_direta || json.entendi || plano.texto;
      if (json.agendamento?.comando) {
        try {
          const a = criarAgendamento({ ...json.agendamento, motor: missao.motor });
          missao.agendamento = a.id;
          eventos.emit("agendamentos");
          const aviso = `Rotina criada: ${a.quando}, o squad vai fazer "${a.comando}". Ela aparece em Rotinas, onde dá para pausar ou apagar.`;
          if (!missao.tarefas.length) missao.resposta = aviso;
          emitir({ agente: "coordenador", tipo: "agenda", texto: aviso });
        } catch (erro) {
          emitir({ agente: "coordenador", tipo: "erro", texto: `Não consegui criar a rotina: ${erro?.message || erro}` });
        }
      }
    }
    emitir({ agente: "coordenador", tipo: "fim", motor: plano.motor, texto: missao.tarefas.length ? `Plano pronto: ${missao.tarefas.map((t) => t.nome).join(", ")}` : "Respondi direto" });
    missao.status = missao.tarefas.length ? "em_andamento" : "concluida";
    mudou();

    // 2) Especialistas trabalham
    if (missao.tarefas.length) {
      fs.mkdirSync(pasta, { recursive: true });
      for (const t of missao.tarefas) emitir({ agente: t.agente, tipo: "fila", texto: t.tarefa });
      await emLotes(missao.tarefas, config.paralelo, async (t) => {
        if (controle.signal.aborted) return;
        t.status = "trabalhando";
        t.inicio = agoraIso();
        emitir({ agente: t.agente, tipo: "inicio", texto: "Comecei a tarefa" });
        mudou();
        try {
          const r = await rodarAgente({
            agente: agentes[t.agente],
            sistema: sistemaDe(agentes[t.agente], contexto, origo),
            tarefa: t.tarefa,
            config,
            forcar: missao.motor,
            avisar: avisoDe(t.agente),
            sinal: controle.signal,
          });
          const separado = separarBloco(r.texto);
          const { pacote } = separado;
          const pedidas = await gerarImagens({ texto: separado.texto, pastaMissao: pasta, prefixo: t.agente, config, avisar: avisoDe(t.agente), sinal: controle.signal });
          const doCodex = trazerImagensCodex({ texto: pedidas.texto, arquivos: r.imagensGeradas, pastaMissao: pasta, prefixo: t.agente, avisar: avisoDe(t.agente) });
          const texto = doCodex.texto;
          t.imagens = [...pedidas.imagens, ...doCodex.imagens];
          t.resultado = texto;
          t.motor = r.motor;
          t.modelo = r.modelo;
          t.arquivo = path.join(missao.pasta, `${t.agente}.md`);
          if (pacote) t.origo = await mandarProOrigo(pacote, t.agente, emitir);
          const rodape = t.origo ? `\n\n---\n${t.origo}\n` : "\n";
          fs.writeFileSync(path.join(ENTREGAS, t.arquivo), `# ${t.nome}\n\n> ${t.tarefa}\n\n${texto}${rodape}`);
          t.status = "concluida";
          emitir({ agente: t.agente, tipo: "fim", motor: r.motor, texto: `Entrega salva (${r.modelo})` });
        } catch (erro) {
          t.status = "falhou";
          t.erro = erro?.message || String(erro);
          emitir({ agente: t.agente, tipo: "erro", texto: t.erro });
        }
        t.fim = agoraIso();
        mudou();
      });

      if (controle.signal.aborted) throw new Error("Missão parada");

      // 3) Coordenador junta tudo
      emitir({ agente: "coordenador", tipo: "inicio", texto: "Juntando as entregas do time" });
      const resumo = await rodarAgente({
        agente: agentes.coordenador,
        sistema: sistemaDe(agentes.coordenador, contexto, origo),
        tarefa: pedidoDeResumo(missao.texto, missao.tarefas),
        config,
        forcar: missao.motor,
        avisar: avisoDe("coordenador"),
        sinal: controle.signal,
      });
      missao.resposta = resumo.texto;
      fs.writeFileSync(path.join(pasta, "resumo.md"), `# ${missao.texto}\n\n${resumo.texto}\n`);
      emitir({ agente: "coordenador", tipo: "fim", motor: resumo.motor, texto: "Missão concluída" });
    }
    missao.status = missao.tarefas.some((t) => t.status === "falhou") ? "concluida_com_falhas" : "concluida";
  } catch (erro) {
    missao.status = controle.signal.aborted ? "parada" : "falhou";
    missao.resposta = missao.resposta || (controle.signal.aborted ? "Missão parada por você." : `Não deu certo: ${erro?.message || erro}`);
    for (const t of missao.tarefas) if (t.status === "na_fila" || t.status === "trabalhando") t.status = "parada";
    emitir({ agente: "coordenador", tipo: "erro", texto: missao.resposta });
  } finally {
    ativas.delete(missao.id);
    missao.fimEm = agoraIso();
    mudou();
  }
}

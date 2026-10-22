// Configuração do squad: dados/config.json (editável pelo painel) + .env (chaves).
import fs from "node:fs";
import path from "node:path";
import { RAIZ, DADOS, CONTEXTO } from "./caminhos.mjs";

const ARQUIVO = path.join(DADOS, "config.json");

export const PADRAO = {
  porta: 4321,
  paralelo: 3,
  // Pasta de conhecimento lida por todos os agentes (pode ser um cofre do Obsidian). Vazio = squad/contexto.
  conhecimento: "",
  omniroute: { ativo: true, url: "http://localhost:20128/v1", modelo: "auto" },
  claude: { ativo: true, modelo: "" },
  codex: { ativo: true, modelo: "" },
  // Modelo do OmniRoute escolhido no painel para cada agente: { prospector: { modelo: "..." } }
  agentes: {},
};

// Lê squad/.env (CHAVE=valor por linha) sem sobrescrever o que já está no ambiente.
export function carregarEnv() {
  const arquivo = path.join(RAIZ, ".env");
  if (!fs.existsSync(arquivo)) return;
  for (const linha of fs.readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function mesclar(base, extra) {
  const saida = { ...base };
  for (const [k, v] of Object.entries(extra || {})) {
    saida[k] = v && typeof v === "object" && !Array.isArray(v) ? mesclar(base[k] || {}, v) : v;
  }
  return saida;
}

export function lerConfig() {
  try {
    return mesclar(PADRAO, JSON.parse(fs.readFileSync(ARQUIVO, "utf8")));
  } catch {
    return structuredClone(PADRAO);
  }
}

export function salvarConfig(novo) {
  const config = mesclar(lerConfig(), novo);
  fs.mkdirSync(DADOS, { recursive: true });
  fs.writeFileSync(ARQUIVO, JSON.stringify(config, null, 2));
  return config;
}

// Base de conhecimento que todos os agentes recebem: todos os .md da pasta de conhecimento
// (squad/contexto ou um cofre do Obsidian), incluindo subpastas. Ignora pastas ocultas como .obsidian.
const LIMITE_CONTEXTO = 60_000;

function arquivosMd(pasta, base = pasta) {
  if (!fs.existsSync(pasta)) return [];
  const saida = [];
  for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
    if (item.name.startsWith(".")) continue;
    const completo = path.join(pasta, item.name);
    if (item.isDirectory()) saida.push(...arquivosMd(completo, base));
    else if (/\.md$/i.test(item.name) && !/\.exemplo\.md$/i.test(item.name)) saida.push(completo);
  }
  return saida.sort();
}

export function lerContexto(config = lerConfig()) {
  const pasta = config.conhecimento?.trim() || CONTEXTO;
  const arquivos = arquivosMd(pasta);
  if (!arquivos.length) {
    const exemplo = path.join(CONTEXTO, "origo.exemplo.md");
    return fs.existsSync(exemplo) ? fs.readFileSync(exemplo, "utf8").trim() : "";
  }
  let texto = "";
  for (const arquivo of arquivos) {
    const parte = `\n\n<!-- ${path.relative(pasta, arquivo)} -->\n${fs.readFileSync(arquivo, "utf8").trim()}`;
    if (texto.length + parte.length > LIMITE_CONTEXTO) {
      texto += `\n\n(Base de conhecimento cortada em ${LIMITE_CONTEXTO} caracteres: deixe na pasta só o que os agentes precisam.)`;
      break;
    }
    texto += parte;
  }
  return texto.trim();
}

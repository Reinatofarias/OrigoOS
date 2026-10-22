// Origo Squad: servidor local do painel. Rode com  npm start  (ou dois cliques em iniciar.bat).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { RAIZ, ENTREGAS } from "./nucleo/caminhos.mjs";
import { carregarEnv, lerConfig, salvarConfig } from "./nucleo/config.mjs";
import { carregarAgentes } from "./nucleo/agentes.mjs";
import { saudeMotores, observarSaude, listarModelosOmniroute, verificarOmniroute, NOMES } from "./nucleo/motores.mjs";
import { eventos, criarMissao, listarMissoes, lerMissao, pararMissao } from "./nucleo/orquestrador.mjs";

carregarEnv();
const config = lerConfig();
const PORTA = Number(process.env.PORTA || config.porta || 4321);
const PAINEL = path.join(RAIZ, "painel");
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

const clientes = new Set();
function transmitir(tipo, dados) {
  const linha = `event: ${tipo}\ndata: ${JSON.stringify(dados)}\n\n`;
  for (const res of clientes) res.write(linha);
}
eventos.on("evento", (ev) => transmitir("evento", ev));
eventos.on("missao", (m) => transmitir("missao", resumoMissao(m)));
observarSaude((s) => transmitir("motores", s));

function resumoMissao(m) {
  const { log, ...resto } = m;
  return { ...resto, tarefas: m.tarefas.map(({ resultado, ...t }) => t) };
}

function json(res, status, dados) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(dados));
}

async function corpo(req) {
  let texto = "";
  for await (const parte of req) texto += parte;
  return texto ? JSON.parse(texto) : {};
}

function agentesPublicos() {
  return Object.values(carregarAgentes()).map(({ instrucoes, ...a }) => a);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === "/api/eventos") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write(`event: motores\ndata: ${JSON.stringify(saudeMotores())}\n\n`);
      clientes.add(res);
      const pulso = setInterval(() => res.write(": pulso\n\n"), 20000);
      req.on("close", () => {
        clearInterval(pulso);
        clientes.delete(res);
      });
      return;
    }
    if (url.pathname === "/api/estado") {
      return json(res, 200, { agentes: agentesPublicos(), motores: saudeMotores(), nomesMotores: NOMES, config: lerConfig(), temChaveOmniroute: Boolean(process.env.OMNIROUTE_KEY), missoes: listarMissoes().slice(0, 40).map(resumoMissao) });
    }
    if (url.pathname === "/api/missao" && req.method === "POST") {
      const { texto, motor } = await corpo(req);
      if (!texto?.trim()) return json(res, 400, { erro: "Escreva o comando" });
      return json(res, 200, resumoMissao(criarMissao(texto.trim(), { motor })));
    }
    if (url.pathname.startsWith("/api/missao/")) {
      const id = decodeURIComponent(url.pathname.split("/")[3] || "");
      if (url.pathname.endsWith("/parar") && req.method === "POST") {
        pararMissao(id);
        return json(res, 200, { ok: true });
      }
      const missao = lerMissao(id);
      return missao ? json(res, 200, missao) : json(res, 404, { erro: "Missão não encontrada" });
    }
    if (url.pathname === "/api/entrega") {
      const alvo = path.resolve(ENTREGAS, url.searchParams.get("arquivo") || "");
      if (!alvo.startsWith(ENTREGAS + path.sep) || !fs.existsSync(alvo)) return json(res, 404, { erro: "Arquivo não encontrado" });
      res.writeHead(200, { "content-type": "text/markdown; charset=utf-8" });
      return res.end(fs.readFileSync(alvo));
    }
    if (url.pathname === "/api/abrir-pasta" && req.method === "POST") {
      const { pasta } = await corpo(req);
      const alvo = path.resolve(ENTREGAS, pasta || "");
      if (alvo !== ENTREGAS && !alvo.startsWith(ENTREGAS + path.sep)) return json(res, 400, { erro: "Pasta inválida" });
      fs.mkdirSync(alvo, { recursive: true });
      const comando = process.platform === "win32" ? `explorer "${alvo}"` : process.platform === "darwin" ? `open "${alvo}"` : `xdg-open "${alvo}"`;
      exec(comando);
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/api/config" && req.method === "POST") {
      const { paralelo, conhecimento, omniroute, claude, codex, agentes } = await corpo(req);
      return json(res, 200, salvarConfig({ paralelo, conhecimento, omniroute, claude, codex, agentes }));
    }
    if (url.pathname === "/api/omniroute/modelos") {
      try {
        return json(res, 200, { modelos: await listarModelosOmniroute(lerConfig()) });
      } catch (erro) {
        return json(res, 200, { modelos: [], erro: erro?.message || String(erro) });
      }
    }

    // Arquivos do painel
    const arquivo = path.resolve(PAINEL, url.pathname === "/" ? "index.html" : `.${url.pathname}`);
    if (!arquivo.startsWith(PAINEL + path.sep) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      res.writeHead(404);
      return res.end("Não encontrado");
    }
    res.writeHead(200, { "content-type": TIPOS[path.extname(arquivo)] || "application/octet-stream" });
    res.end(fs.readFileSync(arquivo));
  } catch (erro) {
    json(res, 500, { erro: erro?.message || String(erro) });
  }
});

verificarOmniroute(lerConfig());
setInterval(() => verificarOmniroute(lerConfig()), 60_000);

// Só no próprio computador: ninguém da rede acessa o painel.
servidor.listen(PORTA, "127.0.0.1", () => {
  const endereco = `http://localhost:${PORTA}`;
  console.log(`\n  Origo Squad no ar: ${endereco}\n  Para desligar, feche esta janela ou aperte Ctrl+C.\n`);
  if (process.env.ABRIR_NAVEGADOR !== "0") {
    const comando = process.platform === "win32" ? `start "" "${endereco}"` : process.platform === "darwin" ? `open ${endereco}` : `xdg-open ${endereco}`;
    exec(comando, () => {});
  }
});

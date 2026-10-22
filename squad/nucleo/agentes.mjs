// Lê os agentes de squad/agentes/*.md (cabeçalho entre --- e instruções abaixo).
import fs from "node:fs";
import path from "node:path";
import { RAIZ } from "./caminhos.mjs";

const PASTA = path.join(RAIZ, "agentes");

function lerCabecalho(texto) {
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { dados: {}, corpo: texto.trim() };
  const dados = {};
  for (const linha of m[1].split(/\r?\n/)) {
    const i = linha.indexOf(":");
    if (i < 1) continue;
    const chave = linha.slice(0, i).trim();
    let valor = linha.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (valor === "true") valor = true;
    else if (valor === "false") valor = false;
    dados[chave] = valor;
  }
  return { dados, corpo: m[2].trim() };
}

export function carregarAgentes() {
  const agentes = {};
  for (const arquivo of fs.readdirSync(PASTA).filter((a) => a.endsWith(".md")).sort()) {
    const { dados, corpo } = lerCabecalho(fs.readFileSync(path.join(PASTA, arquivo), "utf8"));
    const id = dados.id || path.basename(arquivo, ".md");
    agentes[id] = {
      id,
      nome: dados.nome || id,
      papel: dados.papel || "",
      cor: dados.cor || "#22c7ff",
      motores: String(dados.motores || "omniroute, claude, codex")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      modeloOmniroute: dados.modelo_omniroute || "",
      precisaWeb: dados.precisa_web === true,
      origoOs: dados.origo_os || "",
      instrucoes: corpo,
    };
  }
  if (!agentes.coordenador) throw new Error("Falta o arquivo agentes/coordenador.md");
  return agentes;
}

export function especialistas(agentes) {
  return Object.values(agentes).filter((a) => a.id !== "coordenador");
}

import path from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DADOS = path.join(RAIZ, "dados");
export const ENTREGAS = path.join(RAIZ, "entregas");
export const CONTEXTO = path.join(RAIZ, "contexto");

// Rotinas agendadas por prompt ("toda segunda às 8h, o Secretário monta minha semana").
// O Coordenador transforma o pedido em agendamento; aqui ficam a lista e o relógio que
// dispara as missões na hora certa (horário de Recife). Só roda com o squad aberto:
// se o computador estava desligado na hora, a rotina roda quando o squad abrir (até 12h depois).
import fs from "node:fs";
import path from "node:path";
import { DADOS } from "./caminhos.mjs";

const ARQUIVO = path.join(DADOS, "agendamentos.json");
const FUSO = "America/Recife";
const ATRASO_MAXIMO = 12 * 60 * 60 * 1000;
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function listarAgendamentos() {
  try {
    return JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
  } catch {
    return [];
  }
}

function salvarTodos(lista) {
  fs.mkdirSync(DADOS, { recursive: true });
  fs.writeFileSync(ARQUIVO, JSON.stringify(lista, null, 2));
}

// Recife não tem horário de verão: UTC-3 o ano todo.
function partesRecife(data) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(data).map((x) => [x.type, x.value]));
  return { dataIso: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}`, diaSemana: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}

function instante(dataIso, hora) {
  return new Date(`${dataIso}T${hora}:00-03:00`).getTime();
}

// Última vez que a rotina deveria ter rodado até agora (ou null).
function ultimaOcorrencia(a, agora) {
  if (a.data) {
    const t = instante(a.data, a.hora);
    return t <= agora ? t : null;
  }
  for (let volta = 0; volta < 8; volta++) {
    const dia = new Date(agora - volta * 86_400_000);
    const { dataIso, diaSemana } = partesRecife(dia);
    if (a.dias?.length && !a.dias.includes(diaSemana)) continue;
    const t = instante(dataIso, a.hora);
    if (t <= agora) return t;
  }
  return null;
}

export function proximaOcorrencia(a, agora = Date.now()) {
  if (!a.ativo) return null;
  if (a.data) {
    const t = instante(a.data, a.hora);
    return t > agora && !a.ultimaVez ? t : null;
  }
  for (let volta = 0; volta < 8; volta++) {
    const { dataIso, diaSemana } = partesRecife(new Date(agora + volta * 86_400_000));
    if (a.dias?.length && !a.dias.includes(diaSemana)) continue;
    const t = instante(dataIso, a.hora);
    if (t > agora) return t;
  }
  return null;
}

export function descreverQuando(a) {
  if (a.data) return `em ${a.data.split("-").reverse().join("/")} às ${a.hora}`;
  if (!a.dias?.length || a.dias.length === 7) return `todo dia às ${a.hora}`;
  if (a.dias.join() === "1,2,3,4,5") return `de segunda a sexta às ${a.hora}`;
  return `toda ${a.dias.map((d) => DIAS[d]).join(", ")} às ${a.hora}`;
}

// Valida o que o Coordenador mandou: {comando, hora "HH:MM", dias [0-6] ou data "AAAA-MM-DD"}.
export function criarAgendamento({ comando, hora, dias, data, motor = "auto" }) {
  if (!comando?.trim()) throw new Error("Falta o comando da rotina");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora || "")) throw new Error("Hora inválida (use HH:MM)");
  const diasOk = Array.isArray(dias) ? [...new Set(dias.map(Number).filter((d) => d >= 0 && d <= 6))].sort() : [];
  const dataOk = typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null;
  const a = { id: `ag-${Date.now().toString(36)}`, comando: comando.trim(), hora, dias: dataOk ? [] : diasOk, data: dataOk, motor, ativo: true, criadoEm: new Date().toISOString(), ultimaVez: null, ultimaMissao: null };
  a.quando = descreverQuando(a);
  salvarTodos([...listarAgendamentos(), a]);
  return a;
}

export function alterarAgendamento(id, mudancas) {
  const lista = listarAgendamentos();
  const a = lista.find((x) => x.id === id);
  if (!a) throw new Error("Rotina não encontrada");
  if (typeof mudancas.ativo === "boolean") a.ativo = mudancas.ativo;
  if (typeof mudancas.comando === "string" && mudancas.comando.trim()) a.comando = mudancas.comando.trim();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(mudancas.hora || "")) a.hora = mudancas.hora;
  if (Array.isArray(mudancas.dias)) a.dias = mudancas.dias.map(Number).filter((d) => d >= 0 && d <= 6);
  a.quando = descreverQuando(a);
  salvarTodos(lista);
  return a;
}

export function apagarAgendamento(id) {
  salvarTodos(listarAgendamentos().filter((x) => x.id !== id));
}

// Relógio: a cada 30 segundos vê se alguma rotina venceu e dispara a missão.
export function iniciarRelogio(disparar, aoMudar = () => {}) {
  const conferir = () => {
    const agora = Date.now();
    const lista = listarAgendamentos();
    let mudou = false;
    for (const a of lista) {
      if (!a.ativo) continue;
      const t = ultimaOcorrencia(a, agora);
      if (!t || agora - t > ATRASO_MAXIMO) continue;
      if (a.ultimaVez && new Date(a.ultimaVez).getTime() >= t) continue;
      if (!a.ultimaVez && new Date(a.criadoEm).getTime() > t) continue; // criada depois da hora: espera a próxima
      const missao = disparar(a);
      a.ultimaVez = new Date(agora).toISOString();
      a.ultimaMissao = missao?.id || null;
      if (a.data) a.ativo = false; // rotina de uma vez só
      mudou = true;
    }
    if (mudou) {
      salvarTodos(lista);
      aoMudar(lista);
    }
  };
  conferir();
  return setInterval(conferir, 30_000);
}

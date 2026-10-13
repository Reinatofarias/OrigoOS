import { addDays, today, weekday } from "./dates";

// Repetição de uma tarefa, como no ClickUp: ao concluir, nasce a próxima com o novo prazo.
export type Repeticao = {
  tipo: "dias" | "semanas" | "meses";
  a_cada: number;
  // Só em 'semanas' com a_cada 1: dias da semana (0 = domingo ... 6 = sábado).
  dias_semana?: number[];
  // Só em 'meses': dia do mês (no mês curto, cai no último dia).
  dia_mes?: number;
};

export const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIA_LONGO = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

function proximoPasso(r: Repeticao, base: string): string {
  const n = Math.max(1, Math.floor(r.a_cada) || 1);
  if (r.tipo === "dias") return addDays(base, n);
  if (r.tipo === "semanas") {
    const dias = r.dias_semana?.length ? r.dias_semana : null;
    if (n === 1 && dias) {
      for (let i = 1; i <= 7; i++) {
        const d = addDays(base, i);
        if (dias.includes(weekday(d))) return d;
      }
    }
    return addDays(base, 7 * n);
  }
  const [y, m, d] = base.split("-").map(Number);
  const dia = r.dia_mes ?? d;
  const alvo = new Date(Date.UTC(y, m - 1 + n, 1));
  const ultimo = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
  ).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimo));
  return alvo.toISOString().slice(0, 10);
}

// Próximo prazo depois de concluir. Se a tarefa estava atrasada, pula até cair depois de hoje.
export function proximaData(
  r: Repeticao,
  base: string | null,
  hoje = today(),
): string {
  let d = proximoPasso(r, base ?? hoje);
  for (let i = 0; d <= hoje && i < 1000; i++) d = proximoPasso(r, d);
  return d;
}

export function descreverRepeticao(r: Repeticao): string {
  const n = Math.max(1, r.a_cada);
  if (r.tipo === "dias") return n === 1 ? "Todo dia" : `A cada ${n} dias`;
  if (r.tipo === "semanas") {
    const dias = [...(r.dias_semana ?? [])].sort();
    if (n === 1 && dias.join() === "1,2,3,4,5") return "Dias úteis (seg a sex)";
    if (n === 1 && dias.length)
      return `Toda semana: ${dias.map((d) => DIA_LONGO[d]).join(", ")}`;
    return n === 1 ? "Toda semana" : `A cada ${n} semanas`;
  }
  const dia = r.dia_mes ? ` (dia ${r.dia_mes})` : "";
  return n === 1 ? `Todo mês${dia}` : `A cada ${n} meses${dia}`;
}

import { addDays, weekday } from './dates';
import type { Prioridade } from './db';

// Entende frases como "ligar pro Matheus amanhã urgente" ou "mandar relatório da Josimara sexta".

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const DIAS: [RegExp, number][] = [
  [/\bdomingo\b/, 0],
  [/\bsegunda(-feira)?\b/, 1],
  [/\bterca(-feira)?\b/, 2],
  [/\bquarta(-feira)?\b/, 3],
  [/\bquinta(-feira)?\b/, 4],
  [/\bsexta(-feira)?\b/, 5],
  [/\bsabado\b/, 6],
];

const LIGA = '(?:\\s+(?:na|no|pra|para|ate|de|em|dia|nessa|nesta|essa|esta|proxima|proximo))*';

export type Interpretacao = { titulo: string; data: string | null; prioridade: Prioridade; client_id: string | null };

// Troca o trecho reconhecido (e as palavras de ligação antes dele) por nada, mantendo o texto original.
function tirar(original: string, normal: string, re: RegExp) {
  const m = new RegExp(`${LIGA}\\s*${re.source}`).exec(normal);
  if (!m) return { original, normal };
  const ini = m.index;
  const fim = m.index + m[0].length;
  return { original: original.slice(0, ini) + original.slice(fim), normal: normal.slice(0, ini) + normal.slice(fim) };
}

export function interpretar(texto: string, clientes: { id: string; nome: string }[], hoje: string): Interpretacao {
  let original = ` ${texto.trim()} `;
  let normal = sem(original);
  let data: string | null = null;
  let prioridade: Prioridade = 'normal';

  const achar = (re: RegExp, valor: () => string | null) => {
    if (data || !re.test(normal)) return;
    data = valor();
    ({ original, normal } = tirar(original, normal, re));
  };

  achar(/\bdepois de amanha\b/, () => addDays(hoje, 2));
  achar(/\bamanha\b/, () => addDays(hoje, 1));
  achar(/\bhoje\b/, () => hoje);
  for (const [re, dia] of DIAS) {
    achar(re, () => {
      const diff = (dia - weekday(hoje) + 7) % 7 || 7;
      return addDays(hoje, diff);
    });
  }
  const dm = /\b(\d{1,2})\/(\d{1,2})\b/.exec(normal);
  if (!data && dm) {
    const [, d, m] = dm;
    let ano = Number(hoje.slice(0, 4));
    const cand = `${ano}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (cand < hoje) ano++;
    data = `${ano}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    ({ original, normal } = tirar(original, normal, /\b\d{1,2}\/\d{1,2}\b/));
  }
  const dia = /\bdia (\d{1,2})\b/.exec(normal);
  if (!data && dia && Number(dia[1]) >= 1 && Number(dia[1]) <= 31) {
    const d = dia[1].padStart(2, '0');
    let cand = `${hoje.slice(0, 7)}-${d}`;
    if (cand < hoje) {
      const [y, m] = hoje.split('-').map(Number);
      const prox = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
      cand = `${prox}-${d}`;
    }
    data = cand;
    ({ original, normal } = tirar(original, normal, /\bdia \d{1,2}\b/));
  }

  if (/\burgente\b/.test(normal)) {
    prioridade = 'urgente';
    ({ original, normal } = tirar(original, normal, /\burgente\b/));
  } else if (/\bimportante\b/.test(normal)) {
    prioridade = 'alta';
    ({ original, normal } = tirar(original, normal, /\bimportante\b/));
  }

  // Cliente: alguma palavra marcante do nome dele aparece no texto.
  const IGNORAR = new Set(['dra', 'dr', 'delegada', 'doutor', 'doutora', 'store', 'for', 'men', 'lima', 'palmas']);
  let client_id: string | null = null;
  let melhor = 0;
  for (const c of clientes) {
    for (const p of sem(c.nome).split(/[^a-z0-9]+/)) {
      if (p.length < 4 || IGNORAR.has(p)) continue;
      if (new RegExp(`\\b${p}\\b`).test(normal) && p.length > melhor) {
        melhor = p.length;
        client_id = c.id;
      }
    }
  }

  const limpo = original.replace(/\s+/g, ' ').replace(/^[\s,.;:-]+|[\s,;:-]+$/g, '');
  const titulo = limpo.charAt(0).toUpperCase() + limpo.slice(1);
  return { titulo: titulo || texto.trim(), data, prioridade, client_id };
}

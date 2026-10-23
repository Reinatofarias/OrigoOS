// Imagens de verdade: o agente escreve um bloco ```imagem com o prompt e o squad gera o arquivo,
// salvando em entregas/<missão>/imagens/. O bloco vira a imagem no Markdown da entrega.
// Primeiro tenta o OmniRoute (modelo de imagem, endpoint /images/generations); se não tiver,
// usa o Codex (gerador de imagem do plano do ChatGPT).
import fs from "node:fs";
import path from "node:path";
import { gerarImagemCodex } from "./motores.mjs";

const PADRAO_IMAGEM = /image|imagen|dall-e|gpt-image|flux|sdxl|stable-diffusion|seedream|ideogram|recraft|midjourney/i;
const TAMANHOS = new Set(["1024x1024", "1024x1536", "1536x1024", "1024x1792", "1792x1024", "512x512"]);

export function instrucaoImagens() {
  return `# Imagens
Quando a entrega precisar de imagem (post, slide de carrossel, criativo de anúncio, capa), peça cada uma com um bloco assim, no ponto do texto onde ela entra. O squad gera a imagem de verdade e coloca o arquivo no lugar do bloco:
\`\`\`imagem
{"nome": "slide-1", "tamanho": "1024x1536", "prompt": "descrição visual completa em inglês: cena, estilo, cores da marca, luz, enquadramento. Sem texto escrito na imagem, a não ser que seja essencial"}
\`\`\`
Tamanhos: 1024x1024 (quadrado), 1024x1536 (retrato, feed e carrossel), 1536x1024 (paisagem), 1024x1792 (stories e reels). No máximo 6 imagens por entrega.`;
}

function nomeSeguro(nome, i) {
  const limpo = String(nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return limpo || `imagem-${i + 1}`;
}

export function acharBlocosImagem(texto) {
  const blocos = [];
  const re = /```imagem\s*([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(texto)) && blocos.length < 6) {
    try {
      const d = JSON.parse(m[1]);
      if (d?.prompt) blocos.push({ bruto: m[0], prompt: String(d.prompt).slice(0, 4000), nome: d.nome, tamanho: TAMANHOS.has(d.tamanho) ? d.tamanho : "1024x1024" });
    } catch {
      // JSON quebrado: o bloco fica no texto para o Renato ver
    }
  }
  return blocos;
}

async function escolherModelo(cliente, config) {
  const fixo = config.omniroute.modeloImagem;
  if (fixo && fixo !== "auto") return fixo;
  const lista = [];
  for await (const m of cliente.models.list()) lista.push(m.id);
  const achado = lista.find((id) => PADRAO_IMAGEM.test(id));
  if (!achado) throw new Error("nenhum modelo de imagem no OmniRoute. Conecte um provedor com imagem (ex.: OpenAI, Gemini, Together) e escolha o modelo em Configurações");
  return achado;
}

async function gerarUma(cliente, modelo, { prompt, tamanho }, sinal) {
  const r = await cliente.images.generate({ model: modelo, prompt, size: tamanho, n: 1 }, { signal: sinal, timeout: 180_000 });
  const item = r.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) {
    if (item.url.startsWith("data:")) return Buffer.from(item.url.split(",")[1], "base64");
    const resp = await fetch(item.url, { signal: sinal });
    if (!resp.ok) throw new Error(`não consegui baixar a imagem (${resp.status})`);
    return Buffer.from(await resp.arrayBuffer());
  }
  throw new Error("o modelo não devolveu imagem");
}

// Gera as imagens pedidas no texto e devolve o texto com cada bloco trocado pela imagem salva.
// pastaMissao: caminho absoluto de entregas/<missão>; prefixo: nome do agente nos arquivos.
function linhaImagem(rotulo, arquivo, caminho) {
  return `![${rotulo}](imagens/${arquivo})\n\n*Arquivo: \`${caminho}\`*`;
}

// Copia para a missão as imagens que o Codex gerou sozinho durante a tarefa.
export function trazerImagensCodex({ texto, arquivos, pastaMissao, prefixo, avisar }) {
  if (!arquivos?.length) return { texto, imagens: [] };
  const pasta = path.join(pastaMissao, "imagens");
  fs.mkdirSync(pasta, { recursive: true });
  const imagens = arquivos.slice(0, 12).map((origem, i) => {
    const arquivo = `${prefixo}-codex-${i + 1}${path.extname(origem).toLowerCase()}`;
    const caminho = path.join(pasta, arquivo);
    fs.copyFileSync(origem, caminho);
    avisar({ tipo: "imagem", texto: `Imagem salva: ${caminho}`, arquivo: `imagens/${arquivo}` });
    return { arquivo: `imagens/${arquivo}`, caminho, prompt: "", modelo: "Codex" };
  });
  const galeria = imagens.map((im, i) => linhaImagem(`Imagem ${i + 1}`, path.basename(im.arquivo), im.caminho)).join("\n\n");
  return { texto: `${texto}\n\n## Imagens geradas\n\n${galeria}`, imagens };
}

export async function gerarImagens({ texto, pastaMissao, prefixo, config, avisar, sinal }) {
  const blocos = acharBlocosImagem(texto);
  if (!blocos.length) return { texto, imagens: [] };

  // Escolhe quem desenha: OmniRoute com modelo de imagem, senão o Codex.
  let gerar = null;
  let quem = "";
  if (config.omniroute?.ativo !== false && config.omniroute?.modeloImagem !== "codex") {
    try {
      const { default: OpenAI } = await import("openai");
      const cliente = new OpenAI({ baseURL: config.omniroute.url, apiKey: process.env.OMNIROUTE_KEY || "sem-chave", maxRetries: 1 });
      const modelo = await escolherModelo(cliente, config);
      gerar = (b) => gerarUma(cliente, modelo, b, sinal);
      quem = modelo;
    } catch (erro) {
      avisar({ tipo: "troca", texto: `OmniRoute sem imagem (${(erro?.message || String(erro)).slice(0, 140)}). Vou desenhar com o Codex.` });
    }
  }
  if (!gerar && config.codex?.ativo !== false) {
    gerar = (b) => gerarImagemCodex({ prompt: b.prompt, tamanho: b.tamanho, config, avisar, sinal });
    quem = "Codex";
  }
  if (!gerar) {
    avisar({ tipo: "erro", texto: "Não tenho onde gerar imagens (OmniRoute sem modelo de imagem e Codex desligado). Os prompts ficaram na entrega." });
    return { texto, imagens: [] };
  }

  const pasta = path.join(pastaMissao, "imagens");
  fs.mkdirSync(pasta, { recursive: true });
  const imagens = [];
  let saida = texto;
  for (const [i, b] of blocos.entries()) {
    if (sinal?.aborted) break;
    const arquivo = `${prefixo}-${nomeSeguro(b.nome, i)}.png`;
    avisar({ tipo: "ferramenta", texto: `Gerando imagem ${i + 1} de ${blocos.length} com ${quem}` });
    try {
      const dados = await gerar(b);
      fs.writeFileSync(path.join(pasta, arquivo), dados);
      const caminho = path.join(pasta, arquivo);
      imagens.push({ arquivo: `imagens/${arquivo}`, caminho, prompt: b.prompt, modelo: quem });
      saida = saida.replace(b.bruto, linhaImagem(b.nome || arquivo, arquivo, caminho));
      avisar({ tipo: "imagem", texto: `Imagem salva: ${caminho}`, arquivo: `imagens/${arquivo}` });
    } catch (erro) {
      avisar({ tipo: "erro", texto: `Imagem ${i + 1} falhou (${(erro?.message || String(erro)).slice(0, 160)}). O prompt ficou na entrega.` });
      saida = saida.replace(b.bruto, `> Imagem não gerada (${(erro?.message || "erro").slice(0, 120)}). Prompt:\n\n\`\`\`\n${b.prompt}\n\`\`\``);
    }
  }
  return { texto: saida, imagens };
}

// Painel do Origo Squad: fluxo visual, missões e o que cada agente está fazendo ao vivo.
const $ = (s) => document.querySelector(s);

const ROTULOS = {
  planejando: "Planejando",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  concluida_com_falhas: "Concluída com falhas",
  falhou: "Falhou",
  parada: "Parada",
  na_fila: "Na fila",
  trabalhando: "Trabalhando",
};
const ESTADO_MOTOR = { ok: "pronto", pausado: "em pausa", erro: "com erro" };

const estado = {
  agentes: [],
  porId: {},
  motores: {},
  nomesMotores: {},
  config: null,
  missoes: [],
  atual: null, // missão aberta, com log
  filtro: null, // id do agente filtrado no feed
  escrevendo: {}, // agente -> trecho do texto que está saindo agora
  rotinas: [],
  editandoRotina: null, // id da rotina aberta na janela, ou null para nova
};

// ---------- utilidades ----------
function esc(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function hora(iso) {
  return iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
}
function quando(iso) {
  const d = new Date(iso);
  const hoje = new Date().toDateString() === d.toDateString();
  return hoje ? `hoje ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function duracao(a, b) {
  if (!a) return "";
  const s = Math.max(0, Math.round(((b ? new Date(b) : new Date()) - new Date(a)) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`;
}
function iniciais(nome) {
  return nome.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}
async function api(caminho, opcoes = {}) {
  const r = await fetch(caminho, { headers: { "content-type": "application/json" }, ...opcoes });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dados.erro || `Erro ${r.status}`);
  return dados;
}

// Endereço de um arquivo das entregas (Markdown ou imagem) servido pelo squad.
function urlEntrega(caminho) {
  return `/api/entrega?arquivo=${encodeURIComponent(caminho)}`;
}

// Markdown simples e seguro (o texto é escapado antes de virar HTML).
// base: pasta da missão, para as imagens geradas (imagens/arquivo.png) aparecerem.
let baseImagens = "";
function inline(t) {
  return t
    .replace(/!\[([^\]]*)\]\((imagens\/[^\s)]+)\)/g, (_, alt, src) => {
      const caminho = `${baseImagens}/${src}`;
      return `<button type="button" class="miniatura grande" data-imagem="${esc(caminho)}" title="${alt}"><img src="${urlEntrega(caminho)}" alt="${alt}" loading="lazy" /></button>`;
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
}
function markdown(fonte, base = "") {
  baseImagens = base;
  const linhas = esc(fonte || "").split(/\r?\n/);
  const saida = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (/^```/.test(l)) {
      const bloco = [];
      i++;
      while (i < linhas.length && !/^```/.test(linhas[i])) bloco.push(linhas[i++]);
      i++;
      saida.push(`<pre><code>${bloco.join("\n")}</code></pre>`);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?\s*:?-{2,}/.test(linhas[i + 1] || "")) {
      const celulas = (x) => x.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
      const cab = celulas(l);
      i += 2;
      const corpo = [];
      while (i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i])) corpo.push(celulas(linhas[i++]));
      saida.push(`<table><thead><tr>${cab.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${corpo.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const n = Math.min(3, h[1].length);
      saida.push(`<h${n}>${inline(h[2])}</h${n}>`);
      i++;
      continue;
    }
    if (/^&gt;\s?/.test(l)) {
      const bloco = [];
      while (i < linhas.length && /^&gt;\s?/.test(linhas[i])) bloco.push(linhas[i++].replace(/^&gt;\s?/, ""));
      saida.push(`<blockquote>${inline(bloco.join("<br>"))}</blockquote>`);
      continue;
    }
    if (/^\s*([-*]|\d+[.)])\s+/.test(l)) {
      const ordenada = /^\s*\d/.test(l);
      const itens = [];
      while (i < linhas.length && /^\s*([-*]|\d+[.)])\s+/.test(linhas[i])) {
        let item = linhas[i++].replace(/^\s*([-*]|\d+[.)])\s+/, "");
        item = item.replace(/^\[ \]\s*/, "☐ ").replace(/^\[x\]\s*/i, "☑ ");
        itens.push(`<li>${inline(item)}</li>`);
      }
      saida.push(ordenada ? `<ol>${itens.join("")}</ol>` : `<ul>${itens.join("")}</ul>`);
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(l)) {
      saida.push("<hr>");
      i++;
      continue;
    }
    if (!l.trim()) {
      i++;
      continue;
    }
    const par = [];
    while (i < linhas.length && linhas[i].trim() && !/^(#{1,4}\s|```|&gt;|\s*([-*]|\d+[.)])\s+|\s*\|)/.test(linhas[i])) par.push(linhas[i++]);
    if (!par.length) par.push(linhas[i++]);
    saida.push(`<p>${inline(par.join("<br>"))}</p>`);
  }
  return saida.join("");
}

// ---------- motores ----------
function desenharMotores() {
  const el = $("#motores");
  el.innerHTML = ["omniroute", "claude", "codex"]
    .map((m) => {
      const s = estado.motores[m] || { estado: "ok" };
      const ligado = estado.config?.[m]?.ativo !== false;
      const classe = ligado ? s.estado : "desligado";
      let texto = ligado ? ESTADO_MOTOR[s.estado] || s.estado : "desligado";
      if (ligado && s.estado === "pausado" && /não encontrado/.test(s.motivo || "")) texto = "não encontrado";
      else if (ligado && s.estado === "pausado" && s.ate) texto = `em pausa até ${new Date(s.ate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      return `<span class="pilula ${classe}" title="${esc(s.motivo || "")}"><i></i>${esc(estado.nomesMotores[m] || m)}: ${esc(texto)}</span>`;
    })
    .join("");
}

// ---------- fluxo ----------
function estadoDosNos() {
  const nos = {};
  for (const a of estado.agentes) nos[a.id] = { status: "ocioso", agora: a.id === "coordenador" ? "Aguardando seu comando" : "", motor: "" };
  const m = estado.atual;
  if (!m) return nos;
  for (const t of m.tarefas || []) nos[t.agente] = { status: t.status === "na_fila" ? "fila" : t.status, agora: "", motor: t.motor };
  for (const ev of m.log || []) {
    const n = nos[ev.agente];
    if (!n) continue;
    if (ev.texto) n.agora = ev.texto;
    if (ev.motor) n.motor = ev.motor;
    if (["inicio", "status", "ferramenta", "escrevendo", "motor", "troca"].includes(ev.tipo)) n.status = "trabalhando";
    if (ev.tipo === "fim") n.status = "concluida";
    if (ev.tipo === "erro") n.status = "falhou";
    if (ev.tipo === "fila") n.status = "fila";
  }
  for (const [id, trecho] of Object.entries(estado.escrevendo)) {
    if (nos[id]?.status === "trabalhando") nos[id].agora = trecho ? `Escrevendo: …${trecho.replace(/\s+/g, " ").slice(-90)}` : "Escrevendo…";
  }
  if (["concluida", "concluida_com_falhas"].includes(m.status) && nos.coordenador.status === "trabalhando") nos.coordenador.status = "concluida";
  if (m.status === "parada") for (const n of Object.values(nos)) if (n.status === "trabalhando" || n.status === "fila") n.status = "falhou";
  return nos;
}

function posicoes(largura, altura) {
  const time = estado.agentes.filter((a) => a.id !== "coordenador");
  const pos = { renato: [largura / 2, 54], coordenador: [largura / 2, altura * (largura < 620 ? 0.32 : 0.42)] };
  const estreito = largura < 620;
  time.forEach((a, i) => {
    if (estreito) {
      const porLinha = 3;
      const linha = Math.floor(i / porLinha);
      const naLinha = Math.min(porLinha, time.length - linha * porLinha);
      const col = i % porLinha;
      pos[a.id] = [(largura * (col + 0.5)) / naLinha, altura * (0.66 + linha * 0.24)];
    } else {
      const f = time.length === 1 ? 0.5 : i / (time.length - 1);
      pos[a.id] = [largura * (0.09 + 0.82 * f), altura * (0.86 - 0.06 * Math.sin(Math.PI * f))];
    }
  });
  return pos;
}

function desenharFluxo() {
  const palco = $("#palco");
  const { width: L, height: A } = palco.getBoundingClientRect();
  const pos = posicoes(L, A);
  const nos = estadoDosNos();
  const coord = nos.coordenador || { status: "ocioso" };

  const caminho = (de, para, classe) => {
    const [x1, y1] = pos[de];
    const [x2, y2] = pos[para];
    const meio = (y1 + y2) / 2;
    return `<path class="${classe}" d="M${x1},${y1 + 34} C${x1},${meio} ${x2},${meio} ${x2},${y2 - 34}" />`;
  };
  const classeLinha = (s) => (s === "trabalhando" ? "ativa" : s === "concluida" ? "feita" : s === "falhou" ? "falha" : "");
  let svg = `<defs><linearGradient id="gradLinha" x1="0" x2="1"><stop offset="0" stop-color="#22c7ff"/><stop offset=".5" stop-color="#a23cff"/><stop offset="1" stop-color="#e340c8"/></linearGradient></defs>`;
  svg += caminho("renato", "coordenador", estado.atual && coord.status === "trabalhando" ? "ativa" : estado.atual ? "feita" : "");
  for (const a of estado.agentes) if (a.id !== "coordenador") svg += caminho("coordenador", a.id, classeLinha(nos[a.id]?.status));
  $("#linhas").innerHTML = svg;

  const html = [];
  html.push(`<div class="no renato" style="left:${pos.renato[0]}px;top:${pos.renato[1]}px"><div class="bola">R</div><strong>Renato</strong><span class="papel">Você</span></div>`);
  for (const a of estado.agentes) {
    const n = nos[a.id] || { status: "ocioso" };
    const [x, y] = pos[a.id];
    const statusClasse = n.status === "fila" ? "ocioso" : n.status;
    const bola = a.id === "coordenador" ? `<img src="marca.png" alt="" />` : esc(iniciais(a.nome));
    const motor = n.motor ? `<span class="motorTag">${esc(estado.nomesMotores[n.motor] || n.motor)}</span>` : "";
    const agora = n.status === "fila" ? "Na fila" : n.agora;
    html.push(
      `<button type="button" class="no ${a.id} ${statusClasse} ${estado.filtro === a.id ? "filtrado" : ""}" data-agente="${a.id}" style="left:${x}px;top:${y + (a.id === "coordenador" ? 6 : 0)}px;--cor:${esc(a.cor)}" title="${esc(a.papel)}">
        <div class="bola">${bola}</div><strong>${esc(a.nome)}</strong>${motor}
        <span class="agora">${esc(agora || a.papel)}</span>
      </button>`,
    );
  }
  $("#nos").innerHTML = html.join("");
}

// ---------- missões ----------
function desenharLista() {
  const el = $("#listaMissoes");
  if (!estado.missoes.length) {
    el.innerHTML = `<li class="dica">Nenhuma missão ainda.</li>`;
    return;
  }
  el.innerHTML = estado.missoes
    .map(
      (m) => `<li><button type="button" data-missao="${esc(m.id)}" class="${estado.atual?.id === m.id ? "ativa" : ""}">
        <span class="t">${esc(m.texto)}</span>
        <small><span class="selo ${m.status}">${ROTULOS[m.status] || m.status}</span>${m.origem === "rotina" ? `<span class="selo rotina">rotina</span>` : ""}${quando(m.criadaEm)}</small>
      </button></li>`,
    )
    .join("");
}

function miniatura(caminho, absoluto) {
  return `<button type="button" class="miniatura" data-imagem="${esc(caminho)}" data-caminho="${esc(absoluto || "")}" title="${esc(absoluto || caminho)}"><img src="${urlEntrega(caminho)}" alt="" loading="lazy" /></button>`;
}
function origemMissao(m) {
  if (m.origem === "rotina") {
    const r = estado.rotinas.find((x) => x.id === m.rotina);
    return `<p class="origem">Rodou sozinha pela rotina${r ? ` "${esc(r.quando)}"` : ""}</p>`;
  }
  if (m.origem === "edicao" && m.refazDe) return `<p class="origem">Pedido corrigido de <button type="button" class="link" data-missao="${esc(m.refazDe)}">outra missão</button></p>`;
  return "";
}

function desenharMissao() {
  const m = estado.atual;
  const el = $("#missao");
  if (!m) return;
  const rodando = m.status === "planejando" || m.status === "em_andamento";
  const tarefas = (m.tarefas || [])
    .map((t) => {
      const a = estado.porId[t.agente] || { cor: "#22c7ff" };
      const motor = t.motor ? ` · ${esc(estado.nomesMotores[t.motor] || t.motor)}${t.modelo && t.modelo !== t.motor ? ` (${esc(t.modelo)})` : ""}` : "";
      const botao = t.arquivo ? `<button type="button" class="botao mini fantasma" data-arquivo="${esc(t.arquivo)}" data-titulo="${esc(t.nome)}">Ver entrega</button>` : "";
      const imagens = (t.imagens || []).length
        ? `<div class="galeria">${t.imagens.map((im) => miniatura(`${m.pasta}/${im.arquivo}`, im.caminho)).join("")}</div>`
        : "";
      return `<div class="tarefa" style="--cor:${esc(a.cor)}">
        <div class="topo-t"><strong>${esc(t.nome)}</strong><span class="selo ${t.status}">${ROTULOS[t.status] || t.status}</span></div>
        <p>${esc(t.tarefa)}</p>
        <small>${t.inicio ? duracao(t.inicio, t.fim) : ""}${motor}</small>
        ${t.erro ? `<small style="color:var(--bad)">${esc(t.erro.slice(0, 220))}</small>` : ""}
        ${imagens}
        ${botao}
      </div>`;
    })
    .join("");
  el.innerHTML = `
    <div class="cabeca"><h2>Missão · ${quando(m.criadaEm)}</h2><span class="selo ${m.status}">${ROTULOS[m.status] || m.status}</span></div>
    <h3>${esc(m.texto)}</h3>
    ${origemMissao(m)}
    ${m.entendi ? `<p class="entendi">${esc(m.entendi)}</p>` : rodando ? `<p class="entendi">O Coordenador está montando o plano…</p>` : ""}
    ${tarefas ? `<div class="tarefas">${tarefas}</div>` : ""}
    ${m.resposta ? `<div class="resposta md">${markdown(m.resposta, m.pasta)}</div>` : ""}
    <div class="acoes">
      ${rodando ? `<button type="button" class="botao perigo mini" id="parar">Parar missão</button>` : ""}
      ${m.pasta && (m.tarefas || []).some((t) => t.arquivo) ? `<button type="button" class="botao fantasma mini" id="abrirPasta">Abrir pasta das entregas</button>` : ""}
      ${!rodando ? `<button type="button" class="botao fantasma mini" id="editarPedido">Editar pedido e refazer</button>` : ""}
      ${!rodando ? `<button type="button" class="botao fantasma mini" id="repetir">Usar este comando de novo</button>` : ""}
    </div>`;
}

// ---------- rotinas ----------
const NOMES_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function desenharRotinas() {
  const el = $("#listaRotinas");
  if (!estado.rotinas.length) {
    el.innerHTML = `<li class="dica">Nenhuma rotina. Peça do seu jeito, ex.: "toda segunda às 8h, monte minha semana".</li>`;
    return;
  }
  el.innerHTML = estado.rotinas
    .map((r) => {
      const proxima = r.ativo && r.proxima ? `próxima: ${quando(r.proxima)}` : r.ativo ? "sem próxima data" : "pausada";
      return `<li class="${r.ativo ? "" : "pausada"}">
        <button type="button" class="corpo" data-rotina="${esc(r.id)}" title="Editar rotina">
          <span class="t">${esc(r.comando)}</span>
          <small><span class="selo ${r.ativo ? "concluida" : "parada"}">${esc(r.quando)}</span>${esc(proxima)}</small>
        </button>
        <div class="linha">
          <button type="button" class="botao mini fantasma" data-rodar-rotina="${esc(r.id)}" title="Rodar agora">Rodar</button>
          <button type="button" class="botao mini fantasma" data-pausar-rotina="${esc(r.id)}">${r.ativo ? "Pausar" : "Ligar"}</button>
          <button type="button" class="botao mini perigo" data-apagar-rotina="${esc(r.id)}" title="Apagar rotina">×</button>
        </div>
      </li>`;
    })
    .join("");
}

function abrirRotina(id) {
  const r = estado.rotinas.find((x) => x.id === id);
  estado.editandoRotina = r ? r.id : null;
  $("#tituloRotina").textContent = r ? "Editar rotina" : "Nova rotina";
  $("#rotinaComando").value = r?.comando || "";
  $("#rotinaHora").value = r?.hora || "08:00";
  const dias = r?.dias || [];
  $("#rotinaRepete").value = r?.data ? "uma" : !dias.length || dias.length === 7 ? "todo" : dias.join() === "1,2,3,4,5" ? "uteis" : "dias";
  for (const c of $("#rotinaDias").querySelectorAll("input")) c.checked = dias.includes(Number(c.value));
  $("#rotinaData").value = r?.data || new Date().toLocaleDateString("en-CA");
  ajustarFormRotina();
  $("#janelaRotina").showModal();
  $("#rotinaComando").focus();
}
function ajustarFormRotina() {
  const tipo = $("#rotinaRepete").value;
  $("#rotinaDias").hidden = tipo !== "dias";
  $("#rotinaDataCampo").hidden = tipo !== "uma";
}
$("#rotinaRepete").addEventListener("change", ajustarFormRotina);

async function salvarRotina(botao) {
  const tipo = $("#rotinaRepete").value;
  const dias = tipo === "uteis" ? [1, 2, 3, 4, 5] : tipo === "dias" ? [...$("#rotinaDias").querySelectorAll("input:checked")].map((c) => Number(c.value)) : [];
  if (tipo === "dias" && !dias.length) return alert("Escolha pelo menos um dia.");
  const dados = { comando: $("#rotinaComando").value.trim(), hora: $("#rotinaHora").value, dias, data: tipo === "uma" ? $("#rotinaData").value : null };
  if (!dados.comando) return $("#rotinaComando").focus();
  botao.disabled = true;
  try {
    if (estado.editandoRotina) await api(`/api/agendamentos/${encodeURIComponent(estado.editandoRotina)}`, { method: "POST", body: JSON.stringify({ ...dados, ativo: true }) });
    else await api("/api/agendamentos", { method: "POST", body: JSON.stringify({ ...dados, motor: $("#motor").value }) });
    $("#janelaRotina").close();
  } catch (erro) {
    alert(erro.message);
  } finally {
    botao.disabled = false;
  }
}

// ---------- feed ao vivo ----------
// "motor" só alimenta a etiqueta do nó; no feed aparece o "Pensando com ..." logo depois.
const noFeed = (ev) => ev.tipo !== "motor" && (!estado.filtro || ev.agente === estado.filtro);
function itemFeed(ev) {
  const a = estado.porId[ev.agente] || { nome: ev.agente, cor: "#9ea2c8" };
  const foto = ev.tipo === "imagem" && ev.arquivo && estado.atual?.pasta ? miniatura(`${estado.atual.pasta}/${ev.arquivo}`, ev.texto.replace(/^Imagem salva: /, "")) : "";
  return `<li class="${esc(ev.tipo)}" style="--cor:${esc(a.cor)}"><i></i><div><b>${esc(a.nome)}</b><time>${hora(ev.quando)}</time><span>${esc(ev.texto)}</span>${foto}</div></li>`;
}
function desenharFeed() {
  const log = (estado.atual?.log || []).filter(noFeed);
  $("#feed").innerHTML = log.length ? log.slice().reverse().map(itemFeed).join("") : `<li class="dica" style="display:block">Os passos dos agentes aparecem aqui em tempo real.</li>`;
  $("#limparFiltro").hidden = !estado.filtro;
}

function tudo() {
  desenharMotores();
  desenharRotinas();
  desenharFluxo();
  desenharLista();
  desenharMissao();
  desenharFeed();
}

async function abrirMissao(id) {
  estado.escrevendo = {};
  estado.atual = await api(`/api/missao/${encodeURIComponent(id)}`);
  tudo();
}

// ---------- eventos do servidor ----------
let redesenho = null;
function agendarRedesenho() {
  if (redesenho) return;
  redesenho = requestAnimationFrame(() => {
    redesenho = null;
    desenharFluxo();
    desenharMissao();
  });
}

function conectar() {
  const fonte = new EventSource("/api/eventos");
  fonte.addEventListener("motores", (e) => {
    estado.motores = JSON.parse(e.data);
    desenharMotores();
  });
  fonte.addEventListener("evento", (e) => {
    const ev = JSON.parse(e.data);
    if (estado.atual?.id !== ev.missaoId) return;
    if (ev.tipo === "escrevendo") {
      estado.escrevendo[ev.agente] = ev.texto;
      return agendarRedesenho();
    }
    delete estado.escrevendo[ev.agente];
    estado.atual.log = estado.atual.log || [];
    estado.atual.log.push(ev);
    if (noFeed(ev)) {
      const feed = $("#feed");
      if (feed.querySelector(".dica")) feed.innerHTML = "";
      feed.insertAdjacentHTML("afterbegin", itemFeed(ev));
    }
    agendarRedesenho();
  });
  fonte.addEventListener("missao", (e) => {
    const m = JSON.parse(e.data);
    const i = estado.missoes.findIndex((x) => x.id === m.id);
    if (i >= 0) estado.missoes[i] = m;
    else estado.missoes.unshift(m);
    if (estado.atual?.id === m.id) {
      // Mantém o log que já chegou ao vivo; o resto vem do servidor.
      estado.atual = { ...estado.atual, ...m, log: estado.atual.log };
      agendarRedesenho();
    }
    desenharLista();
  });
  fonte.addEventListener("agendamentos", (e) => {
    estado.rotinas = JSON.parse(e.data);
    desenharRotinas();
  });
  fonte.onerror = () => {
    for (const p of document.querySelectorAll(".pilula")) p.title = "Sem conexão com o servidor do squad";
  };
}

// ---------- ações ----------
$("#formComando").addEventListener("submit", async (e) => {
  e.preventDefault();
  const texto = $("#texto").value.trim();
  if (!texto) return $("#texto").focus();
  const botao = e.submitter || $("#formComando .principal");
  botao.disabled = true;
  try {
    const m = await api("/api/missao", { method: "POST", body: JSON.stringify({ texto, motor: $("#motor").value }) });
    $("#texto").value = "";
    if (!estado.missoes.some((x) => x.id === m.id)) estado.missoes.unshift(m);
    estado.atual = { ...m, log: estado.atual?.id === m.id ? estado.atual.log : [] };
    estado.filtro = null;
    tudo();
  } catch (erro) {
    alert(erro.message);
  } finally {
    botao.disabled = false;
  }
});
$("#texto").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) $("#formComando").requestSubmit();
});

document.addEventListener("click", async (e) => {
  const alvo = e.target.closest("button");
  if (!alvo) return;
  if (alvo.dataset.missao) return abrirMissao(alvo.dataset.missao);
  if (alvo.dataset.imagem) return abrirImagem(alvo.dataset.imagem, alvo.dataset.caminho);
  if (alvo.dataset.rotina) return abrirRotina(alvo.dataset.rotina);
  if (alvo.dataset.rodarRotina) {
    const m = await api(`/api/agendamentos/${encodeURIComponent(alvo.dataset.rodarRotina)}/rodar`, { method: "POST" }).catch((erro) => alert(erro.message));
    if (m?.id) {
      if (!estado.missoes.some((x) => x.id === m.id)) estado.missoes.unshift(m);
      estado.atual = { ...m, log: [] };
      tudo();
    }
    return;
  }
  if (alvo.dataset.pausarRotina) {
    const r = estado.rotinas.find((x) => x.id === alvo.dataset.pausarRotina);
    return api(`/api/agendamentos/${encodeURIComponent(r.id)}`, { method: "POST", body: JSON.stringify({ ativo: !r.ativo }) }).catch((erro) => alert(erro.message));
  }
  if (alvo.dataset.apagarRotina) {
    if (!confirm("Apagar esta rotina?")) return;
    return api(`/api/agendamentos/${encodeURIComponent(alvo.dataset.apagarRotina)}`, { method: "DELETE" }).catch((erro) => alert(erro.message));
  }
  if (alvo.id === "novaRotina") return abrirRotina(null);
  if (alvo.id === "salvarRotina") return salvarRotina(alvo);
  if (alvo.id === "editarPedido" && estado.atual) {
    $("#textoEditado").value = estado.atual.texto;
    $("#janelaEditar").showModal();
    return $("#textoEditado").focus();
  }
  if (alvo.id === "enviarEdicao" && estado.atual) return refazerMissao(alvo);
  if (alvo.id === "copiarCaminho") {
    await navigator.clipboard.writeText($("#caminhoImagem").textContent);
    alvo.textContent = "Copiado";
    return setTimeout(() => (alvo.textContent = "Copiar caminho"), 1500);
  }
  if (alvo.dataset.agente) {
    estado.filtro = estado.filtro === alvo.dataset.agente ? null : alvo.dataset.agente;
    desenharFluxo();
    return desenharFeed();
  }
  if (alvo.dataset.arquivo) {
    const r = await fetch(`/api/entrega?arquivo=${encodeURIComponent(alvo.dataset.arquivo)}`);
    const texto = await r.text();
    $("#tituloEntrega").textContent = alvo.dataset.titulo || "Entrega";
    $("#conteudoEntrega").innerHTML = markdown(texto, alvo.dataset.arquivo.split(/[\\/]/).slice(0, -1).join("/"));
    $("#conteudoEntrega").dataset.fonte = texto;
    return $("#janelaEntrega").showModal();
  }
  if (alvo.hasAttribute("data-fechar")) return alvo.closest("dialog").close();
  if (alvo.id === "limparFiltro") {
    estado.filtro = null;
    desenharFluxo();
    return desenharFeed();
  }
  if (alvo.id === "parar" && estado.atual) return api(`/api/missao/${encodeURIComponent(estado.atual.id)}/parar`, { method: "POST" });
  if (alvo.id === "abrirPasta" && estado.atual) return api("/api/abrir-pasta", { method: "POST", body: JSON.stringify({ pasta: estado.atual.pasta }) });
  if (alvo.id === "repetir" && estado.atual) {
    $("#texto").value = estado.atual.texto;
    return $("#texto").focus();
  }
  if (alvo.id === "copiarEntrega") {
    await navigator.clipboard.writeText($("#conteudoEntrega").dataset.fonte || "");
    alvo.textContent = "Copiado";
    return setTimeout(() => (alvo.textContent = "Copiar"), 1500);
  }
  if (alvo.id === "abrirConfig") return abrirConfig();
  if (alvo.id === "salvarConfig") return salvarConfig(alvo);
});

function abrirImagem(caminho, absoluto) {
  const url = urlEntrega(caminho);
  $("#tituloImagem").textContent = caminho.split("/").pop();
  $("#imagemGrande").src = url;
  $("#baixarImagem").href = url;
  $("#baixarImagem").download = caminho.split("/").pop();
  $("#caminhoImagem").textContent = absoluto || caminho;
  $("#janelaImagem").showModal();
}

async function refazerMissao(botao) {
  const texto = $("#textoEditado").value.trim();
  if (!texto) return $("#textoEditado").focus();
  botao.disabled = true;
  try {
    const m = await api(`/api/missao/${encodeURIComponent(estado.atual.id)}/editar`, { method: "POST", body: JSON.stringify({ texto }) });
    $("#janelaEditar").close();
    if (!estado.missoes.some((x) => x.id === m.id)) estado.missoes.unshift(m);
    estado.atual = { ...m, log: [] };
    estado.filtro = null;
    tudo();
  } catch (erro) {
    alert(erro.message);
  } finally {
    botao.disabled = false;
  }
}

// ---------- configurações ----------
function campos() {
  return [...$("#formConfig").querySelectorAll("input[name], select[name]")];
}
function opcoesModelo(select, modelos, atual, rotuloVazio) {
  const lista = [...new Set([...(rotuloVazio ? [""] : []), "auto", ...modelos, ...(atual ? [atual] : [])])];
  select.innerHTML = lista.map((m) => `<option value="${esc(m)}">${esc(m === "" ? rotuloVazio : m === "auto" ? "auto (o OmniRoute escolhe)" : m)}</option>`).join("");
  select.value = atual ?? "";
}
function preencherModelos(modelos) {
  const c = estado.config;
  opcoesModelo($("#formConfig [name='omniroute.modelo']"), modelos, c.omniroute?.modelo || "auto");
  const imagem = $("#formConfig [name='omniroute.modeloImagem']");
  const deImagem = modelos.filter((m) => /image|imagen|dall-e|flux|sdxl|stable-diffusion|seedream|ideogram|recraft|midjourney/i.test(m));
  imagem.innerHTML = [["auto", "auto (o primeiro modelo de imagem, senão o Codex)"], ["codex", "Só o Codex (plano do ChatGPT)"], ...deImagem.map((m) => [m, m])]
    .map(([v, r]) => `<option value="${esc(v)}">${esc(r)}</option>`)
    .join("");
  imagem.value = c.omniroute?.modeloImagem || "auto";
  const padrao = c.omniroute?.modelo || "auto";
  $("#modelosAgentes").innerHTML = estado.agentes
    .map((a) => `<span style="color:${esc(a.cor)}">${esc(a.nome)}</span><select name="agentes.${esc(a.id)}.modelo"></select>`)
    .join("");
  for (const a of estado.agentes) {
    opcoesModelo($(`#formConfig [name='agentes.${a.id}.modelo']`), modelos, c.agentes?.[a.id]?.modelo || "", `Padrão (${padrao})`);
  }
}
async function abrirConfig() {
  const c = estado.config;
  preencherModelos([]);
  for (const campo of campos()) {
    const valor = campo.name.split(".").reduce((o, k) => o?.[k], c);
    if (campo.type === "checkbox") campo.checked = valor !== false;
    else if (campo.tagName !== "SELECT" || valor) campo.value = valor ?? "";
  }
  $("#janelaConfig").showModal();
  const status = $("#statusOmniroute");
  status.textContent = "Procurando modelos no OmniRoute…";
  const r = await api("/api/omniroute/modelos").catch((e) => ({ modelos: [], erro: e.message }));
  preencherModelos(r.modelos);
  status.textContent = r.modelos.length
    ? `${r.modelos.length} modelos encontrados no OmniRoute.`
    : `Não achei o OmniRoute (${r.erro || "sem modelos"}). Confira se ele está aberto e se a chave está no arquivo .env.`;
}
async function salvarConfig(botao) {
  const novo = {};
  for (const campo of campos()) {
    const partes = campo.name.split(".");
    let alvo = novo;
    while (partes.length > 1) {
      const k = partes.shift();
      alvo = alvo[k] = alvo[k] || {};
    }
    alvo[partes[0]] = campo.type === "checkbox" ? campo.checked : campo.type === "number" ? Number(campo.value) || 1 : campo.value.trim();
  }
  botao.disabled = true;
  try {
    estado.config = await api("/api/config", { method: "POST", body: JSON.stringify(novo) });
    desenharMotores();
    $("#janelaConfig").close();
  } catch (erro) {
    alert(erro.message);
  } finally {
    botao.disabled = false;
  }
}

// ---------- início ----------
async function iniciar() {
  const dados = await api("/api/estado");
  const ordem = ["coordenador", "secretario", "prospector", "conteudo", "trafego", "atendimento"];
  const posicao = (id) => (ordem.includes(id) ? ordem.indexOf(id) : 99);
  estado.agentes = dados.agentes.sort((a, b) => posicao(a.id) - posicao(b.id));
  estado.porId = Object.fromEntries(estado.agentes.map((a) => [a.id, a]));
  estado.motores = dados.motores;
  estado.nomesMotores = dados.nomesMotores;
  estado.config = dados.config;
  estado.missoes = dados.missoes;
  estado.rotinas = dados.agendamentos || [];
  tudo();
  if (estado.missoes[0]) await abrirMissao(estado.missoes[0].id);
  conectar();
  new ResizeObserver(() => desenharFluxo()).observe($("#palco"));
  setInterval(() => {
    desenharMotores();
    if (estado.atual && ["planejando", "em_andamento"].includes(estado.atual.status)) desenharMissao();
  }, 15000);
}
iniciar().catch((erro) => {
  $("#missao").innerHTML = `<p style="color:var(--bad)">Não consegui falar com o servidor do squad: ${esc(erro.message)}</p>`;
});

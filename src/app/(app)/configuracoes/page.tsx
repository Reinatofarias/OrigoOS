import { headers } from 'next/headers';
import { CheckCircle2, XCircle } from 'lucide-react';
import { db, type Service, type TaskTemplate } from '@/lib/db';
import { asaasAmbiente, asaasConfigurado } from '@/lib/asaas';
import { Body, Card, PageHeader, Tabs } from '@/components/ui';
import FormDialog, { Field } from '@/components/dialog';
import { ServiceRow, TemplateRow } from '@/components/config';
import { PRIORIDADE } from '@/components/tasks';
import { addService, addTemplate, salvarEmpresa } from '@/app/actions';
import { lerEmpresa } from '@/lib/contratos';
import Lembrete from '@/components/lembrete';
import Autenticador from '@/components/autenticador';
import { lerModelos } from '@/lib/mensagens';
import { CHAVES_MENSAGEM, MODELOS_PADRAO, PASSOS } from '@/lib/prospeccao';
import { lerSeguranca, nomeDoAparelho } from '@/lib/seguranca';
import { metaConfigurado, tokenGoogle } from '@/lib/anuncios';
import { scriptGoogle } from '@/lib/script-google';
import { cronProtegido } from '@/lib/cron';
import { redirecionamento, situacaoAgenda } from '@/lib/google-agenda';
import { desconectarAgenda } from '@/app/acoes/agenda';
import { lerPreferencias, relogio, relogioRodando } from '@/lib/avisos';
import AvisosForm from '@/components/avisos-form';
import { restaurarMensagens, salvarMensagens } from '@/app/acoes/prospeccao';
import { sairDeTodos } from '@/app/acoes/seguranca';
import { SairDeTodos } from '@/components/sair-todos';
import { btn } from '@/components/ui';

const TABS = ['servicos', 'onboarding', 'rotina', 'empresa', 'mensagens', 'integracoes', 'app', 'asaas', 'seguranca'] as const;
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function Cabecalho({ cols, nomes }: { cols: string; nomes: string[] }) {
  return (
    <div className={`hidden border-b border-line bg-surface-2/50 px-3 py-1.5 text-[11.5px] font-medium text-muted md:grid ${cols}`}>
      {nomes.map((n, i) => (
        <span key={i} className="px-1.5">
          {n}
        </span>
      ))}
    </div>
  );
}

function CamposModelo({ tipo }: { tipo: TaskTemplate['tipo'] }) {
  return (
    <>
      <input type="hidden" name="tipo" value={tipo} />
      <Field label="Tarefa *">
        <input name="titulo" required className="field" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        {tipo === 'onboarding' ? (
          <Field label="Quantos dias depois do início">
            <input name="dias" type="number" min={0} defaultValue={0} className="field" />
          </Field>
        ) : (
          <>
            <Field label="Repete">
              <select name="frequencia" className="field" defaultValue="semanal">
                <option value="semanal">Toda semana</option>
                <option value="mensal">Todo mês</option>
              </select>
            </Field>
            <Field label="Dia da semana (se semanal)">
              <select name="dia_semana" className="field" defaultValue={1}>
                {DIAS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Dia do mês (se mensal)">
              <input name="dia_mes" type="number" min={1} max={28} defaultValue={5} className="field" />
            </Field>
          </>
        )}
        <Field label="Pra quais clientes">
          <select name="plataforma" className="field">
            <option value="todas">Todos</option>
            <option value="google">Só quem tem Google Ads</option>
            <option value="meta">Só quem tem Meta Ads</option>
          </select>
        </Field>
        <Field label="Prioridade">
          <select name="prioridade" className="field" defaultValue="normal">
            {Object.entries(PRIORIDADE).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </>
  );
}

const EVENTOS: Record<string, { label: string; ruim?: boolean }> = {
  login: { label: 'Entrou' },
  login_falhou: { label: 'Senha ou código errado', ruim: true },
  login_travado: { label: 'Login travado (muitas tentativas)', ruim: true },
  sair_todos: { label: 'Saiu de todos os aparelhos' },
  autenticador_ligado: { label: 'Ligou a verificação em duas etapas' },
  autenticador_desligado: { label: 'Desligou a verificação em duas etapas', ruim: true },
  backup_baixado: { label: 'Baixou o backup' },
  formulario: { label: 'Contato pelo formulário do site' },
};

const AVISOS_AGENDA: Record<string, { texto: string; ok?: boolean }> = {
  ok: { texto: 'Google Agenda conectado.', ok: true },
  cancelado: { texto: 'Você cancelou a permissão no Google. Nada foi conectado.' },
  expirou: { texto: 'A conexão demorou demais ou veio de outra aba. Clique em Conectar de novo.' },
  erro: { texto: 'O Google recusou a conexão. Confira o ID, a chave e o endereço de retorno no Google Cloud e tente de novo.' },
  'sem-chaves': { texto: 'Faltam GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na Vercel (e um novo deploy depois).' },
};

function Item({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-faint" />}
      <span>{children}</span>
    </li>
  );
}

export default async function ConfiguracoesPage({ searchParams }: PageProps<'/configuracoes'>) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t === sp.tab) ?? 'servicos';
  const supa = db();
  const [{ data: svs }, { data: tps }] = await Promise.all([
    supa.from('services').select('*').order('ordem'),
    supa.from('task_templates').select('*').order('ordem'),
  ]);
  const servicos = (svs ?? []) as Service[];
  const modelos = (tps ?? []) as TaskTemplate[];
  const onboarding = modelos.filter((t) => t.tipo === 'onboarding').sort((a, b) => a.dias - b.dias || a.ordem - b.ordem);
  const rotina = modelos.filter((t) => t.tipo === 'recorrente');
  const h = await headers();
  const webhook = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}/api/asaas`;
  const ambiente = asaasAmbiente();
  const empresa = await lerEmpresa(supa);
  const origem = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const ler = async (chave: string) => (await supa.from('settings').select('valor').eq('chave', chave).maybeSingle()).data?.valor ?? null;
  const textos = tab === 'mensagens' ? await lerModelos(supa) : {};
  const seg = tab === 'seguranca' ? await lerSeguranca(supa) : null;
  const acessos = tab === 'seguranca' ? ((await supa.from('access_log').select('*').order('created_at', { ascending: false }).limit(25)).data ?? []) : [];
  const backup = tab === 'seguranca' ? ((await ler('backup_ultimo')) as { em: string; arquivo: string } | null) : null;
  const google = tab === 'integracoes' ? { token: await tokenGoogle(supa), ultimo: (await ler('google_ultimo')) as { em: string; dias: number; sem_cliente: string[] } | null } : null;
  const agenda = tab === 'integracoes' ? await situacaoAgenda(supa) : null;
  const avisoAgenda = typeof sp.agenda === 'string' ? AVISOS_AGENDA[sp.agenda] : undefined;
  const avisos =
    tab === 'app'
      ? await (async () => {
          const [prefs, , ultimo, tabela] = await Promise.all([
            lerPreferencias(supa),
            relogio(supa, origem),
            ler('avisos_ultimo') as Promise<{ em: string } | null>,
            supa.from('avisos_enviados').select('chave', { head: true, count: 'exact' }),
          ]);
          return { prefs, ultimo, semTabela: !!tabela.error, rodando: relogioRodando(ultimo) };
        })()
      : null;
  const noturno = tab === 'integracoes' ? ((await ler('noturno_ultimo')) as { em: string; meta?: { dias: number; erros: string[] } } | null) : null;
  const quando = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  return (
    <>
      <PageHeader title="Configurações" subtitle="Serviços, modelos de tarefa e integrações" />
      <div className="border-b border-line bg-surface px-4 pt-3 md:px-8">
        <Tabs
          active={tab}
          items={[
            { key: 'servicos', label: 'Serviços e preços', href: '/configuracoes', count: servicos.length },
            { key: 'onboarding', label: 'Onboarding', href: '/configuracoes?tab=onboarding', count: onboarding.length },
            { key: 'rotina', label: 'Tarefas recorrentes', href: '/configuracoes?tab=rotina', count: rotina.length },
            { key: 'empresa', label: 'Dados da Origo', href: '/configuracoes?tab=empresa' },
            { key: 'mensagens', label: 'Mensagens e site', href: '/configuracoes?tab=mensagens' },
            { key: 'integracoes', label: 'Integrações', href: '/configuracoes?tab=integracoes' },
            { key: 'app', label: 'Notificações', href: '/configuracoes?tab=app' },
            { key: 'asaas', label: 'Asaas', href: '/configuracoes?tab=asaas' },
            { key: 'seguranca', label: 'Segurança', href: '/configuracoes?tab=seguranca' },
          ]}
        />
      </div>
      <Body>
        {tab === 'servicos' && (
          <Card
            flush
            title="Catálogo de serviços"
            aside={
              <FormDialog label="Serviço" title="Novo serviço" action={addService} variant="secondary">
                <Field label="Nome *">
                  <input name="nome" required className="field" />
                </Field>
                <Field label="Descrição (aparece na proposta)">
                  <textarea name="descricao" rows={3} className="field" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Preço (R$)">
                    <input name="preco" inputMode="decimal" className="field" />
                  </Field>
                  <Field label="Cobrança">
                    <select name="cobranca" className="field">
                      <option value="mensal">Mensal</option>
                      <option value="unico">Único</option>
                    </select>
                  </Field>
                  <Field label="Plataforma">
                    <select name="plataforma" className="field">
                      <option value="">Nenhuma</option>
                      <option value="google">Google</option>
                      <option value="meta">Meta</option>
                      <option value="google_meta">Google + Meta</option>
                    </select>
                  </Field>
                </div>
              </FormDialog>
            }
          >
            <p className="border-b border-line px-4 py-3 text-[13px] text-muted">
              É daqui que saem os serviços das propostas. Clique no texto pra editar. Mudar um preço aqui não altera propostas já feitas.
            </p>
            <Cabecalho cols="md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_110px_120px_40px_32px]" nomes={['Serviço', 'Descrição', 'Preço (R$)', 'Cobrança', 'Ativo', '']} />
            {servicos.map((s) => (
              <ServiceRow key={`${s.id}-${s.nome}-${s.preco}-${s.descricao}`} s={s} />
            ))}
          </Card>
        )}

        {tab === 'onboarding' && (
          <Card flush title="Checklist de cliente novo" aside={<FormDialog label="Tarefa" title="Nova tarefa de onboarding" action={addTemplate} variant="secondary"><CamposModelo tipo="onboarding" /></FormDialog>}>
            <p className="border-b border-line px-4 py-3 text-[13px] text-muted">
              Quando um negócio vira cliente, essas tarefas são criadas sozinhas, com prazo contado a partir do início. Tarefas &quot;Só Google&quot; ou &quot;Só Meta&quot; entram só pra quem anuncia lá.
            </p>
            <Cabecalho cols="md:grid-cols-[minmax(0,1fr)_170px_110px_110px_40px_32px]" nomes={['Tarefa', 'Prazo', 'Clientes', 'Prioridade', 'Ativa', '']} />
            {onboarding.map((t) => (
              <TemplateRow key={`${t.id}-${t.titulo}-${t.dias}`} t={t} />
            ))}
          </Card>
        )}

        {tab === 'rotina' && (
          <Card flush title="Rotina de cada cliente" aside={<FormDialog label="Tarefa" title="Nova tarefa recorrente" action={addTemplate} variant="secondary"><CamposModelo tipo="recorrente" /></FormDialog>}>
            <p className="border-b border-line px-4 py-3 text-[13px] text-muted">
              Essas tarefas aparecem sozinhas pra cada cliente ativo, toda semana ou todo mês. Dá pra desligar a rotina de um cliente nos dados cadastrais dele.
            </p>
            <Cabecalho cols="md:grid-cols-[minmax(0,1fr)_170px_110px_110px_40px_32px]" nomes={['Tarefa', 'Quando', 'Clientes', 'Prioridade', 'Ativa', '']} />
            {rotina.map((t) => (
              <TemplateRow key={`${t.id}-${t.titulo}`} t={t} />
            ))}
          </Card>
        )}

        {tab === 'empresa' && (
          <Card title="Dados da Origo nos contratos">
            <form action={salvarEmpresa} className="grid max-w-2xl gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome da empresa">
                  <input name="nome" defaultValue={empresa.nome} className="field" />
                </Field>
                <Field label="CNPJ (ou CPF)">
                  <input name="documento" defaultValue={empresa.documento} className="field" />
                </Field>
                <Field label="Responsável">
                  <input name="responsavel" defaultValue={empresa.responsavel} className="field" />
                </Field>
                <Field label="E-mail">
                  <input name="email" type="email" defaultValue={empresa.email} className="field" />
                </Field>
              </div>
              <Field label="Endereço completo">
                <input name="endereco" defaultValue={empresa.endereco} className="field" />
              </Field>
              <Field label="Cidade do foro">
                <input name="cidade" defaultValue={empresa.cidade} className="field" />
              </Field>
              <p className="text-[12.5px] text-muted">Contratos já assinados não mudam: eles guardam o texto exato do momento da assinatura.</p>
              <div>
                <button className={btn.primary}>Salvar</button>
              </div>
            </form>
          </Card>
        )}

        {tab === 'app' && (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-2">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
              <Card title="1. Ligar neste aparelho">
                <p className="mb-3 text-[13px] text-muted">Abra o Origo OS pelo ícone no celular e ligue aqui. Cada aparelho (celular, computador) liga uma vez.</p>
                <Lembrete />
              </Card>
              {avisos && (
                <Card title="2. O que avisar">
                  <AvisosForm prefs={avisos.prefs} />
                </Card>
              )}
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
              {avisos && (
                <Card title="Relógio dos avisos">
                  <ul className="grid gap-2 text-[13.5px]">
                    <Item ok={!avisos.semTabela}>{avisos.semTabela ? 'Falta rodar o supabase/atualizar-v8.sql' : 'Banco pronto pros avisos'}</Item>
                    <Item ok={avisos.rodando}>
                      {avisos.rodando ? `Funcionando: última volta às ${quando(avisos.ultimo!.em)}` : avisos.ultimo ? `Parado desde ${quando(avisos.ultimo.em)}` : 'Ainda não rodou'}
                    </Item>
                  </ul>
                  {(!avisos.rodando || avisos.semTabela) && (
                    <ol className="mt-3 grid list-decimal gap-2 pl-5 text-[13px] leading-relaxed">
                      <li>
                        No Supabase, abra o <strong>SQL Editor</strong>, cole o arquivo <code className="rounded bg-surface-2 px-1">supabase/atualizar-v8.sql</code> e clique em Run.
                      </li>
                      <li>Volte aqui em uns 5 minutos e recarregue: tem que aparecer &quot;Funcionando&quot;.</li>
                    </ol>
                  )}
                  <p className="mt-3 text-[12.5px] text-muted">
                    O próprio Supabase chama o Origo OS de 5 em 5 minutos pra ver se tem algo pra avisar. Não precisa de servidor nem de plano pago.
                  </p>
                </Card>
              )}
            <Card title="Instalar no celular">
              <ol className="grid list-decimal gap-2 pl-5 text-[13.5px] leading-relaxed">
                <li>
                  <strong>iPhone:</strong> abra o sistema no Safari, toque em Compartilhar e depois em &quot;Adicionar à Tela de Início&quot;.
                </li>
                <li>
                  <strong>Android:</strong> abra no Chrome, toque nos três pontinhos e em &quot;Instalar app&quot;.
                </li>
                <li>Abra pelo ícone do Origo OS e ligue as notificações aqui nesta tela, no próprio celular.</li>
              </ol>
              <p className="mt-3 text-[13px] text-muted">
                Em qualquer tela, o botão <strong>+</strong> (ou a tecla N no computador) abre a captura rápida: fale ou escreva &quot;ligar pro Matheus amanhã urgente&quot; e vira tarefa.
              </p>
            </Card>
            </div>
          </div>
        )}

        {tab === 'asaas' && (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-2">
            <Card title="Situação">
              <ul className="grid gap-2 text-[13.5px]">
                <Item ok={asaasConfigurado()}>
                  Chave da API {asaasConfigurado() ? <>configurada ({ambiente === 'sandbox' ? 'ambiente de testes' : 'produção'})</> : 'não configurada'}
                </Item>
                <Item ok={!!process.env.ASAAS_WEBHOOK_TOKEN}>Token do webhook {process.env.ASAAS_WEBHOOK_TOKEN ? 'configurado' : 'não configurado'}</Item>
              </ul>
              <p className="mt-4 text-[13px] text-muted">
                Com tudo verde, o botão &quot;Emitir no Asaas&quot; aparece nas cobranças. O cliente recebe a fatura e escolhe Pix, boleto ou cartão. Quando ele paga, a cobrança vira &quot;Recebida&quot; aqui sozinha.
              </p>
            </Card>
            <Card title="Como ligar (uma vez só)">
              <ol className="grid list-decimal gap-2.5 pl-5 text-[13.5px] leading-relaxed">
                <li>
                  No Asaas, vá em <strong>Integrações &gt; Chaves de API</strong> e gere uma chave.
                </li>
                <li>
                  Na Vercel, em <strong>Settings &gt; Environment Variables</strong>, crie <code className="rounded bg-surface-2 px-1">ASAAS_API_KEY</code> com essa chave.
                </li>
                <li>
                  Crie também <code className="rounded bg-surface-2 px-1">ASAAS_WEBHOOK_TOKEN</code> com uma senha qualquer, longa, só sua.
                </li>
                <li>
                  No Asaas, em <strong>Integrações &gt; Webhooks</strong>, crie um webhook de cobranças com a URL abaixo, a mesma senha no campo &quot;Token de autenticação&quot; e a versão v3.
                  <code className="mt-1.5 block break-all rounded-lg bg-surface-2 px-2.5 py-2 text-[12.5px]">{webhook}</code>
                </li>
                <li>Faça um novo deploy na Vercel pra as variáveis valerem.</li>
              </ol>
            </Card>
          </div>
        )}

        {tab === 'mensagens' && (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card title="Mensagens da prospecção">
              <form action={salvarMensagens} className="grid gap-4">
                {PASSOS.map((p) => (
                  <Field key={p.passo} label={`${p.titulo} · ${p.quando}`}>
                    <textarea name={p.passo} rows={4} defaultValue={textos[p.passo] ?? MODELOS_PADRAO[p.passo]} className="field resize-y text-[13px] leading-relaxed" />
                  </Field>
                ))}
                <div className="flex flex-wrap gap-2">
                  <button className={btn.primary}>Salvar mensagens</button>
                  <button formAction={restaurarMensagens} className={btn.ghost}>
                    Voltar pras mensagens padrão
                  </button>
                </div>
              </form>
            </Card>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
              <Card title="O que dá pra usar no texto">
                <ul className="grid gap-1.5 text-[13px]">
                  {CHAVES_MENSAGEM.map((c) => (
                    <li key={c.chave}>
                      <code className="rounded bg-surface-2 px-1">{c.chave}</code> <span className="text-muted">{c.o_que}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[12.5px] text-muted">No Início, o botão &quot;Mandar M1&quot; abre o WhatsApp com a mensagem pronta e já marca como enviada.</p>
              </Card>
              <Card title="Formulário pro seu site">
                <p className="text-[13px] text-muted">Quem preencher vira lead em &quot;Respondeu&quot; e você recebe um aviso no celular na hora.</p>
                <code className="mt-3 block break-all rounded-lg bg-surface-2 px-2.5 py-2 text-[12.5px]">{origem}/f</code>
                <p className="mt-3 text-[12.5px] text-muted">Pra colocar dentro de uma página do site, use este código:</p>
                <code className="mt-1.5 block break-all rounded-lg bg-surface-2 px-2.5 py-2 text-[12px]">{`<iframe src="${origem}/f?embed=1" style="width:100%;max-width:480px;height:720px;border:0" title="Fale com a Origo"></iframe>`}</code>
                <a href="/f" target="_blank" className={`${btn.ghost} mt-3`}>
                  Ver o formulário
                </a>
              </Card>
            </div>
          </div>
        )}

        {tab === 'integracoes' && google && (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-2">
            {agenda && (
              <Card title="Google Agenda" className="lg:col-span-2">
                {avisoAgenda && (
                  <p className={`mb-3 rounded-lg px-3 py-2 text-[13px] ${avisoAgenda.ok ? 'bg-success-soft text-success' : 'bg-warn-soft text-warn'}`}>{avisoAgenda.texto}</p>
                )}
                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <p className="text-[13px] font-semibold">Jeito simples (recomendado)</p>
                    <ul className="mt-2 grid gap-2 text-[13.5px]">
                      <Item ok={agenda.ical && !agenda.icalPublico}>
                        {!agenda.ical ? (
                          <>Falta <code className="rounded bg-surface-2 px-1">GOOGLE_AGENDA_ICS</code> na Vercel</>
                        ) : agenda.icalPublico ? (
                          'Está usando o endereço público: troque pelo endereço secreto e deixe a agenda privada'
                        ) : (
                          'Endereço secreto da agenda configurado: o Origo OS mostra seus compromissos'
                        )}
                      </Item>
                    </ul>
                    <ol className="mt-3 grid list-decimal gap-2 pl-5 text-[13px] leading-relaxed">
                      <li>
                        No computador, abra <strong>calendar.google.com</strong>, clique na engrenagem e em <strong>Configurações</strong>.
                      </li>
                      <li>Na esquerda, em &quot;Configurações das minhas agendas&quot;, clique na sua agenda (o seu nome).</li>
                      <li>
                        Em <strong>Permissões de acesso</strong>, deixe <strong>desmarcado</strong> &quot;Disponibilizar publicamente&quot;.
                      </li>
                      <li>
                        Desça até <strong>Integrar agenda</strong> e copie o <strong>Endereço secreto no formato iCal</strong> (clique no olho pra mostrar). Ele termina em <code className="rounded bg-surface-2 px-1">basic.ics</code> e tem <code className="rounded bg-surface-2 px-1">/private-</code> no meio.
                      </li>
                      <li>
                        Na Vercel, crie <code className="rounded bg-surface-2 px-1">GOOGLE_AGENDA_ICS</code> com esse endereço e faça um novo deploy.
                      </li>
                    </ol>
                    <p className="mt-3 text-[12.5px] text-muted">
                      Esse endereço funciona como uma senha da sua agenda: só na Vercel, nunca no chat. Pra criar compromisso, o botão abre o Google Agenda já preenchido e você salva lá (o Meet é um clique). A agenda atualiza a cada 2 minutos.
                    </p>
                  </div>
                  <details className="rounded-lg border border-line p-3 lg:self-start" open={agenda.configurada}>
                    <summary className="cursor-pointer text-[13px] font-semibold">Jeito completo (opcional): conectar a conta pelo Google Cloud</summary>
                    <p className="mt-2 text-[12.5px] text-muted">Cria e apaga compromisso com Meet direto daqui, sem abrir o Google. Precisa configurar um app no Google Cloud.</p>
                    <div className="mt-3">
                <div className="grid gap-5 ">
                  <div>
                    <ul className="grid gap-2 text-[13.5px]">
                      <Item ok={agenda.configurada}>
                        {agenda.configurada ? 'ID e chave do Google configurados na Vercel' : <>Faltam <code className="rounded bg-surface-2 px-1">GOOGLE_CLIENT_ID</code> e <code className="rounded bg-surface-2 px-1">GOOGLE_CLIENT_SECRET</code> na Vercel</>}
                      </Item>
                      <Item ok={agenda.conectada}>
                        {agenda.conectada ? `Conectado${agenda.email ? ` como ${agenda.email}` : ''}${agenda.desde ? ` desde ${quando(agenda.desde)}` : ''}` : 'Conta Google ainda não conectada'}
                      </Item>
                    </ul>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {agenda.configurada && (
                        <a href="/api/google-agenda/conectar" className={agenda.conectada ? btn.secondary : btn.primary}>
                          {agenda.conectada ? 'Conectar outra conta' : 'Conectar Google Agenda'}
                        </a>
                      )}
                      {agenda.conectada && (
                        <form action={desconectarAgenda}>
                          <button className={btn.secondary}>Desconectar</button>
                        </form>
                      )}
                    </div>
                    <p className="mt-3 text-[12.5px] text-muted">
                      Com a agenda conectada, aparece a tela Agenda (semana com compromissos e tarefas), a agenda de hoje no Início e o botão &quot;Agendar no Google Agenda&quot; em cada tarefa, com link do Meet se quiser.
                    </p>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold">Como configurar (uma vez só)</p>
                    <ol className="mt-2 grid list-decimal gap-2 pl-5 text-[13px] leading-relaxed">
                      <li>
                        Entre em <strong>console.cloud.google.com</strong> com a conta da agenda, crie um projeto (ex.: &quot;Origo OS&quot;) e, em <strong>APIs e serviços &gt; Biblioteca</strong>, ative a <strong>Google Calendar API</strong>.
                      </li>
                      <li>
                        Em <strong>Tela de permissão OAuth</strong>, escolha <strong>Externo</strong>, preencha nome e e-mail e salve. Depois clique em <strong>Publicar aplicativo</strong> (status &quot;Em produção&quot;). Em teste, o Google derruba a conexão a cada 7 dias.
                      </li>
                      <li>
                        Em <strong>Credenciais &gt; Criar credenciais &gt; ID do cliente OAuth</strong>, tipo <strong>Aplicativo da Web</strong>. Em &quot;URIs de redirecionamento autorizados&quot;, cole:
                        <code className="mt-1 block break-all rounded-lg bg-surface-2 px-2.5 py-2 text-[12.5px]">{redirecionamento(origem)}</code>
                      </li>
                      <li>
                        Na Vercel, crie <code className="rounded bg-surface-2 px-1">GOOGLE_CLIENT_ID</code> e <code className="rounded bg-surface-2 px-1">GOOGLE_CLIENT_SECRET</code> com o que o Google mostrar e faça um novo deploy.
                      </li>
                      <li>Volte aqui e clique em Conectar Google Agenda. Como o app não é verificado, o Google avisa &quot;app não verificado&quot;: clique em Avançado e depois em continuar.</li>
                    </ol>
                    <p className="mt-3 text-[12.5px] text-muted">O ID e a chave ficam só na Vercel; nunca mande pelo chat.</p>
                  </div>
                </div>
                    </div>
                  </details>
                </div>
              </Card>
            )}
            <Card title="Meta Ads">
              <ul className="grid gap-2 text-[13.5px]">
                <Item ok={metaConfigurado()}>Token de acesso {metaConfigurado() ? 'configurado' : 'não configurado'}</Item>
                <Item ok={!!noturno?.meta && !noturno.meta.erros?.length}>
                  {noturno?.meta ? `Última busca: ${quando(noturno.em)}, ${noturno.meta.dias} dia(s) de números` : 'Nenhuma busca ainda'}
                </Item>
              </ul>
              {noturno?.meta?.erros?.length ? <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-[12.5px] text-danger">{noturno.meta.erros.join(' · ')}</p> : null}
              <ol className="mt-4 grid list-decimal gap-2 pl-5 text-[13px] leading-relaxed">
                <li>
                  Em <strong>business.facebook.com &gt; Configurações &gt; Usuários do sistema</strong>, crie um usuário do sistema (Administrador).
                </li>
                <li>Em &quot;Atribuir ativos&quot;, dê acesso às contas de anúncio dos clientes.</li>
                <li>
                  Clique em <strong>Gerar token</strong>, marque a permissão <code className="rounded bg-surface-2 px-1">ads_read</code> e escolha &quot;Nunca expira&quot;.
                </li>
                <li>
                  Na Vercel, crie a variável <code className="rounded bg-surface-2 px-1">META_ACCESS_TOKEN</code> com esse token e faça um novo deploy.
                </li>
                <li>No cliente, aba Anúncios, coloque o ID da conta de anúncio (o número depois de &quot;act_&quot;).</li>
              </ol>
              <p className="mt-3 text-[12.5px] text-muted">O sistema busca os números toda madrugada. O token fica só na Vercel; nunca mande ele pelo chat.</p>
            </Card>
            <Card title="Google Ads">
              <ul className="grid gap-2 text-[13.5px]">
                <Item ok={!!google.ultimo}>{google.ultimo ? `Último envio do script: ${quando(google.ultimo.em)}, ${google.ultimo.dias} dia(s)` : 'O script ainda não mandou nada'}</Item>
              </ul>
              {google.ultimo?.sem_cliente?.length ? (
                <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn">Contas sem cliente ligado: {google.ultimo.sem_cliente.join(', ')}. Coloque o ID na aba Anúncios do cliente.</p>
              ) : null}
              <ol className="mt-4 grid list-decimal gap-2 pl-5 text-[13px] leading-relaxed">
                <li>
                  No Google Ads (de preferência na sua conta de administrador), vá em <strong>Ferramentas &gt; Ações em massa &gt; Scripts</strong> e crie um script novo.
                </li>
                <li>Apague o que vier escrito e cole o script abaixo.</li>
                <li>Clique em Autorizar, depois em Executar uma vez pra testar.</li>
                <li>
                  Em Frequência, escolha <strong>Diariamente</strong> (de madrugada).
                </li>
              </ol>
              <textarea readOnly rows={10} value={scriptGoogle(`${origem}/api/metricas`, google.token)} className="field mt-3 font-mono text-[11.5px]" aria-label="Script do Google Ads" />
              <p className="mt-2 text-[12px] text-muted">O script tem uma senha própria pra só ele conseguir mandar números. Não publique ele.</p>
            </Card>
          </div>
        )}

        {tab === 'seguranca' && seg && (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-2">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
              <Card title="Verificação em duas etapas">
                <Autenticador ativo={seg.totp_ativo} />
              </Card>
              <Card title="Situação">
                <ul className="grid gap-2 text-[13.5px]">
                  <Item ok>Login trava 15 minutos depois de 5 senhas erradas</Item>
                  <Item ok={seg.totp_ativo}>Verificação em duas etapas {seg.totp_ativo ? 'ligada' : 'desligada'}</Item>
                  <Item ok={(process.env.ORIGO_PASSWORD?.trim().length ?? 0) >= 12}>
                    Senha {(process.env.ORIGO_PASSWORD?.trim().length ?? 0) >= 12 ? 'com 12 caracteres ou mais' : 'curta: troque ORIGO_PASSWORD na Vercel por uma com 12 caracteres ou mais'}
                  </Item>
                  <Item ok={(process.env.ORIGO_SESSION_SECRET?.trim().length ?? 0) >= 32}>Segredo da sessão {(process.env.ORIGO_SESSION_SECRET?.trim().length ?? 0) >= 32 ? 'forte' : 'curto (use 32 caracteres ou mais)'}</Item>
                  <Item ok={cronProtegido()}>
                    Tarefas automáticas {cronProtegido() ? 'protegidas por CRON_SECRET' : <>sem senha própria: crie <code className="rounded bg-surface-2 px-1">CRON_SECRET</code> na Vercel</>}
                  </Item>
                  <Item ok={!!backup}>{backup ? `Último backup automático: ${quando(backup.em)}` : 'Backup automático ainda não rodou (roda todo domingo de madrugada)'}</Item>
                </ul>
              </Card>
              <Card title="Backup">
                <p className="text-[13px] text-muted">Baixa um arquivo com tudo do sistema (clientes, leads, tarefas, cobranças, contratos, relatórios). Guarde no seu Google Drive. Toda semana o sistema também guarda uma cópia sozinho no Supabase (as 8 últimas).</p>
                <a href="/api/backup" className={`${btn.secondary} mt-3`}>
                  Baixar backup agora
                </a>
              </Card>
            </div>
            <Card
              flush
              title="Acessos recentes"
              aside={<SairDeTodos action={sairDeTodos} />}
            >
              <ul className="divide-y divide-line">
                {acessos.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-[13px]">
                    <span className={`font-semibold ${EVENTOS[a.evento]?.ruim ? 'text-danger' : ''}`}>{EVENTOS[a.evento]?.label ?? a.evento}</span>
                    <span className="text-muted">{a.navegador ? nomeDoAparelho(a.navegador) : ''}</span>
                    <span className="ml-auto text-[12px] tabular-nums text-muted">
                      {quando(a.created_at)} · {a.ip ?? '—'}
                    </span>
                  </li>
                ))}
                {!acessos.length && <li className="px-4 py-6 text-center text-[13px] text-muted">Nenhum acesso registrado ainda.</li>}
              </ul>
            </Card>
          </div>
        )}
      </Body>
    </>
  );
}

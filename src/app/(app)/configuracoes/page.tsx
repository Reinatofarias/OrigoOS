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
import { btn } from '@/components/ui';

const TABS = ['servicos', 'onboarding', 'rotina', 'empresa', 'app', 'asaas'] as const;
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
            { key: 'app', label: 'App e lembrete', href: '/configuracoes?tab=app' },
            { key: 'asaas', label: 'Asaas', href: '/configuracoes?tab=asaas' },
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
            <Card title="Lembrete das 7h51">
              <p className="mb-3 text-[13px] text-muted">
                De segunda a sexta, às 7h51, chega uma notificação com as 3 tarefas mais importantes do dia, os contatos de prospecção e as cobranças vencendo.
              </p>
              <Lembrete />
            </Card>
            <Card title="Instalar no celular">
              <ol className="grid list-decimal gap-2 pl-5 text-[13.5px] leading-relaxed">
                <li>
                  <strong>iPhone:</strong> abra o sistema no Safari, toque em Compartilhar e depois em &quot;Adicionar à Tela de Início&quot;.
                </li>
                <li>
                  <strong>Android:</strong> abra no Chrome, toque nos três pontinhos e em &quot;Instalar app&quot;.
                </li>
                <li>Abra pelo ícone do Origo OS e ligue o lembrete aqui nesta tela, no próprio celular.</li>
              </ol>
              <p className="mt-3 text-[13px] text-muted">
                Em qualquer tela, o botão <strong>+</strong> (ou a tecla N no computador) abre a captura rápida: fale ou escreva &quot;ligar pro Matheus amanhã urgente&quot; e vira tarefa.
              </p>
            </Card>
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
      </Body>
    </>
  );
}

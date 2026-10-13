import { db, type Service } from '@/lib/db';
import { Body, Card, PageHeader } from '@/components/ui';
import { ContratoEscolhas } from '@/components/contrato-escolhas';
import { novoContrato } from '@/app/actions';

export default async function NovoContratoPage({ searchParams }: PageProps<'/contratos/novo'>) {
  const sp = await searchParams;
  const supa = db();
  const [{ data: ss }, { data: cs }] = await Promise.all([
    supa.from('services').select('*').eq('ativo', true).order('ordem'),
    supa.from('clients').select('id, nome, mensalidade, dia_vencimento, plataforma').eq('ativo', true).order('nome'),
  ]);
  const clientes = cs ?? [];
  const pedido = typeof sp.cliente === 'string' && clientes.some((c) => c.id === sp.cliente) ? sp.cliente : '';

  return (
    <>
      <PageHeader trail={[{ href: '/contratos', label: 'Contratos' }]} title="Novo contrato" subtitle="Escolha o tipo e os serviços. O cliente preenche os dados dele no link e assina." />
      <Body>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card>
            <ContratoEscolhas servicos={(ss ?? []) as Service[]} clientes={clientes} clienteInicial={pedido} acao={novoContrato} botao="Criar contrato e pegar o link" />
          </Card>
          <Card title="Depois de criar">
            <ol className="grid list-decimal gap-2 pl-4 text-[13px] leading-relaxed text-muted">
              <li>Você confere o texto e manda o link pelo WhatsApp.</li>
              <li>O cliente abre, preenche os dados dele (CPF, endereço, empresa) e clica em Assinar.</li>
              <li>Se ainda não era cliente, ele entra em Clientes sozinho, com os serviços do contrato.</li>
              <li>Fica faltando só a cobrança.</li>
            </ol>
          </Card>
        </div>
      </Body>
    </>
  );
}

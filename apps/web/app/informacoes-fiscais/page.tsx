import { PublicPage } from "@/components/public/public-chrome";
import { publicPageMetadata } from "@/lib/site";

export const metadata = publicPageMetadata({
  title: "Informações fiscais",
  description: "Entenda o escopo fiscal da assinatura do AX Finance e a diferença entre controle financeiro e emissão de documentos fiscais.",
  path: "/informacoes-fiscais",
});

export default function FiscalInformationPage() {
  return <PublicPage eyebrow="Transparência de cobrança" title="Informações fiscais" intro="O que a assinatura cobre e como separar o documento da AX Finance dos documentos da sua empresa.">
    <section><h2>Assinatura do AX Finance</h2><p>A assinatura remunera o acesso a um software como serviço. O documento fiscal da assinatura deverá ser emitido pela pessoa jurídica operadora do AX Finance conforme seu enquadramento e as regras municipais aplicáveis, usando os dados de cobrança informados pela contratante.</p></section>
    <section><h2>Operações da empresa usuária</h2><p>O AX Finance não emite nota fiscal, recibo fiscal ou documento tributário para vendas e serviços realizados pela empresa usuária. Lançamentos e anexos servem ao controle financeiro e não substituem o sistema fiscal ou a orientação do contador da contratante.</p></section>
    <section><h2>Processo antes da primeira cobrança</h2><ol><li>Confirmar razão social, CNPJ, inscrição municipal e município emissor da operadora.</li><li>Validar código de serviço, retenções e regime tributário com o contador.</li><li>Definir integração ou rotina de emissão de NFS-e após confirmação do pagamento.</li><li>Enviar o documento ao e-mail de cobrança e manter vínculo com a transação.</li><li>Documentar correção, cancelamento e reemissão.</li></ol></section>
    <aside className="public-legal-note"><strong>Cobrança comercial bloqueada até validação contábil.</strong><p>Esta página define o processo, mas não inventa município, código de serviço, alíquota ou obrigação fiscal. Esses campos precisam ser aprovados pelo contador da entidade que fará a cobrança.</p></aside>
  </PublicPage>;
}

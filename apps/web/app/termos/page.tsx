import { PublicPage } from "@/components/public/public-chrome";
import { publicPageMetadata } from "@/lib/site";

export const metadata = publicPageMetadata({
  title: "Termos de uso",
  description: "Consulte as condições aplicáveis ao acesso, uso, cobrança, suporte e encerramento do AX Finance.",
  path: "/termos",
});

export default function TermsPage() {
  return <PublicPage eyebrow="Versão 1.0 · vigência em 29/09/2026" title="Termos de uso" intro="Regras aplicáveis ao acesso e uso do AX Finance, serviço operado pela AX Cloud.">
    <section><h2>1. Objeto e aceite</h2><p>Estes Termos regulam o uso do AX Finance, plataforma de organização e acompanhamento financeiro empresarial. Ao criar uma conta ou aceitar um convite, o usuário declara que leu e concorda com estes Termos e com a Política de Privacidade.</p></section>
    <section><h2>2. Natureza do serviço</h2><p>O AX Finance oferece registro de contas a pagar e receber, movimentações, importação e conciliação, relatórios e recursos de colaboração. O serviço não presta consultoria contábil, jurídica, tributária ou de investimentos e não substitui a conferência profissional aplicável à empresa contratante.</p></section>
    <section><h2>3. Conta e responsabilidades</h2><ul><li>O proprietário da empresa é responsável por convidar usuários e revisar suas permissões.</li><li>Cada usuário deve manter credenciais individuais, seguras e atualizadas.</li><li>Os dados inseridos, importados e conciliados devem ser conferidos pela contratante.</li><li>É proibido usar o serviço para fraude, invasão, distribuição de malware ou violação de direitos de terceiros.</li></ul></section>
    <section><h2>4. Planos, avaliação e cobrança</h2><p>O período de avaliação, preço, ciclo e limites aplicáveis são apresentados antes da contratação. Alterações de preço para ciclos futuros serão comunicadas com antecedência razoável. Tributos e documentos fiscais da assinatura seguem a legislação e o processo descrito em Informações fiscais.</p></section>
    <section><h2>5. Cancelamento e portabilidade</h2><p>O proprietário pode agendar o cancelamento na área Assinatura. A data efetiva será exibida antes da confirmação. Enquanto a conta estiver acessível, o proprietário poderá gerar a exportação final. O cancelamento não apaga automaticamente registros que precisem ser preservados para segurança, defesa de direitos ou obrigação legal.</p></section>
    <section><h2>6. Disponibilidade e suporte</h2><p>Empregamos medidas razoáveis para manter o serviço disponível e íntegro, mas manutenções, falhas de fornecedores e eventos fora de controle podem causar interrupções. Os canais, horários e metas de resposta estão publicados na Política de suporte e não constituem disponibilidade 24 horas.</p></section>
    <section><h2>7. Propriedade intelectual</h2><p>A AX Cloud mantém os direitos sobre software, marca, interface e documentação. A contratante mantém os direitos sobre seus dados. A contratação concede apenas licença limitada, revogável e não transferível para uso durante a vigência.</p></section>
    <section><h2>8. Suspensão e encerramento</h2><p>O acesso pode ser limitado em caso de risco de segurança, abuso, ordem legal ou inadimplência, com comunicação quando possível. A suspensão não autoriza alteração dos registros financeiros nem elimina o direito de solicitar portabilidade nos limites aplicáveis.</p></section>
    <section><h2>9. Limitação responsável</h2><p>Relatórios dependem dos dados informados e das conciliações realizadas. A contratante deve validar saldos, obrigações e documentos antes de decisões relevantes. Nada nestes Termos exclui responsabilidades que não possam ser afastadas pela legislação brasileira.</p></section>
    <section><h2>10. Alterações e contato</h2><p>Versões futuras indicarão a data de vigência. Mudanças materiais serão comunicadas pelos canais cadastrados. Dúvidas podem ser enviadas para <a href="mailto:contato@axcloud.com.br">contato@axcloud.com.br</a>.</p></section>
    <aside className="public-legal-note"><strong>Revisão profissional necessária antes da primeira contratação comercial.</strong><p>Este texto é uma versão operacional completa, mas a identificação societária, foro, tributação e contratos empresariais devem ser confirmados pelo jurídico responsável pela operação.</p></aside>
  </PublicPage>;
}

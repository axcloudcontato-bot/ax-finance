import { PublicPage } from "@/components/public/public-chrome";
import { publicPageMetadata } from "@/lib/site";

export const metadata = publicPageMetadata({
  title: "Política de privacidade",
  description: "Entenda como o AX Finance trata dados pessoais e registros financeiros em conformidade com a LGPD.",
  path: "/privacidade",
});

export default function PrivacyPage() {
  return <PublicPage eyebrow="Versão 1.0 · vigência em 29/09/2026" title="Política de privacidade" intro="Como o AX Finance trata dados pessoais e registros financeiros no contexto da LGPD.">
    <section><h2>1. Quem controla os dados</h2><p>A AX Cloud opera o AX Finance e atua como controladora dos dados de cadastro, contratação e relacionamento. Para dados pessoais inseridos pela empresa contratante em sua rotina financeira, a AX Cloud atua conforme as instruções da contratante e as obrigações aplicáveis. Contato: <a href="mailto:contato@axcloud.com.br">contato@axcloud.com.br</a>.</p></section>
    <section><h2>2. Dados tratados</h2><ul><li>Cadastro: nome, e-mail, credenciais protegidas e preferências de segurança.</li><li>Empresa: identificação, usuários, permissões e configurações.</li><li>Financeiro: títulos, pessoas, categorias, contas, extratos, anexos e histórico operacional.</li><li>Técnico: endereço IP, eventos de autenticação, registros de auditoria, erros e métricas sem conteúdo financeiro desnecessário.</li><li>Atendimento e cobrança: mensagens de suporte, plano, ciclo e estado da assinatura.</li></ul></section>
    <section><h2>3. Finalidades e bases</h2><p>Tratamos os dados para executar o contrato, autenticar usuários, manter a segurança, entregar funcionalidades, atender solicitações, cumprir obrigações legais e exercer direitos. Comunicações promocionais opcionais dependem de canal apropriado e podem ser interrompidas.</p></section>
    <section><h2>4. Compartilhamento</h2><p>Dados podem ser processados por fornecedores necessários de hospedagem, banco de dados, armazenamento, e-mail, observabilidade, atendimento e pagamento. Esses fornecedores devem receber apenas o mínimo necessário e estar sujeitos a obrigações de confidencialidade e segurança. Não vendemos dados pessoais ou financeiros.</p></section>
    <section><h2>5. Segurança</h2><p>Utilizamos controle de acesso por empresa, sessões revogáveis, autenticação em duas etapas, trilha de auditoria, criptografia de segredos, backups e monitoramento. Nenhum sistema elimina todo risco; incidentes relevantes serão tratados e comunicados conforme a legislação aplicável.</p></section>
    <section><h2>6. Retenção e encerramento</h2><p>Os dados permanecem enquanto a conta estiver ativa e pelo período necessário para portabilidade, segurança, prevenção a fraude, exercício de direitos e obrigações legais. O cancelamento não produz eliminação automática. Solicitações de eliminação são avaliadas considerando obrigações de retenção; backups são eliminados conforme seu ciclo operacional.</p></section>
    <section><h2>7. Direitos do titular</h2><p>O titular pode solicitar confirmação de tratamento, acesso, correção, portabilidade, informação sobre compartilhamentos, oposição ou eliminação quando aplicável. Para proteger a conta, poderemos confirmar identidade e vínculo com a empresa antes de responder.</p></section>
    <section><h2>8. Transferências e cookies</h2><p>Fornecedores podem processar dados fora do Brasil quando houver salvaguardas contratuais e técnicas adequadas. Utilizamos cookies estritamente necessários para sessão e segurança; recursos opcionais serão informados antes de sua ativação.</p></section>
    <section><h2>9. Contato</h2><p>Solicitações de privacidade devem ser enviadas para <a href="mailto:contato@axcloud.com.br">contato@axcloud.com.br</a> com o assunto “Privacidade”. Não envie senhas, códigos MFA ou arquivos financeiros completos por e-mail.</p></section>
    <aside className="public-legal-note"><strong>Identificação jurídica pendente de preenchimento.</strong><p>Razão social, CNPJ, endereço do controlador, subprocessadores e encarregado devem ser confirmados antes da publicação comercial definitiva.</p></aside>
  </PublicPage>;
}

import Link from "next/link";
import { PublicPage } from "@/components/public/public-chrome";
import { publicPageMetadata } from "@/lib/site";

export const metadata = publicPageMetadata({
  title: "Cancelamento e exportação",
  description: "Saiba como cancelar o AX Finance, manter acesso até a data efetiva e exportar os dados financeiros da empresa.",
  path: "/cancelamento",
});

export default function CancellationPolicyPage() {
  return <PublicPage eyebrow="Política operacional" title="Cancelamento e exportação" intro="Um encerramento previsível, com data clara e possibilidade de levar os dados.">
    <section><h2>Como cancelar</h2><ol><li>Entre como proprietário da empresa.</li><li>Acesse <strong>Assinatura</strong> no menu lateral.</li><li>Revise a data efetiva apresentada e confirme o agendamento.</li><li>Gere a exportação final antes do término do acesso.</li></ol></section>
    <section><h2>Data efetiva</h2><p>Assinaturas pagas permanecem acessíveis até o fim do ciclo vigente informado na tela. Durante o trial, a data efetiva acompanha o fim da avaliação quando disponível. A solicitação pode ser desfeita antes da data efetiva.</p></section>
    <section><h2>Exportação final</h2><p>O arquivo completo em JSON reúne empresa, contas, categorias, centros de custo, pessoas, títulos, baixas, devoluções, transferências, conciliações, fechamentos, anexos em forma de metadados e auditoria. Os arquivos físicos dos anexos devem ser baixados separadamente.</p></section>
    <section><h2>Retenção e exclusão</h2><p>O cancelamento não elimina dados automaticamente. Pedidos de exclusão serão avaliados conforme obrigações legais, segurança, prevenção a fraude e exercício de direitos. Antes de solicitar exclusão, mantenha uma cópia validada da exportação.</p></section>
    <section><h2>Ajuda durante o encerramento</h2><p>Se a exportação falhar ou o proprietário perder acesso, abra um chamado antes da data efetiva. Solicitações exigem verificação de identidade e vínculo com a empresa.</p><Link href="/suporte">Consultar canais de suporte</Link></section>
  </PublicPage>;
}

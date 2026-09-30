import Link from "next/link";
import { PublicPage } from "@/components/public/public-chrome";
import { publicPageMetadata } from "@/lib/site";

export const metadata = publicPageMetadata({
  title: "Perguntas frequentes",
  description: "Tire dúvidas sobre planos, preços, implantação, segurança, suporte, cancelamento e exportação de dados do AX Finance.",
  path: "/faq",
});

const groups = [
  { title: "Produto e implantação", items: [
    ["Para quem é o AX Finance?", "Para pequenas empresas de serviços que precisam controlar caixa, contas a pagar e receber, extratos e fechamento sem adotar um ERP complexo."],
    ["Preciso importar uma planilha para começar?", "Não. Você pode cadastrar uma conta, informar o saldo inicial e começar com novos lançamentos. A importação pode ser feita depois."],
    ["Quais arquivos podem ser importados?", "CSV com mapeamento assistido de colunas e OFX 1.x ou 2.x. Todo arquivo passa por pré-visualização antes da confirmação."],
    ["Há implantação assistida?", "Sim, como serviço opcional com escopo e preço definidos conforme o volume e a qualidade dos dados."],
  ]},
  { title: "Cobrança e cancelamento", items: [
    ["Quanto custa?", "A Gestão Pessoal custa R$ 29,90 por mês. O plano Essencial, com conciliação bancária, fechamento, auditoria e DRE gerencial, custa R$ 59 por mês."],
    ["O que não está incluído na Gestão Pessoal?", "A versão de R$ 29,90 não inclui fechamento de período, trilha de auditoria, DRE gerencial nem importação e conciliação bancária."],
    ["O trial exige cartão?", "Não. O período de 14 dias não exige cartão."],
    ["Como cancelo?", "O proprietário pode agendar o cancelamento na área Assinatura. O acesso permanece até a data efetiva informada."],
    ["Consigo levar meus dados?", "Sim. Além dos CSVs dos relatórios, o proprietário pode gerar uma exportação completa em JSON na área Assinatura."],
  ]},
  { title: "Segurança e suporte", items: [
    ["Outras empresas conseguem ver meus dados?", "Não. O acesso é isolado por empresa na aplicação e no banco de dados, com testes automatizados de isolamento."],
    ["Posso ativar autenticação em duas etapas?", "Sim. O AX Finance oferece TOTP e códigos de recuperação na área Segurança."],
    ["Como peço ajuda?", "Use o formulário autenticado dentro do produto ou envie e-mail para contato@axcloud.com.br. Nunca envie senhas ou códigos de autenticação."],
    ["O sistema emite nota fiscal para meus clientes?", "Não. O AX Finance controla o financeiro, mas não emite documentos fiscais das operações da sua empresa."],
  ]},
];

export default function FaqPage() {
  return <PublicPage eyebrow="Central de dúvidas" title="Perguntas frequentes" intro="Respostas objetivas sobre implantação, cobrança, segurança e encerramento.">
    {groups.map(group=><section key={group.title}><h2>{group.title}</h2><div className="public-faq-list">{group.items.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section>)}
    <aside className="public-document-callout"><strong>Não encontrou sua dúvida?</strong><p>Fale com o suporte e informe apenas o contexto necessário para o atendimento.</p><Link href="/suporte">Abrir canais de suporte</Link></aside>
  </PublicPage>;
}

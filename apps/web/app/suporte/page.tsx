import Link from "next/link";
import { PublicPage } from "@/components/public/public-chrome";
import { publicPageMetadata } from "@/lib/site";

export const metadata = publicPageMetadata({
  title: "Suporte",
  description: "Conheça os canais, horários, prioridades e orientações para solicitar suporte do AX Finance.",
  path: "/suporte",
});

export default function SupportPolicyPage() {
  return <PublicPage eyebrow="Atendimento responsável" title="Suporte" intro="Canais, horários e prioridades para pedir ajuda sem expor dados desnecessários.">
    <section><h2>Canais</h2><ul><li><strong>Dentro do produto:</strong> formulário autenticado em Configurações → Suporte.</li><li><strong>E-mail:</strong> <a href="mailto:contato@axcloud.com.br">contato@axcloud.com.br</a>.</li></ul><p>O formulário autenticado é recomendado porque identifica a empresa e mantém o histórico do chamado.</p></section>
    <section><h2>Horário</h2><p>Atendimento em dias úteis, das 9h às 18h, horário de Brasília, exceto feriados nacionais. Não oferecemos suporte 24 horas nesta fase.</p></section>
    <section><h2>Prioridade e meta inicial de resposta</h2><dl className="public-policy-grid"><div><dt>Crítica</dt><dd>Indício de vazamento, divergência grave de saldo ou indisponibilidade geral. Triagem em até 4 horas úteis.</dd></div><div><dt>Alta</dt><dd>Fluxo financeiro principal bloqueado sem alternativa. Primeira resposta em até 1 dia útil.</dd></div><div><dt>Normal</dt><dd>Dúvidas, configurações e problemas com alternativa. Primeira resposta em até 2 dias úteis.</dd></div></dl><p>As metas orientam a operação e não representam resolução garantida no mesmo prazo.</p></section>
    <section><h2>O que informar</h2><p>Descreva o resultado esperado, o que ocorreu, data aproximada e tela afetada. Nunca envie senha, código MFA, chave de API ou extrato completo por e-mail. O suporte solicitará informações adicionais somente quando necessário.</p></section>
    <aside className="public-document-callout"><strong>Já possui uma conta?</strong><p>Entre para abrir um chamado vinculado à empresa.</p><Link href="/login?retorno=%2Fconfiguracoes%2Fsuporte">Entrar e abrir chamado</Link></aside>
  </PublicPage>;
}

# Preparação para lançamento comercial

Atualizado em 29/09/2026.

Este documento separa o que o software já executa do que depende de aprovação humana ou contratação externa. Um item externo não deve ser marcado como concluído por evidência apenas técnica.

## Entregas no produto

- Site público: página inicial, planos Gestão Pessoal (R$ 29,90/mês) e Essencial (R$ 59/mês), FAQ, demonstração com dados fictícios, suporte e páginas legais.
- Gestão Pessoal: seleção no onboarding e bloqueio técnico de conciliação bancária, fechamento, auditoria e DRE gerencial.
- Termos e privacidade: textos operacionais versionados e links reais no login.
- Suporte: canal autenticado por empresa, acompanhamento de chamados, e-mail público e política de horário/prioridade.
- Cancelamento: agendamento pelo proprietário, data efetiva visível, possibilidade de desfazer e auditoria.
- Exportação final: arquivo JSON auditado com registros da empresa e metadados dos anexos.
- Transparência fiscal: página que diferencia a assinatura do AX Finance dos documentos fiscais dos clientes.

## Bloqueios externos antes da primeira cobrança

- [ ] Jurídico preencher e validar razão social, CNPJ, endereço, foro, subprocessadores, encarregado e contratos aplicáveis.
- [ ] Contador confirmar município emissor, inscrição municipal, código de serviço, regime, retenções, alíquota e rotina de NFS-e.
- [ ] Responsável comercial aprovar preço de lançamento, limites de uso justo, escopo da implantação e política de reembolso.
- [ ] Operações testar um cancelamento e uma exportação completa em homologação, incluindo leitura independente do JSON.
- [ ] Operações validar que anexos necessários foram baixados separadamente antes do encerramento.
- [ ] Configurar a Stripe em produção e testar ponta a ponta com chaves de teste (checkout, falha de cartão, cancelamento, portal) — roteiro em `docs/stripe-billing.md`. A integração existe, mas só passou por testes automatizados com a Stripe simulada; a conciliação periódica com o provedor roda no worker e a assinatura suspensa, encerrada ou com o trial vencido sem pagamento já bloqueia escrita (leitura e exportação seguem liberadas).
- [ ] Publicar identificação e canais definitivos nos documentos jurídicos.

## Evidência de aceite

Cada aprovação deve registrar data, responsável, versão revisada, pendências e link para o documento assinado ou parecer. Evitar registrar documentos confidenciais diretamente no repositório público.

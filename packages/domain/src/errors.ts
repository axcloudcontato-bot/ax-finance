export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class EmailAlreadyRegisteredError extends DomainError {
  constructor() {
    super("Este e-mail já está cadastrado.", "EMAIL_ALREADY_REGISTERED");
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super("E-mail ou senha inválidos.", "INVALID_CREDENTIALS");
  }
}

export class EmailNotVerifiedError extends DomainError {
  constructor() {
    super("Confirme seu e-mail antes de entrar.", "EMAIL_NOT_VERIFIED");
  }
}

export class TooManyLoginAttemptsError extends DomainError {
  constructor() {
    super(
      "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.",
      "TOO_MANY_LOGIN_ATTEMPTS"
    );
  }
}

export class InvalidAccountTokenError extends DomainError {
  constructor() {
    super("Este link é inválido, expirou ou já foi utilizado.", "INVALID_ACCOUNT_TOKEN");
  }
}

export class NotAuthenticatedError extends DomainError {
  constructor() {
    super("Sessão inválida ou expirada.", "NOT_AUTHENTICATED");
  }
}

export class MfaConfigurationError extends DomainError {
  constructor() {
    super("A chave de criptografia da autenticação em duas etapas não está configurada.", "MFA_CONFIGURATION_ERROR");
  }
}

export class MfaAlreadyEnabledError extends DomainError {
  constructor() {
    super("A autenticação em duas etapas já está ativa.", "MFA_ALREADY_ENABLED");
  }
}

export class MfaNotEnabledError extends DomainError {
  constructor() {
    super("A autenticação em duas etapas não está ativa.", "MFA_NOT_ENABLED");
  }
}

export class InvalidMfaCodeError extends DomainError {
  constructor() {
    super("Código inválido ou já utilizado.", "INVALID_MFA_CODE");
  }
}

export class MfaChallengeInvalidError extends DomainError {
  constructor() {
    super("O desafio de autenticação expirou ou é inválido. Entre novamente.", "MFA_CHALLENGE_INVALID");
  }
}

export class OutboxConfigurationError extends DomainError {
  constructor() {
    super("A chave de criptografia da fila de eventos não está configurada.", "OUTBOX_CONFIGURATION_ERROR");
  }
}

export class IdempotencyConflictError extends DomainError {
  constructor() {
    super(
      "Esta chave de idempotência já foi usada com dados diferentes.",
      "IDEMPOTENCY_CONFLICT"
    );
  }
}

export class IdempotencyResultUnavailableError extends DomainError {
  constructor() {
    super("O resultado idempotente não está mais disponível.", "IDEMPOTENCY_RESULT_UNAVAILABLE");
  }
}

/**
 * Lançado sempre que o usuário autenticado não tem associação ATIVA com a
 * empresa solicitada. Nunca deve revelar se a empresa existe ou não
 * (Seção 17/22: autorização por associação ativa, não pelo conhecimento do id).
 */
export class CompanyAccessDeniedError extends DomainError {
  constructor() {
    super("Empresa não encontrada ou acesso não autorizado.", "COMPANY_ACCESS_DENIED");
  }
}

export class CompanyPermissionDeniedError extends DomainError {
  constructor() {
    super("Você não tem permissão para realizar esta ação.", "COMPANY_PERMISSION_DENIED");
  }
}

export class CompanyInvitationInvalidError extends DomainError {
  constructor() {
    super("Este convite é inválido, expirou ou já foi utilizado.", "COMPANY_INVITATION_INVALID");
  }
}

export class CompanyInvitationEmailMismatchError extends DomainError {
  constructor() {
    super(
      "Este convite foi enviado para outro endereço de e-mail.",
      "COMPANY_INVITATION_EMAIL_MISMATCH"
    );
  }
}

export class CompanyMemberNotFoundError extends DomainError {
  constructor() {
    super("Usuário da empresa não encontrado.", "COMPANY_MEMBER_NOT_FOUND");
  }
}

export class CompanyMemberAlreadyActiveError extends DomainError {
  constructor() {
    super("Este e-mail já possui acesso ativo à empresa.", "COMPANY_MEMBER_ALREADY_ACTIVE");
  }
}

export class CompanyOwnerProtectedError extends DomainError {
  constructor() {
    super(
      "O proprietário não pode ser removido nem ter o papel alterado por este fluxo.",
      "COMPANY_OWNER_PROTECTED"
    );
  }
}

export class CompanyOwnershipTransferInvalidError extends DomainError {
  constructor() {
    super("O novo proprietário precisa ser um usuário ativo diferente do proprietário atual.", "COMPANY_OWNERSHIP_TRANSFER_INVALID");
  }
}

export class CompanyResetConfirmationError extends DomainError {
  constructor() {
    super("Digite o nome exato da empresa para confirmar o reset.", "COMPANY_RESET_CONFIRMATION_INVALID");
  }
}

export class CompanyAccessScopeInvalidError extends DomainError {
  constructor() {
    super("Uma restrição de acesso selecionada não pertence a esta empresa.", "COMPANY_ACCESS_SCOPE_INVALID");
  }
}

export class CostCenterNotFoundError extends DomainError {
  constructor() {
    super("Centro de custo não encontrado.", "COST_CENTER_NOT_FOUND");
  }
}

/** Seção 9: modelo P0 é de dois níveis — categoria e subcategoria, nada além disso. */
export class CategoryDepthExceededError extends DomainError {
  constructor() {
    super(
      "Categorias só podem ter dois níveis (categoria e subcategoria).",
      "CATEGORY_DEPTH_EXCEEDED"
    );
  }
}

export class CategoryNotFoundError extends DomainError {
  constructor() {
    super("Categoria não encontrada.", "CATEGORY_NOT_FOUND");
  }
}

export class TitleNotFoundError extends DomainError {
  constructor() {
    super("Título não encontrado.", "TITLE_NOT_FOUND");
  }
}

export class FinancialAccountNotFoundError extends DomainError {
  constructor() {
    super("Conta não encontrada.", "FINANCIAL_ACCOUNT_NOT_FOUND");
  }
}

/** Seção 6: baixa não pode liquidar mais principal do que o saldo aberto do título. */
export class SettlementExceedsBalanceError extends DomainError {
  constructor() {
    super("O valor da baixa é maior que o saldo aberto do título.", "SETTLEMENT_EXCEEDS_BALANCE");
  }
}

export class TitleNotOpenError extends DomainError {
  constructor() {
    super("Título cancelado não aceita baixa.", "TITLE_NOT_OPEN");
  }
}

/** Seção 6: cancelamento só é permitido quando não há baixa ativa. */
export class TitleHasActiveSettlementsError extends DomainError {
  constructor() {
    super(
      "Este título tem baixas ativas — estorne-as antes de cancelar o saldo.",
      "TITLE_HAS_ACTIVE_SETTLEMENTS"
    );
  }
}

export class SettlementAlreadyReversedError extends DomainError {
  constructor() {
    super("Esta baixa já foi estornada.", "SETTLEMENT_ALREADY_REVERSED");
  }
}

export class SettlementNotFoundError extends DomainError {
  constructor() {
    super("Baixa não encontrada.", "SETTLEMENT_NOT_FOUND");
  }
}

export class SettlementRefundExceedsCashError extends DomainError {
  constructor() {
    super("A devolução excede o valor de caixa movimentado por esta baixa.", "SETTLEMENT_REFUND_EXCEEDS_CASH");
  }
}

export class SettlementRefundNotFoundError extends DomainError {
  constructor() {
    super("Devolução não encontrada.", "SETTLEMENT_REFUND_NOT_FOUND");
  }
}

export class SettlementHasActiveRefundsError extends DomainError {
  constructor() {
    super("Estorne as devoluções desta baixa antes de estornar a baixa original.", "SETTLEMENT_HAS_ACTIVE_REFUNDS");
  }
}

export class TitleAllocationTotalInvalidError extends DomainError {
  constructor() {
    super("A soma do rateio deve ser exatamente igual ao valor original do título.", "TITLE_ALLOCATION_TOTAL_INVALID");
  }
}

export class TitleAmountBelowSettledError extends DomainError {
  constructor() {
    super("O valor do título não pode ser menor que o principal já liquidado.", "TITLE_AMOUNT_BELOW_SETTLED");
  }
}

export class FinancialAccountHasBalanceError extends DomainError {
  constructor() {
    super("Zere o saldo da conta antes de arquivá-la.", "FINANCIAL_ACCOUNT_HAS_BALANCE");
  }
}

export class TitleBatchInvalidError extends DomainError {
  constructor(message = "Um ou mais títulos não podem receber esta operação em lote.") {
    super(message, "TITLE_BATCH_INVALID");
  }
}

/** Seção 8: as duas pontas de uma transferência precisam ser contas diferentes. */
export class TransferSameAccountError extends DomainError {
  constructor() {
    super("A conta de origem e destino não podem ser a mesma.", "TRANSFER_SAME_ACCOUNT");
  }
}

export class TransferNotFoundError extends DomainError {
  constructor() {
    super("Transferência não encontrada.", "TRANSFER_NOT_FOUND");
  }
}

export class TransferAlreadyReversedError extends DomainError {
  constructor() {
    super("Esta transferência já foi estornada.", "TRANSFER_ALREADY_REVERSED");
  }
}

export class PartyNotFoundError extends DomainError {
  constructor() {
    super("Cliente/fornecedor não encontrado.", "PARTY_NOT_FOUND");
  }
}

/** Seção 10: papéis cliente/fornecedor podem coexistir, mas pelo menos um é obrigatório. */
export class PartyRoleRequiredError extends DomainError {
  constructor() {
    super("Selecione ao menos um papel: cliente ou fornecedor.", "PARTY_ROLE_REQUIRED");
  }
}

/** Seção 10: impede duplicação evidente de documento normalizado na empresa; homônimos sem documento são permitidos. */
export class PartyDocumentAlreadyExistsError extends DomainError {
  constructor() {
    super("Já existe uma pessoa com este documento nesta empresa.", "PARTY_DOCUMENT_ALREADY_EXISTS");
  }
}

/** Seção 11: um parcelamento precisa de ao menos 2 parcelas — 1 seria um título avulso. */
export class InstallmentCountInvalidError extends DomainError {
  constructor() {
    super("O parcelamento precisa de ao menos 2 parcelas.", "INSTALLMENT_COUNT_INVALID");
  }
}

/** Seção 11: cada parcela precisa valer ao menos 1 centavo. */
export class InstallmentAmountTooSmallError extends DomainError {
  constructor() {
    super("O valor total é pequeno demais para o número de parcelas.", "INSTALLMENT_AMOUNT_TOO_SMALL");
  }
}

export class RecurrenceRuleNotFoundError extends DomainError {
  constructor() {
    super("Recorrência não encontrada.", "RECURRENCE_RULE_NOT_FOUND");
  }
}

export class RecurrenceEndDateBeforeStartError extends DomainError {
  constructor() {
    super("A data de término não pode ser anterior à data de início.", "RECURRENCE_END_DATE_BEFORE_START");
  }
}

/** Seção 12: nenhuma linha válida no arquivo (todas em branco/malformadas). */
export class ImportFileInvalidError extends DomainError {
  constructor() {
    super("Nenhuma linha válida encontrada no arquivo.", "IMPORT_FILE_INVALID");
  }
}

export class ImportFileTooManyRowsError extends DomainError {
  constructor() {
    super("O arquivo deve ter no máximo 100.000 lançamentos.", "IMPORT_FILE_TOO_MANY_ROWS");
  }
}

export class ImportBatchNotFoundError extends DomainError {
  constructor() {
    super("Importação não encontrada.", "IMPORT_BATCH_NOT_FOUND");
  }
}

export class ImportBatchInvalidStateError extends DomainError {
  constructor() {
    super("Esta importação não está disponível para essa operação.", "IMPORT_BATCH_INVALID_STATE");
  }
}

export class ImportBatchInProgressError extends DomainError {
  constructor() {
    super("Esta importação está na fila ou sendo processada. Aguarde terminar para removê-la.", "IMPORT_BATCH_IN_PROGRESS");
  }
}

export class ImportBatchHasWorkedLinesError extends DomainError {
  constructor() {
    super(
      "Há linhas desta importação já conciliadas ou ignoradas. Desfaça essas conciliações (ou reative as linhas ignoradas) para poder remover o extrato.",
      "IMPORT_BATCH_HAS_WORKED_LINES"
    );
  }
}

export class BankStatementLineNotFoundError extends DomainError {
  constructor() {
    super("Linha do extrato não encontrada.", "BANK_STATEMENT_LINE_NOT_FOUND");
  }
}

/** Seção 12: só dá pra conciliar ou ignorar uma linha ainda pendente. */
export class BankStatementLineAlreadyProcessedError extends DomainError {
  constructor() {
    super("Esta linha já foi conciliada ou ignorada.", "BANK_STATEMENT_LINE_ALREADY_PROCESSED");
  }
}

/** Seção 12: vínculo é 1:1 — uma baixa só pode ser conciliada com uma linha do extrato. */
export class SettlementAlreadyReconciledError extends DomainError {
  constructor() {
    super("Esta baixa já está conciliada com outra linha do extrato.", "SETTLEMENT_ALREADY_RECONCILED");
  }
}

/** Seção 18 regra 8: período fechado bloqueia baixa/estorno cuja data efetiva cai nele. */
export class PeriodClosedError extends DomainError {
  constructor(period: string) {
    super(`O período ${period} está fechado e não aceita novas baixas ou estornos.`, "PERIOD_CLOSED");
  }
}

export class PeriodClosureNotFoundError extends DomainError {
  constructor() {
    super("Este período não está fechado.", "PERIOD_CLOSURE_NOT_FOUND");
  }
}

export class InstallmentGroupNotFoundError extends DomainError {
  constructor() {
    super("Parcelamento não encontrado.", "INSTALLMENT_GROUP_NOT_FOUND");
  }
}

/** Ajuste de saldo: o saldo alvo informado já é exatamente o saldo atual — nada a fazer. */
export class BalanceAdjustmentNotNeededError extends DomainError {
  constructor() {
    super("O saldo informado já é o saldo atual desta conta.", "BALANCE_ADJUSTMENT_NOT_NEEDED");
  }
}

export class BalanceAdjustmentNotFoundError extends DomainError {
  constructor() {
    super("Ajuste de saldo não encontrado.", "BALANCE_ADJUSTMENT_NOT_FOUND");
  }
}

export class BalanceAdjustmentAlreadyReversedError extends DomainError {
  constructor() {
    super("Este ajuste já foi estornado.", "BALANCE_ADJUSTMENT_ALREADY_REVERSED");
  }
}

export class AttachmentNotFoundError extends DomainError {
  constructor() {
    super("Anexo não encontrado.", "ATTACHMENT_NOT_FOUND");
  }
}

export class PlatformAdminAccessDeniedError extends DomainError {
  constructor() {
    super("Acesso restrito à administração interna.", "PLATFORM_ADMIN_ACCESS_DENIED");
  }
}

export class PlatformAdminMfaRequiredError extends DomainError {
  constructor() {
    super(
      "A administração interna exige autenticação em duas etapas. Ative em Configurações > Segurança da conta.",
      "PLATFORM_ADMIN_MFA_REQUIRED"
    );
  }
}

export class AdminJobReprocessInvalidError extends DomainError {
  constructor(message = "Este job não está em um estado seguro para reprocessamento.") {
    super(message, "ADMIN_JOB_REPROCESS_INVALID");
  }
}

export class SupportCaseNotFoundError extends DomainError {
  constructor() {
    super("Chamado de suporte não encontrado.", "SUPPORT_CASE_NOT_FOUND");
  }
}

export class IncidentNotFoundError extends DomainError {
  constructor() {
    super("Incidente não encontrado.", "INCIDENT_NOT_FOUND");
  }
}

export class SubscriptionWriteBlockedError extends DomainError {
  constructor(reason: "SUSPENDED" | "ENDED" | "TRIAL_ENDED") {
    super(
      reason === "SUSPENDED"
        ? "A assinatura desta empresa está suspensa por falta de pagamento. Você ainda pode consultar e exportar os dados; regularize em Configurações → Assinatura para voltar a lançar."
        : reason === "TRIAL_ENDED"
          ? "O período de avaliação desta empresa terminou. Você ainda pode consultar e exportar os dados; assine um plano em Configurações → Assinatura para voltar a lançar."
          : "A assinatura desta empresa foi encerrada. Você ainda pode consultar e exportar os dados; assine novamente em Configurações → Assinatura para voltar a lançar.",
      "SUBSCRIPTION_WRITE_BLOCKED"
    );
  }
}

export class SubscriptionCancellationInvalidError extends DomainError {
  constructor() {
    super("A assinatura não está disponível para esta alteração de cancelamento.", "SUBSCRIPTION_CANCELLATION_INVALID");
  }
}

export class PlanFeatureUnavailableError extends DomainError {
  constructor(planName: string) {
    super(
      `Este recurso não está disponível no plano ${planName}. Consulte a assinatura para conhecer as opções.`,
      "PLAN_FEATURE_UNAVAILABLE"
    );
  }
}

export class CreditCardNotFoundError extends DomainError {
  constructor() {
    super("Cartão de crédito não encontrado ou arquivado.", "CREDIT_CARD_NOT_FOUND");
  }
}

export class CreditCardInvoiceNotFoundError extends DomainError {
  constructor() {
    super("Fatura não encontrada.", "CREDIT_CARD_INVOICE_NOT_FOUND");
  }
}

export class CreditCardPurchaseNotFoundError extends DomainError {
  constructor() {
    super("Compra não encontrada.", "CREDIT_CARD_PURCHASE_NOT_FOUND");
  }
}

export class CreditCardPurchaseAlreadyCanceledError extends DomainError {
  constructor() {
    super("Esta compra já foi cancelada.", "CREDIT_CARD_PURCHASE_ALREADY_CANCELED");
  }
}

export class CreditCardAccessRestrictedError extends DomainError {
  constructor() {
    super(
      "Seu acesso é restrito a centros de custo. O cartão de crédito reúne compras de vários centros numa só fatura e fica disponível para quem tem acesso total.",
      "CREDIT_CARD_ACCESS_RESTRICTED"
    );
  }
}

export class CreditCardInvoicePaidError extends DomainError {
  constructor(referenceMonth: string) {
    const [year, month] = referenceMonth.split("-");
    super(
      `A fatura de ${month}/${year} já foi paga. Estorne o pagamento dela para alterar as compras, ou lance a compra em outra data.`,
      "CREDIT_CARD_INVOICE_PAID"
    );
  }
}

export class CreditCardInvoiceBelowSettledError extends DomainError {
  constructor(referenceMonth: string) {
    const [year, month] = referenceMonth.split("-");
    super(
      `A fatura de ${month}/${year} já recebeu pagamentos maiores que o novo total. Estorne o pagamento antes de cancelar esta compra.`,
      "CREDIT_CARD_INVOICE_BELOW_SETTLED"
    );
  }
}

export class CreditCardHasPaymentsError extends DomainError {
  constructor() {
    super(
      "Este cartão tem fatura com pagamento registrado (mesmo que estornado), então não pode ser excluído. Arquive o cartão: o histórico fica guardado.",
      "CREDIT_CARD_HAS_PAYMENTS"
    );
  }
}

export class CreditCardHasOpenInvoicesError extends DomainError {
  constructor() {
    super("Este cartão ainda tem fatura em aberto. Pague ou cancele as compras antes de arquivá-lo.", "CREDIT_CARD_HAS_OPEN_INVOICES");
  }
}

export class CreditCardInstallmentCountInvalidError extends DomainError {
  constructor() {
    super("O número de parcelas deve ser de 1 a 48, e cada parcela precisa ter pelo menos R$ 0,01.", "CREDIT_CARD_INSTALLMENT_COUNT_INVALID");
  }
}

export class TitleManagedByCreditCardError extends DomainError {
  constructor() {
    super(
      "Este título é a fatura de um cartão de crédito e o valor dele vem das compras. Ajuste as compras na fatura, ou registre o pagamento aqui normalmente.",
      "TITLE_MANAGED_BY_CREDIT_CARD"
    );
  }
}

export class CreditCardCategoryInvalidError extends DomainError {
  constructor() {
    super("Escolha uma categoria de despesa ou custo para a compra no cartão.", "CREDIT_CARD_CATEGORY_INVALID");
  }
}

export class CreditCardInvoiceNotPayableError extends DomainError {
  constructor(closingDate: string) {
    const [year, month, day] = closingDate.split("-");
    super(
      `A fatura ainda está aberta e recebendo compras. Ela fecha em ${day}/${month}/${year}; registre o pagamento depois do fechamento.`,
      "CREDIT_CARD_INVOICE_NOT_PAYABLE"
    );
  }
}

export interface PossibleDuplicate {
  id: string;
  description: string;
  dueDate: Date;
  originalAmountCents: bigint;
}

/** Lançamento parecido com um já existente: a pessoa confirma que é outro antes de gravar. */
export class PossibleDuplicateTitleError extends DomainError {
  constructor(public readonly matches: PossibleDuplicate[]) {
    const first = matches[0]!;
    const amount = (Number(first.originalAmountCents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const due = first.dueDate.toISOString().slice(0, 10).split("-").reverse().join("/");
    super(
      `Possível lançamento em duplicidade: já existe "${first.description}" de ${amount} com vencimento próximo (${due}). Se é outro lançamento, confirme para lançar mesmo assim.`,
      "POSSIBLE_DUPLICATE_TITLE"
    );
  }
}

export class TitleScheduleInvalidError extends DomainError {
  constructor() {
    super("Só é possível agendar o pagamento de uma saída ainda em aberto.", "TITLE_SCHEDULE_INVALID");
  }
}

export class TitleCollectionInvalidError extends DomainError {
  constructor() {
    super("A cobrança só se aplica a uma entrada ainda em aberto.", "TITLE_COLLECTION_INVALID");
  }
}

export class SavingsGoalNotFoundError extends DomainError {
  constructor() {
    super("Cofrinho não encontrado.", "SAVINGS_GOAL_NOT_FOUND");
  }
}

export class SavingsGoalInsufficientBalanceError extends DomainError {
  constructor() {
    super("O cofrinho não tem saldo suficiente para isso.", "SAVINGS_GOAL_INSUFFICIENT_BALANCE");
  }
}

export class SavingsGoalNotEmptyError extends DomainError {
  constructor() {
    super("Resgate o saldo do cofrinho antes de arquivá-lo.", "SAVINGS_GOAL_NOT_EMPTY");
  }
}

export class SavingsGoalInUseError extends DomainError {
  constructor() {
    super("Este cofrinho já tem movimentos e não pode ser excluído. Arquive-o.", "SAVINGS_GOAL_IN_USE");
  }
}

export class SavingsGoalArchivedError extends DomainError {
  constructor() {
    super("Este cofrinho está arquivado. Reative-o para movimentar.", "SAVINGS_GOAL_ARCHIVED");
  }
}

export class SavingsGoalFutureDateError extends DomainError {
  constructor() {
    super("A data do movimento não pode ser no futuro.", "SAVINGS_GOAL_FUTURE_DATE");
  }
}

export class InvalidPixKeyError extends DomainError {
  constructor() {
    super("Chave PIX inválida. Use CPF, CNPJ, e-mail, celular com DDD ou a chave aleatória.", "INVALID_PIX_KEY");
  }
}

export class CategoryRuleNotFoundError extends DomainError {
  constructor() {
    super("Regra de categoria não encontrada.", "CATEGORY_RULE_NOT_FOUND");
  }
}

export class DebtNotFoundError extends DomainError {
  constructor() {
    super("Dívida não encontrada.", "DEBT_NOT_FOUND");
  }
}

export class DebtHasPaymentsError extends DomainError {
  constructor() {
    super("Esta dívida já tem parcelas pagas e não pode ser excluída. Arquive-a.", "DEBT_HAS_PAYMENTS");
  }
}

export class AssetNotFoundError extends DomainError {
  constructor() {
    super("Bem ou investimento não encontrado.", "ASSET_NOT_FOUND");
  }
}

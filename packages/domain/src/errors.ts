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

export class NotAuthenticatedError extends DomainError {
  constructor() {
    super("Sessão inválida ou expirada.", "NOT_AUTHENTICATED");
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

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

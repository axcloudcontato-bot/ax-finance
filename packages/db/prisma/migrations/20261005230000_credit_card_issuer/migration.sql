-- Emissor do cartão (chave do catálogo em credit-cards/issuers.ts); só apresentação, sem logo guardada.
ALTER TABLE "credit_cards" ADD COLUMN "issuer" TEXT;

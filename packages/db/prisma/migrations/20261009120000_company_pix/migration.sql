-- Recebimento por PIX: chave, nome e cidade do recebedor usados para gerar o "PIX copia e cola" e o
-- QR Code das cobranças (padrão BR Code do Banco Central, estático, sem integração bancária).
ALTER TABLE "companies"
  ADD COLUMN "pix_key" TEXT,
  ADD COLUMN "pix_receiver_name" TEXT,
  ADD COLUMN "pix_city" TEXT;

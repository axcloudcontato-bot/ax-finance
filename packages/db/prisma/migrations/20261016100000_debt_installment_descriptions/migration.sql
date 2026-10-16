-- Parcelas de dívidas passam a ser descritas como "Nome (1/12)" em vez de
-- "Nome — parcela 1/12". O formato antigo só era gerado pelas dívidas, então
-- basta o padrão no fim da descrição de um título parcelado (inclui parcelas de
-- dívidas já excluídas, que continuam no histórico).
UPDATE "titles"
SET "description" = regexp_replace("description", ' — parcela ([0-9]+)/([0-9]+)$', ' (\1/\2)'),
    "updated_at" = now()
WHERE "installment_group_id" IS NOT NULL
  AND "description" ~ ' — parcela [0-9]+/[0-9]+$';

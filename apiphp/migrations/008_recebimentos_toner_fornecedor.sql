-- 008 — Recebimento de toners: fornecedor opcional por item (lote).
-- A tabela `recebimentos_toner` grava UMA linha por consumivel do lote; o
-- fornecedor e informacao do lote, mas e persistido em cada linha (mesma
-- data/observacao/recebedor) para nao criar tabela de lote paralela.
-- O legado usava `fornecedor_entrada` (VARCHAR livre); aqui referenciamos o
-- cadastro real `fornecedores.id` (opcional, sem FK rigida para preservar o
-- historico caso o fornecedor seja inativado/excluido).
-- Idempotente (padrao da 003): INFORMATION_SCHEMA + PREPARE, pois MySQL nao
-- suporta "ADD COLUMN IF NOT EXISTS".
SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recebimentos_toner' AND COLUMN_NAME = 'fornecedor_id') = 0,
    'ALTER TABLE `recebimentos_toner` ADD COLUMN `fornecedor_id` INT NULL DEFAULT NULL COMMENT ''Cadastro real de fornecedores (opcional)'' AFTER `fornecedor_entrada`',
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recebimentos_toner' AND INDEX_NAME = 'idx_receb_toner_fornecedor') = 0,
    'ALTER TABLE `recebimentos_toner` ADD INDEX `idx_receb_toner_fornecedor` (`fornecedor_id`)',
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

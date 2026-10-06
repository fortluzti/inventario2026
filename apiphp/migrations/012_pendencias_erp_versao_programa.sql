-- 012 — Adicionar versao_programa na tabela pendencias_erp.
-- Idempotente: adiciona a coluna versao_programa caso ainda nao exista.

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pendencias_erp' AND COLUMN_NAME = 'versao_programa') = 0,
    'ALTER TABLE `pendencias_erp` ADD COLUMN `versao_programa` VARCHAR(50) NULL COMMENT "Versão do programa ou ERP que apresentou o problema" AFTER `modulo`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

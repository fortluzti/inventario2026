-- 014 — Metadados de fluxo para atendimentos ERP.
-- Mantem os dados existentes e adiciona a classificacao da interacao
-- junto com o status anterior/novo registrado pela operacao transacional.

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atendimentos_erp' AND COLUMN_NAME = 'tipo_atendimento') = 0,
    'ALTER TABLE `atendimentos_erp`
        ADD COLUMN `tipo_atendimento` ENUM("Envio ao suporte","Retorno do suporte","Correção/atualização","Teste","Observação")
        NOT NULL DEFAULT "Observação" AFTER `metodo_envio`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atendimentos_erp' AND COLUMN_NAME = 'status_anterior') = 0,
    'ALTER TABLE `atendimentos_erp`
        ADD COLUMN `status_anterior` VARCHAR(50) NULL AFTER `protocolo`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atendimentos_erp' AND COLUMN_NAME = 'status_novo') = 0,
    'ALTER TABLE `atendimentos_erp`
        ADD COLUMN `status_novo` VARCHAR(50) NULL AFTER `status_anterior`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atendimentos_erp' AND INDEX_NAME = 'idx_atendimentos_tipo') = 0,
    'ALTER TABLE `atendimentos_erp` ADD INDEX `idx_atendimentos_tipo` (`tipo_atendimento`)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

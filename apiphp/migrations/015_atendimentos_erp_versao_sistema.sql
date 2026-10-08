-- 015 — Versao do sistema registrada em cada atendimento ERP.
-- Campo opcional para preservar o contexto do retorno/envio/teste no historico.

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atendimentos_erp' AND COLUMN_NAME = 'versao_sistema') = 0,
    'ALTER TABLE `atendimentos_erp`
        ADD COLUMN `versao_sistema` VARCHAR(50) NULL AFTER `tipo_atendimento`',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

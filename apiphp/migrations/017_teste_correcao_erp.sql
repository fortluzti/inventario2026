-- 017 — Teste de correção da pendência do ERP (ação "Testar correção").
--
-- Mantém o chamado ÚNICO: o teste é registrado no histórico do mesmo chamado e,
-- quando reprovado, devolve a pendência para 'Aguardando suporte' (sem criar
-- novo chamado) para uma nova rodada de correção.
--
-- Não altera nenhum status oficial (016 continua vigente):
--   'Aguardando suporte' | 'Aguardando testes' | 'Resolvido' | 'Cancelado'
--
-- 1) atendimentos_erp: detalhes estruturados do teste (colunas opcionais;
--    registros antigos continuam válidos com NULL).
-- 2) pendencias_erp: indicador da última reprovação, usado apenas na grid para
--    diferenciar "Aguardando suporte" normal de "Aguardando suporte após teste
--    reprovado". Atualizado na MESMA transação da mudança de status.

-- atendimentos_erp.resultado_teste -------------------------------------------
SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atendimentos_erp' AND COLUMN_NAME = 'resultado_teste') = 0,
    'ALTER TABLE `atendimentos_erp`
        ADD COLUMN `resultado_teste` ENUM("Aprovado","Reprovado") NULL DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- atendimentos_erp.oque_foi_testado ------------------------------------------
SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atendimentos_erp' AND COLUMN_NAME = 'oque_foi_testado') = 0,
    'ALTER TABLE `atendimentos_erp`
        ADD COLUMN `oque_foi_testado` TEXT NULL DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- atendimentos_erp.descricao_detalhada ---------------------------------------
SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atendimentos_erp' AND COLUMN_NAME = 'descricao_detalhada') = 0,
    'ALTER TABLE `atendimentos_erp`
        ADD COLUMN `descricao_detalhada` TEXT NULL DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- atendimentos_erp.tela_modulo ------------------------------------------------
SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atendimentos_erp' AND COLUMN_NAME = 'tela_modulo') = 0,
    'ALTER TABLE `atendimentos_erp`
        ADD COLUMN `tela_modulo` VARCHAR(150) NULL DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- atendimentos_erp.comportamento_esperado ------------------------------------
SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atendimentos_erp' AND COLUMN_NAME = 'comportamento_esperado') = 0,
    'ALTER TABLE `atendimentos_erp`
        ADD COLUMN `comportamento_esperado` TEXT NULL DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- atendimentos_erp.comportamento_encontrado ----------------------------------
SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atendimentos_erp' AND COLUMN_NAME = 'comportamento_encontrado') = 0,
    'ALTER TABLE `atendimentos_erp`
        ADD COLUMN `comportamento_encontrado` TEXT NULL DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- pendencias_erp.ultimo_teste_reprovado ---------------------------------------
SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pendencias_erp' AND COLUMN_NAME = 'ultimo_teste_reprovado') = 0,
    'ALTER TABLE `pendencias_erp`
        ADD COLUMN `ultimo_teste_reprovado` TINYINT(1) NOT NULL DEFAULT 0',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

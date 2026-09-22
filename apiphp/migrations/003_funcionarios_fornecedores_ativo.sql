-- 003 — Status Ativo/Inativo em Funcionários e Fornecedores
-- Banco: inventario2 (ou cópia). Execute com um usuário administrador do MySQL.
-- Compatível com MySQL 8.x (idempotente — usa INFORMATION_SCHEMA + PREPARE,
-- pois MySQL não suporta "ADD COLUMN/INDEX IF NOT EXISTS", que é sintaxe MariaDB).
-- Regra de negócio: registros não são excluídos fisicamente por deixarem de ser
-- utilizados. O campo `ativo` (TINYINT(1)) preserva o histórico: 1 = Ativo, 0 = Inativo.
-- Novos registros iniciam como Ativo (DEFAULT 1); ao adicionar a coluna, o MySQL
-- preenche automaticamente as linhas existentes com o DEFAULT 1.

-- ========== Funcionários ==========

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'funcionarios' AND COLUMN_NAME = 'ativo') = 0,
    'ALTER TABLE `funcionarios` ADD COLUMN `ativo` TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''1=Ativo, 0=Inativo''',
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `funcionarios` SET `ativo` = 1 WHERE `ativo` IS NULL;

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'funcionarios' AND INDEX_NAME = 'idx_funcionarios_ativo') = 0,
    'ALTER TABLE `funcionarios` ADD INDEX `idx_funcionarios_ativo` (`ativo`)',
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== Fornecedores (estrutura preparada para o módulo de cadastro futuro) ==========

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fornecedores' AND COLUMN_NAME = 'ativo') = 0,
    'ALTER TABLE `fornecedores` ADD COLUMN `ativo` TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''1=Ativo, 0=Inativo''',
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `fornecedores` SET `ativo` = 1 WHERE `ativo` IS NULL;

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fornecedores' AND INDEX_NAME = 'idx_fornecedores_ativo') = 0,
    'ALTER TABLE `fornecedores` ADD INDEX `idx_fornecedores_ativo` (`ativo`)',
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

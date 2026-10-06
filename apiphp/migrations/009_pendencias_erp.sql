-- 009 — Pendências do ERP: registro de problemas e chamados de suporte.
-- Tabela principal para armazenar pendências do ERP, com campos para
-- identificação, classificação, prioridade, status e controle de atendimentos.
-- Idempotente: usa INFORMATION_SCHEMA + PREPARE para MySQL.

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pendencias_erp') = 0,
    'CREATE TABLE `pendencias_erp` (
        `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `codigo` VARCHAR(50) NOT NULL UNIQUE COMMENT "Código formatado (ERP-0001)",
        `titulo` VARCHAR(255) NOT NULL COMMENT "Título resumido do problema",
        `descricao` TEXT COMMENT "Descrição detalhada do problema",
        `modulo` VARCHAR(100) NOT NULL COMMENT "Módulo do ERP afetado",
        `prioridade` ENUM("Baixa","Média","Alta","Crítica") NOT NULL DEFAULT "Média",
        `setor` VARCHAR(100) NULL COMMENT "Setor afetado (se específico)",
        `abrangencia` ENUM("Específico","Todos os setores") NOT NULL DEFAULT "Todos os setores",
        `identificado_por` VARCHAR(200) NOT NULL COMMENT "Usuário que identificou o problema",
        `data_identificacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT "Quando foi identificado",
        `status` ENUM("Pendente","Aguardando Suporte","Em Análise","Aguardando Testes","Testando","Resolvido","Cancelado") NOT NULL DEFAULT "Pendente",
        `usuario_id` INT NULL COMMENT "Usuário logado que abriu/atualizou",
        `observacoes` TEXT COMMENT "Observações gerais",
        `data_cadastro` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `usuario_cadastro` VARCHAR(50) NULL,
        `data_atualizacao` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        `usuario_atualizacao` VARCHAR(50) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Índices para melhor performance nas buscas e filtros
SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pendencias_erp' AND INDEX_NAME = 'idx_pendencias_codigo') = 0,
    'ALTER TABLE `pendencias_erp` ADD INDEX `idx_pendencias_codigo` (`codigo`)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pendencias_erp' AND INDEX_NAME = 'idx_pendencias_status') = 0,
    'ALTER TABLE `pendencias_erp` ADD INDEX `idx_pendencias_status` (`status`)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pendencias_erp' AND INDEX_NAME = 'idx_pendencias_prioridade') = 0,
    'ALTER TABLE `pendencias_erp` ADD INDEX `idx_pendencias_prioridade` (`prioridade`)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pendencias_erp' AND INDEX_NAME = 'idx_pendencias_modulo') = 0,
    'ALTER TABLE `pendencias_erp` ADD INDEX `idx_pendencias_modulo` (`modulo`)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Inserir código de exemplo para teste (opcional, pode ser removido)
INSERT IGNORE INTO `pendencias_erp` (
    `codigo`, `titulo`, `descricao`, `modulo`, `prioridade`, `setor`, `abrangencia`,
    `identificado_por`, `data_identificacao`, `status`, `usuario_id`, `observacoes`
) VALUES (
    'ERP-0001',
    'Exemplo de pendência',
    'Este é um registro de exemplo para testar a funcionalidade de pendências do ERP.',
    'Financeiro',
    'Média',
    'Contabilidade',
    'Específico',
    'Usuário do Sistema',
    NOW(),
    'Pendente',
    1,
    'Registro criado automaticamente durante a migração para teste da funcionalidade.'
);
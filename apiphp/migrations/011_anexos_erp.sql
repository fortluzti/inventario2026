-- 011 — Anexos de Pendências do ERP: gerenciamento de evidências e arquivos.
-- Tabela para armazenar informações sobre anexos associados às pendências do ERP,
-- permitindo selecionar quais arquivos serão enviados ao suporte sem alterar os originais.
-- Idempotente: usa INFORMATION_SCHEMA + PREPARE para MySQL.

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'anexos_erp') = 0,
    'CREATE TABLE `anexos_erp` (
        `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `pendencia_id` INT NOT NULL COMMENT "Referência à pendência_erp.id",
        `nome_arquivo` VARCHAR(255) NOT NULL COMMENT "Nome original do arquivo",
        `tipo_arquivo` VARCHAR(50) NOT NULL COMMENT "Tipo/extensão do arquivo (PDF, PNG, etc.)",
        `caminho` VARCHAR(500) NOT NULL COMMENT "Caminho relativo ou URL do arquivo armazenado",
        `tamanho_bytes` INT NULL COMMENT "Tamanho do arquivo em bytes",
        `hash_sha256` VARCHAR(64) NULL COMMENT "Hash SHA-256 para verificação de integridade",
        `usuario_id` INT NULL COMMENT "Usuário que fez o upload",
        `enviado_ao_suporte` INT NOT NULL DEFAULT 0 COMMENT "Flag: 0=não enviado, 1=já enviado ao suporte",
        `data_cadastro` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `usuario_cadastro` VARCHAR(50) NULL,
        `data_atualizacao` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        `usuario_atualizacao` VARCHAR(50) NULL,
        FOREIGN KEY (`pendencia_id`) REFERENCES `pendencias_erp`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`usuario_id`) REFERENCES `users`(`id_usuario`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Índices para melhor performance nas buscas
SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'anexos_erp' AND INDEX_NAME = 'idx_anexos_pendencia') = 0,
    'ALTER TABLE `anexos_erp` ADD INDEX `idx_anexos_pendencia` (`pendencia_id`)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'anexos_erp' AND INDEX_NAME = 'idx_anexos_enviado') = 0,
    'ALTER TABLE `anexos_erp` ADD INDEX `idx_anexos_enviado` (`enviado_ao_suporte`)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Inserir alguns registros de exemplo para teste (opcional, pode ser removido)
INSERT IGNORE INTO `anexos_erp` (
    `pendencia_id`, `nome_arquivo`, `tipo_arquivo`, `caminho`, `tamanho_bytes`, `hash_sha256`, `usuario_id`, `enviado_ao_suporte`
) VALUES (
    1,
    'print_erro_timeout_faturamento.png',
    'PNG',
    '/uploads/pendencias/erp/2026/10/print_erro_timeout_faturamento.png',
    420000,
    'c9a4f21d8f0b7a3c6d9e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d',
    1,
    0
), (
    1,
    'log_requisicao_vendas.txt',
    'TXT',
    '/uploads/pendencias/erp/2026/10/log_requisicao_vendas.txt',
    18000,
    'b71d80e9f0a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0',
    1,
    0
), (
    1,
    'evidencia_teste_homolog_ok.png',
    'PNG',
    '/uploads/pendencias/erp/2026/10/evidencia_teste_homolog_ok.png',
    310000,
    '7a42ec9d1f2a3b4c5d6e7f8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e',
    1,
    0
);
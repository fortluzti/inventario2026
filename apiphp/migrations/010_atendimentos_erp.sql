-- 010 — Atendimentos de Pendências do ERP: registro de envios ao suporte.
-- Tabela para armazenar cada vez que uma pendência é enviada ao suporte,
-- incluindo método de envio, destinatário, protocolo e anexos selecionados.
-- Idempotente: usa INFORMATION_SCHEMA + PREPARE para MySQL.

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atendimentos_erp') = 0,
    'CREATE TABLE `atendimentos_erp` (
        `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `pendencia_id` INT NOT NULL COMMENT "Referência à pendência_erp.id",
        `usuario_id` INT NULL COMMENT "Usuário que enviou ao suporte",
        `metodo_envio` ENUM("E-mail","WhatsApp","Portal do Suporte","Telefone","Outro") NOT NULL COMMENT "Método utilizado para o envio",
        `destinatario` VARCHAR(200) NULL COMMENT "Nome da pessoa/equipe que recebeu",
        `contato` VARCHAR(100) NULL COMMENT "Telefone, e-mail ou WhatsApp para contato",
        `protocolo` VARCHAR(100) NULL COMMENT "Número de protocolo fornecido pelo suporte",
        `observacoes` TEXT COMMENT "Observações sobre o envio e mensagem enviada",
        `anexos_ids` TEXT NULL COMMENT "Lista de IDs dos anexos enviados (separados por vírgula)",
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
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atendimentos_erp' AND INDEX_NAME = 'idx_atendimentos_pendencia') = 0,
    'ALTER TABLE `atendimentos_erp` ADD INDEX `idx_atendimentos_pendencia` (`pendencia_id`)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atendimentos_erp' AND INDEX_NAME = 'idx_atendimentos_usuario') = 0,
    'ALTER TABLE `atendimentos_erp` ADD INDEX `idx_atendimentos_usuario` (`usuario_id`)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atendimentos_erp' AND INDEX_NAME = 'idx_atendimentos_metodo') = 0,
    'ALTER TABLE `atendimentos_erp` ADD INDEX `idx_atendimentos_metodo` (`metodo_envio`)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Inserir registro de exemplo para teste (opcional, pode ser removido)
INSERT IGNORE INTO `atendimentos_erp` (
    `pendencia_id`, `usuario_id`, `metodo_envio`, `destinatario`, `contato`, `protocolo`, `observacoes`, `anexos_ids`
) VALUES (
    1,
    1,
    'E-mail',
    'Suporte TOTVS',
    'suporte@totvs.com.br',
    'TKT-2026-000123',
    'Envio inicial do problema via e-mail com anexos de screenshots e logs.',
    '1,2,3'
);
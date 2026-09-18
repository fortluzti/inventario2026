-- 002 — Configurações do Sistema (chave/valor) + logotipo
-- Banco: inventario2 (ou copia). Execute com um usuario administrador do MySQL.

CREATE TABLE IF NOT EXISTS configuracoes (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    chave       VARCHAR(100) NOT NULL COMMENT 'Chave de configuracao (ex: empresa_nome, empresa_cnpj)',
    valor       TEXT NULL,
    tipo        VARCHAR(20) NOT NULL DEFAULT 'string' COMMENT 'string|int|bool|text',
    criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_chave (chave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Configuracoes do sistema (chave/valor)';

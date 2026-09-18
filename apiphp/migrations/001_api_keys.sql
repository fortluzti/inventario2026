-- 001 — Seguranca da API v2 (api_keys + audit_log)
-- Banco: inventario2 (ou copia). Execute com um usuario administrador do MySQL.

CREATE TABLE IF NOT EXISTS api_keys (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome        VARCHAR(100) NOT NULL COMMENT 'Identificacao do consumidor (ex.: frontend, app desktop)',
    key_prefix  CHAR(8)      NOT NULL COMMENT 'Primeiros 8 chars da chave (lookup)',
    key_hash    CHAR(64)     NOT NULL COMMENT 'SHA-256 da chave completa',
    scopes      VARCHAR(500) NOT NULL DEFAULT '*' COMMENT 'Modulos autorizados, separados por virgula, ou *',
    rate_limit  INT UNSIGNED NOT NULL DEFAULT 120 COMMENT 'Requisicoes por minuto (0 = usa o padrao do .env)',
    ativo       TINYINT(1)   NOT NULL DEFAULT 1,
    expira_em   DATETIME     NULL,
    criado_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_uso  DATETIME     NULL,
    UNIQUE KEY uq_prefix (key_prefix),
    UNIQUE KEY uq_hash (key_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    api_key_id  INT UNSIGNED NULL,
    endpoint    VARCHAR(100) NOT NULL DEFAULT '',
    record_id   INT UNSIGNED NULL,
    action      VARCHAR(50)  NOT NULL,
    ip          VARCHAR(45)  NOT NULL DEFAULT '',
    user_agent  VARCHAR(255) NOT NULL DEFAULT '',
    context     TEXT NULL,
    criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_key (api_key_id),
    KEY idx_endpoint (endpoint),
    KEY idx_criado (criado_em),
    CONSTRAINT fk_audit_key FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

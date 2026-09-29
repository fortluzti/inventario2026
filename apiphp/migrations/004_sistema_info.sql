-- 004 — Controle de versao do sistema e do schema (sistema_info + schema_migrations)
-- Banco: inventario2 (ou copia). Idempotente: pode ser reaplicada sem efeito colateral.
--
-- Fonte unica de verdade da versao exibida no frontend (antes hardcoded como
-- "Build 2026.1.0-web" em Dashboard.jsx/Login.jsx):
--   sistema_info.app_versao = versao da aplicacao (2026.1.0)
--   sistema_info.app_build  = canal/tipo do build (web)
--   sistema_info.db_versao  = ultima migration aplicada em `schema_migrations`
--
-- `app_versao` e `db_versao` sao conceitos distintos: a versao da aplicacao e
-- definida pelo release do frontend/API; a versao do banco e a migration
-- efetivamente aplicada (registrada pelo runner `scripts/migrate.php`).
-- As migrations historicas (001..003) NAO sao alteradas por este arquivo.

-- ========== Versao instalada (linha unica, id = 1) ==========

CREATE TABLE IF NOT EXISTS sistema_info (
    id            TINYINT UNSIGNED NOT NULL DEFAULT 1,
    app_versao    VARCHAR(20) NOT NULL COMMENT 'Versao da aplicacao (ex.: 2026.1.0)',
    app_build     VARCHAR(20) NOT NULL COMMENT 'Canal/tipo do build (ex.: web)',
    db_versao     VARCHAR(10) NOT NULL COMMENT 'Ultima migration aplicada (ex.: 004)',
    criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT chk_sistema_info_linha_unica CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Versao instalada do sistema (linha unica)';

-- ========== Historico de migrations aplicadas ==========

CREATE TABLE IF NOT EXISTS schema_migrations (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    versao      VARCHAR(10)  NOT NULL COMMENT 'Prefixo numerico do arquivo (ex.: 004)',
    arquivo     VARCHAR(150) NOT NULL COMMENT 'Nome do arquivo em apiphp/migrations',
    checksum    CHAR(64)     NOT NULL COMMENT 'SHA-256 do arquivo no momento da aplicacao',
    aplicada_em DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_schema_migrations_versao (versao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Historico de migrations aplicadas';

-- ========== Versao instalada ==========
-- GREATEST evita "downgrade" caso este script seja reaplicado depois de uma
-- migration mais nova (ex.: 005) ja registrada.

INSERT INTO sistema_info (id, app_versao, app_build, db_versao)
VALUES (1, '2026.1.0', 'web', '004')
ON DUPLICATE KEY UPDATE
    app_versao = VALUES(app_versao),
    app_build  = VALUES(app_build),
    db_versao  = GREATEST(db_versao, VALUES(db_versao));

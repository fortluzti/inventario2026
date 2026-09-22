<?php
/**
 * ConfiguracoesHandler — Endpoints dedicados para:
 *   - Dados da empresa (chave/valor em tabela configuracoes)
 *   - Backup do banco de dados
 *   - Verificar estrutura do banco
 *   - Adaptar estrutura do banco
 *   - Licenca do sistema (serial)
 */
declare(strict_types=1);

final class ConfiguracoesHandler
{
    /** Chaves de configuracao da empresa suportadas pelo formulario. */
    private const EMPRESA_KEYS = [
        'empresa_nome', 'empresa_cnpj', 'empresa_telefone', 'empresa_email',
        'empresa_cep', 'empresa_logradouro', 'empresa_numero', 'empresa_complemento',
        'empresa_bairro', 'empresa_cidade', 'empresa_estado', 'empresa_logo',
    ];

    public static function handle(PDO $pdo, string $action, array $input): never
    {
        match ($action) {
            'empresa'         => self::empresa($pdo),
            'salvar_empresa'  => self::salvarEmpresa($pdo, $input),
            'upload_logo'     => self::uploadLogo($pdo, $input),
            'backup'          => self::backup($pdo),
            'download_backup' => self::downloadBackup($pdo, $input),
            'serve_logo'      => self::serveLogo($pdo, $input),
            'verificar'       => self::verificar($pdo),
            'adaptar'         => self::adaptar($pdo),
            'licenca'        => self::licenca($pdo),
            'salvar_serial'  => self::salvarSerial($pdo, $input),
            default          => Response::error('Acao invalida para configuracoes.', 400),
        };
    }

    /* ---------------- Dados da Empresa ---------------- */

    public static function empresa(PDO $pdo): never
    {
        $in    = "'" . implode("','", self::EMPRESA_KEYS) . "'";
        $stmt  = $pdo->prepare("SELECT chave, valor, tipo FROM configuracoes WHERE chave IN ({$in})");
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $config = [];
        foreach (self::EMPRESA_KEYS as $key) {
            $config[$key] = null;
        }
        foreach ($rows as $row) {
            if (array_key_exists($row['chave'], $config)) {
                $config[$row['chave']] = $row['valor'];
            }
        }
        Response::success($config);
    }

    public static function salvarEmpresa(PDO $pdo, array $input): never
    {
        $pdo->beginTransaction();
        try {
            foreach (self::EMPRESA_KEYS as $key) {
                $value = $input[$key] ?? null;
                $value = $value === '' ? null : trim((string)$value);
                $stmt = $pdo->prepare(
                    'INSERT INTO configuracoes (chave, valor, tipo) VALUES (:k, :v, :t)
                     ON DUPLICATE KEY UPDATE valor = VALUES(valor), tipo = VALUES(tipo)'
                );
                $stmt->execute([':k' => $key, ':v' => $value, ':t' => 'string']);
            }
            $pdo->commit();
            Audit::log($pdo, null, 'config_save', 'configuracoes', null, ['tipo' => 'empresa']);
            Response::success(null, 'Configuracoes da empresa salvas com sucesso.');
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public static function uploadLogo(PDO $pdo, array $input): never
    {
        if (!isset($_FILES['arquivo']) || $_FILES['arquivo']['error'] !== UPLOAD_ERR_OK) {
            Response::error('Arquivo de logo nao enviado ou erro no upload.', 400);
        }

        $allowed = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'];
        if (class_exists('finfo', false)) {
            $finfo  = new finfo(FILEINFO_MIME_TYPE);
            $mime   = $finfo->file($_FILES['arquivo']['tmp_name']);
        } else {
            $mime   = $_FILES['arquivo']['type'] ?: 'application/octet-stream';
        }

        if (!in_array($mime, $allowed, true)) {
            Response::error('Formato de imagem invalido. Use: PNG, JPG, GIF, SVG ou WebP.', 400);
        }

        $ext = match ($mime) {
            'image/svg+xml' => 'svg', 'image/png' => 'png',
            'image/jpeg'    => 'jpg', 'image/gif' => 'gif',
            'image/webp'    => 'webp', default => 'img',
        };

        $filename = 'logo_empresa_' . date('YmdHis') . '.' . $ext;
        $dir      = __DIR__ . '/../../storage/uploads';
        if (!is_dir($dir)) { @mkdir($dir, 0770, true); }
        $dest = $dir . '/' . $filename;

        if (!move_uploaded_file($_FILES['arquivo']['tmp_name'], $dest)) {
            Response::error('Falha ao salvar o arquivo de logo.', 500);
        }

        // Salva o caminho na tabela de configuracoes
        $pdo->prepare(
            'INSERT INTO configuracoes (chave, valor, tipo) VALUES (:k, :v, :t)
             ON DUPLICATE KEY UPDATE valor = VALUES(valor)'
        )->execute([':k' => 'empresa_logo', ':v' => $filename, ':t' => 'string']);

        $url = '/storage/uploads/' . $filename;
        Audit::log($pdo, null, 'config_logo_upload', 'configuracoes', null, ['file' => $filename]);
        Response::success(['file' => $filename, 'url' => $url], 'Logo carregado com sucesso.');
    }

    /* ---------------- Backup do Banco de Dados ---------------- */

    public static function backup(PDO $pdo): never
    {
        $host = Config::get('DB_HOST', '127.0.0.1');
        $port = Config::get('DB_PORT', '3306');
        $name = Config::get('DB_NAME', 'inventario2');
        $user = Config::get('DB_USER', 'root');
        $pass = Config::get('DB_PASS', '');
        $dir  = __DIR__ . '/../../storage/backups';
        if (!is_dir($dir)) { @mkdir($dir, 0770, true); }

        $file = $dir . '/backup_' . date('Ymd_His') . '.sql';

        // Tenta mysqldump primeiro
        $cmd = sprintf(
            'mysqldump --host=%s --port=%d --user=%s --password=%s --single-transaction --routines --triggers --databases %s 2>&1',
            escapeshellarg($host), (int)$port, escapeshellarg($user),
            escapeshellarg($pass), escapeshellarg($name)
        );
        $output = [];
        $rc = 0;
        exec($cmd, $output, $rc);

        if ($rc === 0 && file_put_contents($file, implode("\n", $output))) {
            // sucesso
        } else {
            // Fallback: exportar tabelas via PDO
            $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
            $sql = [];
            foreach ($tables as $t) {
                $sql[] = "DROP TABLE IF EXISTS `{$t}`;";
                $def = $pdo->query("SHOW CREATE TABLE `{$t}`")->fetch(PDO::FETCH_ASSOC);
                $sql[] = $def[array_key_first($def)];
                $rows = $pdo->query("SELECT * FROM `{$t}`")->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as $row) {
                    $cols = array_map(fn($c) => "`$c`", array_keys($row));
                    $vals = [];
                    foreach ($row as $v) {
                        $vals[] = $v === null ? 'NULL' : $pdo->quote($v);
                    }
                    $sql[] = "INSERT INTO `{$t}` (" . implode(',', $cols) . ') VALUES (' . implode(',', $vals) . ');';
                }
            }
            file_put_contents($file, implode("\n", $sql));
        }

        $size = filesize($file);
        $sha  = hash_file('sha256', $file);

        Audit::log($pdo, null, 'db_backup', 'configuracoes', null, ['file' => basename($file), 'size' => $size]);

        Response::success([
            'file'      => basename($file),
            'size'      => $size,
            'sha256'    => $sha,
            'created_at' => date('Y-m-d H:i:s'),
        ], 'Backup gerado com sucesso.');
    }

    /** Serve um arquivo de backup para download (com autenticacao por API Key). */
    public static function downloadBackup(PDO $pdo, array $input): never
    {
        $file = basename((string)($input['file'] ?? ''));
        if ($file === '' || !preg_match('/^backup_\d{8}_\d{6}\.sql(\.gz)?$/', $file)) {
            Response::error('Arquivo de backup invalido.', 400);
        }

        $path = __DIR__ . '/../../storage/backups/' . $file;
        if (!is_file($path)) {
            Response::error('Arquivo de backup nao encontrado.', 404);
        }

        $size = filesize($path);
        header('Content-Type: application/sql');
        header('Content-Disposition: attachment; filename="' . $file . '"');
        header('Content-Length: ' . $size);
        header('X-Backup-SHA256: ' . hash_file('sha256', $path));
        readfile($path);
        exit;
    }

    /** Serve uma imagem de logo para preview embutido. */
    public static function serveLogo(PDO $pdo, array $input): never
    {
        $file = basename((string)($input['file'] ?? ''));
        if ($file === '' || !preg_match('/^logo_empresa_\d+.*\.(png|jpe?g|gif|svg|webp)$/i', $file)) {
            Response::error('Arquivo de logo invalido.', 400);
        }
        $path = __DIR__ . '/../../storage/uploads/' . $file;
        if (!is_file($path)) {
            Response::error('Logo nao encontrada.', 404);
        }
        if (class_exists('finfo', false)) {
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mime  = $finfo->file($path);
        } else {
            $mime  = 'image/png';
        }
        header('Content-Type: ' . $mime);
        header('Cache-Control: public, max-age=3600');
        header('Content-Length: ' . filesize($path));
        readfile($path);
        exit;
    }

    /* ---------------- Verificar Estrutura do Banco ---------------- */

    public static function verificar(PDO $pdo): never
    {
        $modules = require __DIR__ . '/../modules.php';
        $results = [];
        $missingTables = [];
        $missingColumns = [];
        $tablesChecked = 0;

        // Verifica tabelas do registry
        foreach ($modules as $modName => $mod) {
            $table = $mod['table'];
            $tablesChecked++;

            $exists = (bool)$pdo->query("SHOW TABLES LIKE '{$table}'")->fetch();
            if (!$exists) {
                $missingTables[] = $table;
                $results[$modName] = ['table' => $table, 'status' => 'missing'];
                continue;
            }

            $missingCols = [];
            foreach (array_keys($mod['fields']) as $col) {
                $hasCol = (bool)$pdo->query("SHOW COLUMNS FROM `{$table}` LIKE '{$col}'")->fetch();
                if (!$hasCol) {
                    $missingCols[] = $col;
                }
            }

            if (!empty($missingCols)) {
                $missingColumns[$table] = $missingCols;
                $results[$modName] = [
                    'table'  => $table,
                    'status' => 'needs_attention',
                    'missing_columns' => $missingCols,
                ];
            } else {
                $results[$modName] = ['table' => $table, 'status' => 'ok'];
            }
        }

        // Verifica tabelas conhecidas adicionais
        foreach (['api_keys', 'audit_log', 'configuracoes'] as $tbl) {
            $tablesChecked++;
            $exists = (bool)$pdo->query("SHOW TABLES LIKE '{$tbl}'")->fetch();
            if (!$exists) {
                $missingTables[] = $tbl;
                $results[$tbl] = ['table' => $tbl, 'status' => 'missing'];
            } else {
                $results[$tbl] = ['table' => $tbl, 'status' => 'ok'];
            }
        }

        $overallStatus = empty($missingTables) && empty($missingColumns)
            ? 'ok'
            : (count($missingTables) > 0 ? 'critical' : 'warning');

        Response::success([
            'status_geral'    => $overallStatus,
            'tabelas_verificadas' => $tablesChecked,
            'tabelas_ok'      => $tablesChecked - count($missingTables) - count(array_filter($results, fn($r) => $r['status'] === 'needs_attention')),
            'tabelas_faltando' => $missingTables,
            'colunas_faltando' => $missingColumns,
            'detalhes'        => $results,
        ]);
    }

    /* ---------------- Adaptar Estrutura do Banco ---------------- */

    public static function adaptar(PDO $pdo): never
    {
        $modules = require __DIR__ . '/../modules.php';
        $log = [];

        // Cria tabelas faltando (esqueleto minimo baseado no registry)
        foreach ($modules as $modName => $mod) {
            $table = $mod['table'];
            $exists = (bool)$pdo->query("SHOW TABLES LIKE '{$table}'")->fetch();
            if ($exists) continue;

            $cols = [];
            $cols[] = 'id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY';
            foreach (array_keys($mod['fields']) as $col) {
                if ($col === 'ativo') {
                    // Status Ativo/Inativo: padrão do projeto (setores).
                    // TINYINT(1) NOT NULL DEFAULT 1 garante que novos e existentes sejam Ativos.
                    $cols[] = "`{$col}` TINYINT(1) NOT NULL DEFAULT 1";
                } else {
                    $cols[] = match ($mod['fields'][$col]['tipo']) {
                        'int'   => "`{$col}` INT",
                        'date'  => "`{$col}` DATE",
                        default => "`{$col}` VARCHAR(" . ($mod['fields'][$col]['max'] ?? 255) . ')',
                    };
                }
            }
            $cols[] = 'data_cadastro DATETIME';
            $cols[] = 'data_atualizacao DATETIME';

            $sql = "CREATE TABLE `{$table}` (" . implode(', ', $cols) . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
            $pdo->exec($sql);
            $log[] = ['table' => $table, 'action' => 'created'];
        }

        // Adiciona colunas faltando
        foreach ($modules as $modName => $mod) {
            $table = $mod['table'];
            if (!self::tableExists($pdo, $table)) continue;

            foreach (array_keys($mod['fields']) as $col) {
                $hasCol = (bool)$pdo->query("SHOW COLUMNS FROM `{$table}` LIKE '{$col}'")->fetch();
                if ($hasCol) continue;

                if ($col === 'ativo') {
                    // Status Ativo/Inativo: padrão do projeto (setores).
                    // NOT NULL DEFAULT 1 garante registros existentes como Ativos.
                    $ddl = "ALTER TABLE `{$table}` ADD COLUMN `{$col}` TINYINT(1) NOT NULL DEFAULT 1";
                    $pdo->exec($ddl);
                    $pdo->exec("UPDATE `{$table}` SET `{$col}` = 1 WHERE `{$col}` IS NULL");
                } else {
                    $ddl = match ($mod['fields'][$col]['tipo']) {
                        'int'   => "ALTER TABLE `{$table}` ADD COLUMN `{$col}` INT",
                        'date'  => "ALTER TABLE `{$table}` ADD COLUMN `{$col}` DATE",
                        default => "ALTER TABLE `{$table}` ADD COLUMN `{$col}` VARCHAR(" . ($mod['fields'][$col]['max'] ?? 255) . ')',
                    };
                    $nullable = !empty($mod['fields'][$col]['req']);
                    $ddl .= $nullable ? ' NOT NULL' : ' NULL';
                    $pdo->exec($ddl);
                }
                $log[] = ['table' => $table, 'column' => $col, 'action' => 'added'];
            }
        }

        // Garante tabelas de infraestrutura
        foreach (['api_keys', 'audit_log'] as $tbl) {
            if (!self::tableExists($pdo, $tbl)) {
                $log[] = ['table' => $tbl, 'action' => 'missing_migration'];
            }
        }
        if (!self::tableExists($pdo, 'configuracoes')) {
            $log[] = ['table' => 'configuracoes', 'action' => 'missing_migration'];
        }

        Audit::log($pdo, null, 'db_adapt', 'configuracoes', null, ['changes' => $log]);
        Response::success([
            'alteracoes' => $log,
            'total'      => count($log),
        ], 'Adaptacao do banco concluida.');
    }

    /* ---------------- Licenca do Sistema ---------------- */

    public static function licenca(PDO $pdo): never
    {
        $stmt = $pdo->prepare(
            "SELECT valor FROM configuracoes WHERE chave = 'licenca_serial' LIMIT 1"
        );
        $stmt->execute();
        $serial = $stmt->fetchColumn() ?: '';

        Response::success([
            'serial'  => $serial,
            'status'  => 'nao_validada',
            'mensagem' => 'Nenhuma validacao de licenca disponivel nesta versao.',
        ]);
    }

    public static function salvarSerial(PDO $pdo, array $input): never
    {
        $serial = trim((string)($input['serial'] ?? ''));
        if ($serial === '') {
            Response::error('Serial e obrigatorio.', 422);
        }
        if (strlen($serial) > 200) {
            Response::error('Serial muito longo (max 200 caracteres).', 422);
        }

        $pdo->prepare(
            'INSERT INTO configuracoes (chave, valor, tipo) VALUES (:k, :v, :t)
             ON DUPLICATE KEY UPDATE valor = VALUES(valor)'
        )->execute([':k' => 'licenca_serial', ':v' => $serial, ':t' => 'string']);

        Audit::log($pdo, null, 'licenca_save', 'configuracoes', null, ['has_serial' => true]);
        Response::success(null, 'Serial salvo com sucesso.');
    }

    /* ---------------- Helpers ---------------- */

    private static function tableExists(PDO $pdo, string $table): bool
    {
        return (bool)$pdo->query("SHOW TABLES LIKE '{$table}'")->fetch();
    }
}

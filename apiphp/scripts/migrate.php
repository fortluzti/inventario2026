<?php
/**
 * Runner de migrations — aplica os arquivos de apiphp/migrations em ordem e
 * registra cada versao aplicada na tabela `schema_migrations`.
 *
 * Uso (a partir da pasta apiphp):
 *   php scripts/migrate.php            # aplica as migrations pendentes
 *   php scripts/migrate.php status     # lista aplicadas/pendentes (somente leitura)
 *   php scripts/migrate.php baseline   # registra as pendentes como aplicadas SEM executar
 *
 * Regras:
 *  - migrations historicas nunca sao reescritas nem removidas (arquivos imutaveis);
 *  - versao ja registrada nao e reexecutada; checksum divergente apenas alerta;
 *  - `sistema_info.db_versao` e sincronizado com a ultima versao aplicada;
 *  - DDL no MySQL faz commit implicito: nao existe transacao por arquivo.
 */
declare(strict_types=1);

require_once __DIR__ . '/../src/bootstrap.php';

final class MigrationRunner
{
    private const TABLE = 'schema_migrations';

    private PDO $pdo;
    private string $dir;

    public function __construct(PDO $pdo, string $dir)
    {
        $this->pdo = $pdo;
        $this->dir = rtrim($dir, '/\\');
    }

    /** Cria a tabela de controle se ainda nao existir (idempotente). */
    public function ensureTable(): void
    {
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS ' . self::TABLE . ' (
                id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                versao      VARCHAR(10)  NOT NULL COMMENT \'Prefixo numerico do arquivo (ex.: 004)\',
                arquivo     VARCHAR(150) NOT NULL COMMENT \'Nome do arquivo em apiphp/migrations\',
                checksum    CHAR(64)     NOT NULL COMMENT \'SHA-256 do arquivo no momento da aplicacao\',
                aplicada_em DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_schema_migrations_versao (versao)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=\'Historico de migrations aplicadas\''
        );
    }

    /** Arquivos de migration validados e ordenados pela versao. */
    public function files(): array
    {
        $files = glob($this->dir . DIRECTORY_SEPARATOR . '*.sql') ?: [];
        $out = [];
        foreach ($files as $path) {
            $nome = basename($path);
            if (!preg_match('/^(\d{3})_([A-Za-z0-9_\-]+)\.sql$/', $nome, $m)) {
                fwrite(STDERR, "AVISO: ignorando arquivo fora do padrao NNN_nome.sql: {$nome}" . PHP_EOL);
                continue;
            }
            $out[] = ['versao' => $m[1], 'arquivo' => $nome, 'path' => $path];
        }
        usort($out, static fn(array $a, array $b): int => strcmp($a['versao'], $b['versao']));
        return $out;
    }

    /** Versoes registradas em schema_migrations, indexadas pela versao. */
    public function applied(): array
    {
        $rows = $this->pdo->query(
            'SELECT versao, arquivo, checksum, aplicada_em FROM ' . self::TABLE . ' ORDER BY versao'
        )->fetchAll();
        $out = [];
        foreach ($rows as $row) {
            $out[(string)$row['versao']] = $row;
        }
        return $out;
    }

    /**
     * Estado atual: aplicada | pendente | alterada (arquivo mudou apos aplicacao).
     * Somente leitura — nenhuma gravacao no banco.
     */
    public function plan(): array
    {
        $applied = $this->applied();
        $plan = [];
        foreach ($this->files() as $file) {
            $checksum = (string)hash_file('sha256', $file['path']);
            $estado = 'pendente';
            if (isset($applied[$file['versao']])) {
                $estado = hash_equals((string)$applied[$file['versao']]['checksum'], $checksum)
                    ? 'aplicada'
                    : 'alterada';
            }
            $plan[] = $file + ['checksum' => $checksum, 'estado' => $estado];
        }
        return $plan;
    }

    /**
     * Executa as migrations pendentes (ou apenas as registra, no modo baseline).
     *
     * @return list<string> log legivel para o operador
     */
    public function run(bool $baseline = false): array
    {
        $log = [];
        foreach ($this->plan() as $item) {
            if ($item['estado'] === 'aplicada') {
                $log[] = "OK       {$item['versao']}  {$item['arquivo']} (ja aplicada)";
                continue;
            }
            if ($item['estado'] === 'alterada') {
                $log[] = "AVISO    {$item['versao']}  {$item['arquivo']} — arquivo difere do aplicado; versao mantida";
                continue;
            }
            if ($baseline) {
                $this->register($item);
                $log[] = "BASELINE {$item['versao']}  {$item['arquivo']} (registrada sem executar)";
                continue;
            }
            $total = $this->executeFile($item['path'], $item['arquivo']);
            $this->register($item);
            $log[] = "APLICADA {$item['versao']}  {$item['arquivo']} ({$total} statement(s))";
        }
        return $log;
    }

    /** Registra a versao aplicada (idempotente pela UNIQUE KEY de `versao`). */
    private function register(array $item): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO ' . self::TABLE . ' (versao, arquivo, checksum) VALUES (:v, :a, :c)
             ON DUPLICATE KEY UPDATE arquivo = VALUES(arquivo), checksum = VALUES(checksum)'
        );
        $stmt->execute([':v' => $item['versao'], ':a' => $item['arquivo'], ':c' => $item['checksum']]);
    }

    /** Executa um arquivo .sql statement por statement. */
    private function executeFile(string $path, string $arquivo): int
    {
        $sql = (string)file_get_contents($path);
        $total = 0;
        foreach (self::splitStatements($sql) as $index => $statement) {
            try {
                $this->executeStatement($statement);
            } catch (Throwable $e) {
                throw new RuntimeException(
                    "Falha em {$arquivo} (statement " . ($index + 1) . '): ' . $e->getMessage()
                );
            }
            $total++;
        }
        return $total;
    }

    private function executeStatement(string $statement): void
    {
        // Sempre consome o result set: migrations condicionais promovem o
        // `EXECUTE stmt` a SELECT e, sem fetch/closeCursor, a proxima query
        // falha com MySQL 2014 ("other unbuffered queries are active").
        $stmt = $this->pdo->query($statement);
        if ($stmt instanceof PDOStatement) {
            $stmt->fetchAll();
            $stmt->closeCursor();
        }
    }

    /**
     * Separa o arquivo em statements ignorando `;` dentro de aspas/comentarios.
     * Os SQL do projeto nao usam DELIMITER/procedures — apenas IF()/PREPARE.
     */
    private static function splitStatements(string $sql): array
    {
        $statements = [];
        $buffer = '';
        $len = strlen($sql);
        $i = 0;

        while ($i < $len) {
            $ch = $sql[$i];
            $next = $i + 1 < $len ? $sql[$i + 1] : '';

            if (($ch === '-' && $next === '-') || $ch === '#') {            // comentario de linha
                while ($i < $len && $sql[$i] !== "\n") {
                    $i++;
                }
                continue;
            }
            if ($ch === '/' && $next === '*') {                             // comentario de bloco
                $i += 2;
                while ($i < $len && !($sql[$i] === '*' && ($sql[$i + 1] ?? '') === '/')) {
                    $i++;
                }
                $i += 2;
                continue;
            }
            if ($ch === "'" || $ch === '"' || $ch === '`') {                // literal entre aspas
                $quote = $ch;
                $buffer .= $ch;
                $i++;
                while ($i < $len) {
                    $c = $sql[$i];
                    $buffer .= $c;
                    if ($c === '\\' && $quote !== '`' && $i + 1 < $len) {
                        $buffer .= $sql[$i + 1];
                        $i += 2;
                        continue;
                    }
                    if ($c === $quote) {
                        if (($sql[$i + 1] ?? '') === $quote) {              // aspa escapada ''
                            $buffer .= $quote;
                            $i += 2;
                            continue;
                        }
                        $i++;
                        break;
                    }
                    $i++;
                }
                continue;
            }
            if ($ch === ';') {                                              // fim do statement
                $statements[] = $buffer;
                $buffer = '';
                $i++;
                continue;
            }
            $buffer .= $ch;
            $i++;
        }

        if (trim($buffer) !== '') {
            $statements[] = $buffer;
        }

        $out = [];
        foreach ($statements as $statement) {
            $statement = trim($statement);
            if ($statement !== '') {
                $out[] = $statement;
            }
        }
        return $out;
    }

    /** Alinha `sistema_info.db_versao` com a ultima versao registrada. */
    public function syncSistemaInfo(): ?string
    {
        if (!$this->tableExists('sistema_info')) {
            return null;
        }
        $ultima = $this->pdo->query('SELECT MAX(versao) FROM ' . self::TABLE)->fetchColumn();
        if (!$ultima) {
            return null;
        }
        $stmt = $this->pdo->prepare('UPDATE sistema_info SET db_versao = :v WHERE id = 1');
        $stmt->execute([':v' => (string)$ultima]);
        return (string)$ultima;
    }

    /** Checagem de existencia de tabela no banco atual. */
    public function tableExists(string $table): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t'
        );
        $stmt->execute([':t' => $table]);
        return (int)$stmt->fetchColumn() > 0;
    }

    /** A tabela de controle `schema_migrations` ja existe neste banco? */
    public function controleExiste(): bool
    {
        return $this->tableExists(self::TABLE);
    }
}

/* ---------------- CLI ---------------- */

$modo = strtolower((string)($argv[1] ?? 'apply'));
if (!in_array($modo, ['apply', 'status', 'baseline'], true)) {
    fwrite(STDERR, 'Uso: php scripts/migrate.php [apply|status|baseline]' . PHP_EOL);
    exit(2);
}

try {
    $pdo = Database::pdo();
    $migrationsDir = __DIR__ . '/../migrations';
    $runner = new MigrationRunner($pdo, $migrationsDir);

    echo 'Banco : ' . (string)$pdo->query('SELECT DATABASE()')->fetchColumn() . PHP_EOL;
    echo 'Pasta : ' . realpath($migrationsDir) . PHP_EOL . PHP_EOL;

    // status = somente leitura: nao cria tabela, nao executa e nao registra nada.
    if ($modo === 'status' && !$runner->controleExiste()) {
        foreach ($runner->files() as $file) {
            echo 'PENDENTE  ' . $file['versao'] . '  ' . $file['arquivo'] . PHP_EOL;
        }
        echo PHP_EOL . 'schema_migrations: ausente — rode "php scripts/migrate.php" para aplicar as migrations.' . PHP_EOL;
        exit(0);
    }

    $runner->ensureTable();

    if ($modo === 'status') {
        foreach ($runner->plan() as $item) {
            echo str_pad(strtoupper($item['estado']), 9) . ' ' . $item['versao'] . '  ' . $item['arquivo'] . PHP_EOL;
        }
        if ($runner->tableExists('sistema_info')) {
            $row = $pdo->query('SELECT app_versao, app_build, db_versao, atualizado_em FROM sistema_info WHERE id = 1')->fetch();
            echo PHP_EOL . 'sistema_info: '
                . ($row ? json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '(sem linha)')
                . PHP_EOL;
        } else {
            echo PHP_EOL . 'sistema_info: ausente — rode "php scripts/migrate.php" para aplicar a 004.' . PHP_EOL;
        }
        exit(0);
    }

    foreach ($runner->run($modo === 'baseline') as $linha) {
        echo $linha . PHP_EOL;
    }

    $versao = $runner->syncSistemaInfo();
    echo PHP_EOL . 'sistema_info.db_versao: ' . ($versao ?? '(indisponivel)') . PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'FALHA: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

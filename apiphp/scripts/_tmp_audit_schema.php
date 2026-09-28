<?php
/**
 * TEMPORARIO — auditoria de schema/dados para a tarefa de conferencia de celulares.
 * Nao faz parte do sistema; remover antes do commit.
 */
declare(strict_types=1);
require_once __DIR__ . '/../src/bootstrap.php';

$pdo = Database::pdo();

function dump(string $title, array $rows, int $limit = 80): void
{
    echo "\n===== {$title} =====\n";
    if (!$rows) { echo "(vazio)\n"; return; }
    $cols = array_keys($rows[0]);
    echo implode(' | ', $cols) . "\n";
    echo str_repeat('-', 100) . "\n";
    foreach (array_slice($rows, 0, $limit) as $r) {
        echo implode(' | ', array_map(fn($v) => $v === null ? 'NULL' : (string)$v, $r)) . "\n";
    }
    echo 'total: ' . count($rows) . "\n";
}

function cols(PDO $pdo, string $table): array
{
    $rows = $pdo->query("SHOW COLUMNS FROM `{$table}`")->fetchAll(PDO::FETCH_ASSOC);
    return array_map(fn($r) => "{$r['Field']} {$r['Type']} " . ($r['Null'] === 'YES' ? 'NULL' : 'NOT NULL') . " {$r['Key']} {$r['Default']} {$r['Extra']}", $rows);
}

foreach (['funcionarios', 'celulares', 'celulares_funcionarios', 'historico_uso', 'danos', 'users'] as $t) {
    try {
        dump("SCHEMA {$t}", $pdo->query("SHOW COLUMNS FROM `{$t}`")->fetchAll(PDO::FETCH_ASSOC));
    } catch (Throwable $e) {
        echo "\n!! {$t}: " . $e->getMessage() . "\n";
    }
}

dump("funcionarios (todos)", $pdo->query("SELECT * FROM funcionarios ORDER BY id")->fetchAll(PDO::FETCH_ASSOC), 200);
dump("celulares (todos)", $pdo->query("SELECT id, codigo_interno_celular, marca, modelo, imei, serial, numero, email_corporativo, gmail, status FROM celulares ORDER BY id")->fetchAll(PDO::FETCH_ASSOC), 200);
dump("celulares_funcionarios (todos)", $pdo->query("SELECT * FROM celulares_funcionarios ORDER BY id")->fetchAll(PDO::FETCH_ASSOC), 300);
dump("historico_uso (todos)", $pdo->query("SELECT * FROM historico_uso ORDER BY id")->fetchAll(PDO::FETCH_ASSOC), 100);
dump("users", $pdo->query("SELECT id, login, nome FROM users ORDER BY id")->fetchAll(PDO::FETCH_ASSOC), 50);

echo "\n=== window function support ===\n";
try {
    dump('mysql version', $pdo->query('SELECT VERSION() AS v')->fetchAll(PDO::FETCH_ASSOC));
} catch (Throwable $e) { echo $e->getMessage(); }

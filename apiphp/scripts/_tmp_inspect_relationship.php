<?php
require_once __DIR__ . '/../src/bootstrap.php';
$pdo = Database::pdo();

echo "=== USERS TABLE SCHEMA ===" . PHP_EOL;
$stmt = $pdo->query("SHOW CREATE TABLE users");
$create = $stmt->fetch(PDO::FETCH_COLUMN);
echo $create . PHP_EOL;

echo PHP_EOL . "=== FUNCIONARIOS TABLE SCHEMA ===" . PHP_EOL;
$stmt = $pdo->query("SHOW CREATE TABLE funcionarios");
$create = $stmt->fetch(PDO::FETCH_COLUMN);
echo $create . PHP_EOL;

echo PHP_EOL . "=== ALL USERS ===" . PHP_EOL;
$stmt = $pdo->query("SELECT id_usuario, nome, login, email, data_cadastro FROM users ORDER BY id_usuario");
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $u) {
    echo json_encode($u) . PHP_EOL;
}

echo PHP_EOL . "=== ALL FUNCIONARIOS (sample 20) ===" . PHP_EOL;
$stmt = $pdo->query("SELECT id, nome, rg, cargo, setor, email, ativo FROM funcionarios ORDER BY id LIMIT 20");
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $f) {
    echo json_encode($f) . PHP_EOL;
}

echo PHP_EOL . "=== CHECK FOR DIRECT RELATIONSHIPS ===" . PHP_EOL;
echo "1. Check if users has funcionario_id FK:" . PHP_EOL;
$stmt = $pdo->query("SHOW COLUMNS FROM users LIKE '%funcionario%'");
$cols = $stmt->fetchAll(PDO::FETCH_COLUMN);
echo "  Columns with 'funcionario': " . (empty($cols) ? "NONE" : json_encode($cols)) . PHP_EOL;

echo "2. Check if funcionarios has user_id FK:" . PHP_EOL;
$stmt = $pdo->query("SHOW COLUMNS FROM funcionarios LIKE '%user%'");
$cols = $stmt->fetchAll(PDO::FETCH_COLUMN);
echo "  Columns with 'user': " . (empty($cols) ? "NONE" : json_encode($cols)) . PHP_EOL;

echo "3. Check foreign key constraints:" . PHP_EOL;
$stmt = $pdo->query("SELECT * FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = 'inventario2' AND REFERENCED_TABLE_NAME IN ('users', 'funcionarios')");
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $fk) {
    echo json_encode($fk) . PHP_EOL;
}
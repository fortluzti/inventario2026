<?php
require_once __DIR__ . '/../src/bootstrap.php';
$pdo = Database::pdo();

echo '=== users table charset/collation ===' . PHP_EOL;
foreach ($pdo->query("SHOW TABLE STATUS WHERE Name='users'")->fetchAll(PDO::FETCH_ASSOC) as $t) {
    echo '  ' . $t['Name'] . ' | charset=' . $t['Collation'] . PHP_EOL;
}
foreach ($pdo->query("SHOW TABLE STATUS WHERE Name='funcionarios'")->fetchAll(PDO::FETCH_ASSOC) as $t) {
    echo '  ' . $t['Name'] . ' | collation=' . $t['Collation'] . PHP_EOL;
}

echo PHP_EOL . '=== Check users.nome collation ===' . PHP_EOL;
foreach ($pdo->query("SHOW FULL COLUMNS FROM users WHERE Field='nome'")->fetchAll(PDO::FETCH_ASSOC) as $c) {
    echo '  ' . $c['Field'] . ' | ' . $c['Type'] . ' | ' . $c['Collation'] . PHP_EOL;
}
foreach ($pdo->query("SHOW FULL COLUMNS FROM funcionarios WHERE Field='nome'")->fetchAll(PDO::FETCH_ASSOC) as $c) {
    echo '  ' . $c['Field'] . ' | ' . $c['Type'] . ' | ' . $c['Collation'] . PHP_EOL;
}

echo PHP_EOL . '=== Check funcionarios.ativo details ===' . PHP_EOL;
$r = $pdo->query("SELECT COUNT(*) as total, SUM(ativo=1) as ativos, SUM(ativo=0) as inativos FROM funcionarios")->fetch(PDO::FETCH_ASSOC);
echo json_encode($r) . PHP_EOL;

<?php
require_once __DIR__ . '/../src/bootstrap.php';
$pdo = Database::pdo();

echo '=== users columns ===' . PHP_EOL;
foreach ($pdo->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_ASSOC) as $c) {
    echo '  ' . $c['Field'] . ' | ' . $c['Type'] . ' | ' . $c['Key'] . ' | default=' . ($c['Default'] ?? 'NULL') . PHP_EOL;
}

echo PHP_EOL . '=== funcionarios columns ===' . PHP_EOL;
foreach ($pdo->query('SHOW COLUMNS FROM funcionarios')->fetchAll(PDO::FETCH_ASSOC) as $c) {
    echo '  ' . $c['Field'] . ' | ' . $c['Type'] . ' | ' . $c['Key'] . ' | default=' . ($c['Default'] ?? 'NULL') . PHP_EOL;
}

echo PHP_EOL . '=== users + funcionarios by email JOIN ===' . PHP_EOL;
$sql = "SELECT u.id_usuario, u.nome AS u_nome, u.login, u.email AS u_email,
    f.id AS f_id, f.nome AS f_nome, f.rg, f.cargo, f.setor, f.email AS f_email, f.ativo
    FROM users u
    LEFT JOIN funcionarios f ON f.email = u.email";
foreach ($pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) as $r) {
    echo json_encode($r) . PHP_EOL;
}

echo PHP_EOL . '=== users + funcionarios by nome JOIN ===' . PHP_EOL;
$sql = "SELECT u.id_usuario, u.nome AS u_nome, u.login, u.email AS u_email,
    f.id AS f_id, f.nome AS f_nome, f.rg, f.cargo, f.setor, f.email AS f_email, f.ativo
    FROM users u
    LEFT JOIN funcionarios f ON TRIM(UPPER(f.nome)) = TRIM(UPPER(u.nome))";
foreach ($pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) as $r) {
    echo json_encode($r) . PHP_EOL;
}

echo PHP_EOL . '=== all tables ===' . PHP_EOL;
foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $t) {
    echo '  ' . $t . PHP_EOL;
}

echo PHP_EOL . '=== funcionarios sample ===' . PHP_EOL;
$sql = "SELECT id, nome, rg, email, cargo, setor, ativo FROM funcionarios ORDER BY id LIMIT 20";
foreach ($pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) as $r) {
    echo json_encode($r) . PHP_EOL;
}

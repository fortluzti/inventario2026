<?php
require_once __DIR__ . '/../src/bootstrap.php';
$pdo = Database::pdo();

echo '=== Test ativar for alex ===' . PHP_EOL;
$id = 'alex';
$stmt = $pdo->prepare('SELECT id_usuario FROM users WHERE login = :ident1 OR email = :ident2 OR id_usuario = :id LIMIT 1');
$stmt->execute([':ident1' => $id, ':ident2' => $id, ':id' => ctype_digit($id) ? (int)$id : 0]);
$idUsuario = $stmt->fetchColumn();
echo "Resolved id_usuario: $idUsuario" . PHP_EOL;

$funcSql = "SELECT id, ativo FROM funcionarios WHERE TRIM(UPPER(nome)) = (SELECT TRIM(UPPER(nome)) FROM users WHERE id_usuario = :id) ORDER BY id ASC LIMIT 1";
$stmt = $pdo->prepare($funcSql);
$stmt->execute([':id' => $idUsuario]);
$func = $stmt->fetch();
echo "Current funcionario: " . json_encode($func) . PHP_EOL;

$novoAtivo = 1 - (int)$func['ativo'];
$upd = $pdo->prepare('UPDATE funcionarios SET ativo = :ativo, data_atualizacao = NOW() WHERE id = :id');
$upd->execute([':ativo' => $novoAtivo, ':id' => (int)$func['id']]);
echo "Toggled to: $novoAtivo" . PHP_EOL;

// Toggle back
$novoAtivo2 = 1 - $novoAtivo;
$upd->execute([':ativo' => $novoAtivo2, ':id' => (int)$func['id']]);
echo "Toggled back to: $novoAtivo2" . PHP_EOL;

echo PHP_EOL . '=== Test novo (create) ===' . PHP_EOL;
$nome = 'Teste usuario Novo';
$login = 'teste_novo_' . time();
$senha = '123456';
$email = 'teste.novo@test.com';
$usr = 'api';

// Check duplicate
$stmt = $pdo->prepare('SELECT id_usuario FROM users WHERE login = :login LIMIT 1');
$stmt->execute([':login' => $login]);
if ($stmt->fetch()) {
    echo "Login already exists" . PHP_EOL;
}

$hash = password_hash($senha, PASSWORD_DEFAULT);
$sql = "INSERT INTO users (nome, login, email, senha, data_cadastro, usuario_cadastro, data_atualizacao, usuario_atualizacao)
        VALUES (:nome, :login, :email, :senha, NOW(), :usr, NOW(), :usr)";
$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':nome'  => $nome,
    ':login' => $login,
    ':email' => $email,
    ':senha' => $hash,
    ':usr'   => $usr,
]);
$idUsuario = (int)$pdo->lastInsertId();
echo "Created user id_usuario: $idUsuario" . PHP_EOL;

$paramsFunc = [
    ':nome'    => $nome,
    ':email'   => $email,
    ':cargo'   => 'TESTE',
    ':setor'   => 'TI',
    ':rg'      => '123.456.789-0',
    ':ativo'   => 1,
    ':usr'     => $usr,
];
$sqlFunc = "INSERT INTO funcionarios (nome, email, cargo, setor, rg, ativo,
                  data_cadastro, usuario_cadastro, data_atualizacao, usuario_atualizacao)
            VALUES (:nome, :email, :cargo, :setor, :rg, :ativo, NOW(), :usr, NOW(), :usr)";
$stmtFunc = $pdo->prepare($sqlFunc);
$stmtFunc->execute($paramsFunc);
echo "Created funcionario id: " . $pdo->lastInsertId() . PHP_EOL;

// Cleanup
$pdo->exec("DELETE FROM funcionarios WHERE nome = 'Teste usuario Novo'");
$pdo->exec("DELETE FROM users WHERE login = '$login'");
echo "Cleaned up test data" . PHP_EOL;

echo PHP_EOL . '=== Verify all users listar ===' . PHP_EOL;
$stmt = $pdo->query("SELECT u.id_usuario AS id, u.nome, u.login, u.email,
                       f.cargo, f.setor, f.rg, f.ativo AS ativo_func
                FROM users u
                LEFT JOIN funcionarios f ON TRIM(UPPER(f.nome)) = TRIM(UPPER(u.nome))
                ORDER BY u.nome ASC");
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
    echo json_encode($r) . PHP_EOL;
}

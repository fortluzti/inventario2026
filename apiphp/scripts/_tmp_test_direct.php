<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');

$pdo = new PDO('mysql:host=127.0.0.1;dbname=inventario2;charset=utf8mb4', 'root', '');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

echo '=== Test nome join ===' . PHP_EOL;
$sql = "SELECT u.id_usuario AS id, u.nome, u.login, u.email,
               f.cargo, f.setor, f.rg, f.ativo AS ativo_func, f.id AS func_id
        FROM users u
        LEFT JOIN funcionarios f ON TRIM(UPPER(f.nome)) = TRIM(UPPER(u.nome))
        WHERE u.login = :login
        LIMIT 1";
$stmt = $pdo->prepare($sql);
$stmt->execute([':login' => 'alex']);
$row = $stmt->fetch(PDO::FETCH_ASSOC);
echo json_encode($row, JSON_PRETTY_PRINT) . PHP_EOL;

echo PHP_EOL . '=== Test ativar for alex ===' . PHP_EOL;
$funcSql = "SELECT id, ativo FROM funcionarios
             WHERE TRIM(UPPER(nome)) = (SELECT TRIM(UPPER(nome)) FROM users WHERE id_usuario = :id)
             ORDER BY id ASC LIMIT 1";
$stmt = $pdo->prepare($funcSql);
$stmt->execute([':id' => 4]);
$func = $stmt->fetch(PDO::FETCH_ASSOC);
echo "Func: " . json_encode($func) . PHP_EOL;

$novoAtivo = 1 - (int)$func['ativo'];
echo "Toggle to: $novoAtivo" . PHP_EOL;
$upd = $pdo->prepare('UPDATE funcionarios SET ativo = :ativo, data_atualizacao = NOW() WHERE id = :id');
$upd->execute([':ativo' => $novoAtivo, ':id' => (int)$func['id']]);
echo "DONE" . PHP_EOL;

// Toggle back
$novoAtivo2 = 1 - $novoAtivo;
$upd->execute([':ativo' => $novoAtivo2, ':id' => (int)$func['id']]);
echo "Toggled back to: $novoAtivo2" . PHP_EOL;

echo PHP_EOL . '=== Test novo ===' . PHP_EOL;
$login = 'teste_novo_' . time();
$nome = 'Usuario Teste Novo';
$senha = '123456';
$email = 'teste.novo@test.com';
$usr = 'api';
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
echo "Created user id: " . $pdo->lastInsertId() . PHP_EOL;

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
$pdo->exec("DELETE FROM funcionarios WHERE nome = 'Usuario Teste Novo'");
$pdo->exec("DELETE FROM users WHERE login = '$login'");
echo "Cleaned up" . PHP_EOL;

echo PHP_EOL . '=== Test listar all ===' . PHP_EOL;
$sql = "SELECT u.id_usuario AS id, u.nome, u.login, u.email,
               f.cargo, f.setor, f.rg, f.ativo AS ativo_func
        FROM users u
        LEFT JOIN funcionarios f ON TRIM(UPPER(f.nome)) = TRIM(UPPER(u.nome))
        ORDER BY u.nome ASC";
$stmt = $pdo->query($sql);
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
    echo json_encode($r) . PHP_EOL;
}

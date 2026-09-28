<?php
require_once __DIR__ . '/../src/bootstrap.php';
$pdo = Database::pdo();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$nome = 'Usuario Teste Novo';
$login = 'usr_test_' . date('His');
$senha = '123456';
$email = 'teste.novo@test.com';
$usr = 'api';

$pdo->beginTransaction();
try {
    $hash = password_hash($senha, PASSWORD_DEFAULT);
    $sql = "INSERT INTO users (nome, login, email, senha, data_cadastro, usuario_cadastro, data_atualizacao, usuario_atualizacao)
            VALUES (:nome, :login, :email, :senha, NOW(), :usr_cad, NOW(), :usr_atu)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':nome'   => $nome,
        ':login'  => $login,
        ':email'  => $email,
        ':senha'  => $hash,
        ':usr_cad' => $usr,
        ':usr_atu' => $usr,
    ]);
    echo "Created user id: " . $pdo->lastInsertId() . PHP_EOL;

    $paramsFunc = [
        ':nome'    => $nome,
        ':email'   => $email,
        ':cargo'   => 'TESTE',
        ':setor'   => 'TI',
        ':rg'      => '123.456.789-0',
        ':ativo'   => 1,
        ':usr1'    => $usr,
        ':usr2'    => $usr,
    ];
    $sqlFunc = "INSERT INTO funcionarios (nome, email, cargo, setor, rg, ativo,
                  data_cadastro, usuario_cadastro, data_atualizacao, usuario_atualizacao)
              VALUES (:nome, :email, :cargo, :setor, :rg, :ativo, NOW(), :usr1, NOW(), :usr2)";
    $stmtFunc = $pdo->prepare($sqlFunc);
    $stmtFunc->execute($paramsFunc);
    echo "Created funcionario id: " . $pdo->lastInsertId() . PHP_EOL;

    $pdo->commit();
    echo "SUCCESS!" . PHP_EOL;
} catch (Throwable $e) {
    $pdo->rollBack();
    echo "ERROR: " . $e->getMessage() . PHP_EOL;
    echo "Line: " . $e->getLine() . " in " . $e->getFile() . PHP_EOL;
}

// Cleanup
$pdo->exec("DELETE FROM funcionarios WHERE nome = 'Usuario Teste Novo'");
$pdo->exec("DELETE FROM users WHERE login = '$login'");
echo "Cleaned up" . PHP_EOL;

<?php
require_once __DIR__ . '/../src/bootstrap.php';
$pdo = Database::pdo();
$pdo->query("DELETE FROM funcionarios WHERE nome = 'Usuario Teste Novo'");
$pdo->query("DELETE FROM users WHERE login LIKE 'usr_test_%'");
echo "Cleaned up old test data" . PHP_EOL;

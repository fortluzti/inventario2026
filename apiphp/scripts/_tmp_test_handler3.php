<?php
require_once __DIR__ . '/../src/bootstrap.php';
require_once __DIR__ . '/../src/handlers/usuarios_handler.php';
$pdo = Database::pdo();

echo '=== Test listar via handler ===' . PHP_EOL;
try { UsuariosHandler::listar($pdo, []); } catch (Throwable $e) { echo "ERR: " . $e->getMessage() . PHP_EOL; }

echo PHP_EOL . '=== Test buscar alex via handler ===' . PHP_EOL;
try { UsuariosHandler::buscar($pdo, ['id' => 'alex']); } catch (Throwable $e) { echo "ERR: " . $e->getMessage() . PHP_EOL; }

echo PHP_EOL . '=== Test ativar alex via handler ===' . PHP_EOL;
try { UsuariosHandler::ativar($pdo, ['id' => 'alex', 'ativo' => 1]); } catch (Throwable $e) { echo "ERR: " . $e->getMessage() . PHP_EOL; }

echo PHP_EOL . '=== Test nov via handler ===' . PHP_EOL;
$login = 'usr_test_' . date('His');
try { UsuariosHandler::novo($pdo, ['nome' => 'Teste Usuario', 'login' => $login, 'senha' => '123456', 'email' => 'teste@test.com', 'cargo' => 'TESTE', 'setor' => 'TI', 'rg' => '123.456.789-0']); } catch (Throwable $e) { echo "ERR: " . $e->getMessage() . PHP_EOL; }

echo PHP_EOL . '=== Cleanup ===' . PHP_EOL;
$pdo->query("DELETE FROM funcionarios WHERE nome = 'Teste Usuario'");
$pdo->query("DELETE FROM users WHERE login = '$login'");
echo "Cleaned up" . PHP_EOL;

echo PHP_EOL . '=== Verify listar after cleanup ===' . PHP_EOL;
try { UsuariosHandler::listar($pdo, []); } catch (Throwable $e) { echo "ERR: " . $e->getMessage() . PHP_EOL; }

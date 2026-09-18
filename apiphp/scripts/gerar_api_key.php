<?php
/**
 * gerar_api_key.php — CLI para criar/revogar chaves de API.
 *
 * Uso:
 *   php scripts/gerar_api_key.php criar "Frontend Web" "*"
 *   php scripts/gerar_api_key.php criar "App Desktop" "impressoras,monitores,estacoes"
 *   php scripts/gerar_api_key.php revogar 3
 *
 * A chave em texto puro e exibida UMA VEZ — guarde em local seguro.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { exit("Somente CLI.\n"); }

require __DIR__ . '/../src/bootstrap.php';

$cmd  = $argv[1] ?? '';
$pdo  = Database::pdo();

if ($cmd === 'criar') {
    $nome   = $argv[2] ?? '';
    $scopes = $argv[3] ?? '*';
    if ($nome === '') { exit("Uso: php gerar_api_key.php criar <nome> <scopes|*>\n"); }

    $raw    = 'flz_' . bin2hex(random_bytes(24));
    $prefix = substr($raw, 0, 8);
    $hash   = hash('sha256', $raw);

    $stmt = $pdo->prepare(
        'INSERT INTO api_keys (nome, key_prefix, key_hash, scopes) VALUES (:n, :p, :h, :s)'
    );
    $stmt->execute([':n' => $nome, ':p' => $prefix, ':h' => $hash, ':s' => $scopes]);

    echo "API Key criada (id={$pdo->lastInsertId()}, nome={$nome}, scopes={$scopes})\n";
    echo "CHAVE (exibir apenas uma vez): {$raw}\n";
    exit;
}

if ($cmd === 'revogar') {
    $id = (int)($argv[2] ?? 0);
    $pdo->prepare('UPDATE api_keys SET ativo = 0 WHERE id = :id')->execute([':id' => $id]);
    echo "Chave #{$id} revogada.\n";
    exit;
}

exit("Comandos: criar <nome> <scopes> | revogar <id>\n");

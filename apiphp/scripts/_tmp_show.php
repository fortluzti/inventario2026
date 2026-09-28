<?php
declare(strict_types=1);
/* TEMPORARIO — visualiza o JSON da conferência para inspeção manual. Remover antes do commit. */
$params = json_decode((string)base64_decode((string)($argv[1] ?? ''), true), true) ?: ['todos' => 1];
$cmd = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/validar_conferencia_celulares.php')
    . ' --dump-json ' . escapeshellarg(base64_encode((string)json_encode($params)));
$raw = (string)shell_exec($cmd);
$d = json_decode(ltrim($raw, "\xEF\xBB\xBF"), true)['data'];

echo "=== RESUMO ===\n";
echo json_encode($d['resumo'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";

echo "\n=== REGISTROS COM INCONSISTENCIA ===\n";
$n = 0;
foreach ($d['items'] as $i) {
    if (!$i['situacoes']) { continue; }
    $n++;
    printf(
        "%d) %s | num=%s | gmail=%s | email=%s | func=%s (%s) | assoc=%s | status=%s | ini=%s | fim=%s\n    -> %s\n",
        $n, $i['codigo'], $i['numero'] ?: '-', $i['gmail'] ?: '-', $i['email_corporativo'] ?: '-',
        $i['funcionario'] ?? '-', $i['funcionario_status'] ?? '-', $i['associacao'] ?? '-', $i['celular_status'],
        $i['data_inicio'] ?? '-', $i['data_fim'] ?? '-',
        implode(' ; ', array_column($i['situacoes'], 'codigo'))
    );
}
echo "total com inconsistencia: {$n}\n";

echo "\n=== CELULARES SEM NENHUMA ASSOCIACAO ===\n";
foreach ($d['items'] as $i) {
    if ($i['associacao'] !== null) { continue; }
    printf("%s | num=%s | gmail=%s | status=%s | obs=%s\n", $i['codigo'], $i['numero'] ?: '-', $i['gmail'] ?: '-', $i['celular_status'], implode(',', array_column($i['observacoes'], 'codigo')));
}

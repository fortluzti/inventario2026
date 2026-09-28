<?php
require_once __DIR__ . '/../src/bootstrap.php';
require_once __DIR__ . '/../src/handlers/usuarios_handler.php';
$pdo = Database::pdo();

try {
    $input = [];
    $search = trim((string)($input['search'] ?? ''));
    $where = [];
    $params = [];

    if ($search !== '') {
        $where[] = '(u.nome LIKE :s OR u.login LIKE :s OR u.email LIKE :s OR f.nome LIKE :s OR f.rg LIKE :s OR f.cargo LIKE :s OR f.setor LIKE :s)';
        $params[':s'] = '%' . $search . '%';
    }

    $page  = max(1, (int)($input['page'] ?? 1));
    $limit = min(200, max(1, (int)($input['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;

    $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';

    $sql = "SELECT u.id_usuario AS id, u.nome, u.login, u.email,
                   f.cargo, f.setor, f.rg, f.ativo AS ativo_func, f.id AS func_id
            FROM users u
            LEFT JOIN funcionarios f ON TRIM(UPPER(f.nome)) = TRIM(UPPER(u.nome)){$whereSql}
            ORDER BY u.nome ASC
            LIMIT {$limit} OFFSET {$offset}";

    echo "SQL: $sql" . PHP_EOL;
    echo "Params: " . json_encode($params) . PHP_EOL;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll();
    echo "Items count: " . count($items) . PHP_EOL;
    foreach ($items as $i) {
        echo json_encode($i) . PHP_EOL;
    }
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . PHP_EOL;
    echo "File: " . $e->getFile() . ":" . $e->getLine() . PHP_EOL;
}

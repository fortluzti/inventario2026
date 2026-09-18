<?php
/** Validação somente leitura do módulo de estações contra o banco configurado. */
declare(strict_types=1);
require_once __DIR__ . '/../src/bootstrap.php';

try {
    $pdo = Database::pdo();
    $mod = (require __DIR__ . '/../src/modules.php')['estacoes'];
    $base = $mod['select'];
    $pdo->query($base . ' ' . $mod['order'] . ' LIMIT 1')->fetch();
    echo "OK listagem e relacionamentos\n";
    $pdo->query('SELECT COUNT(*) FROM (' . $base . ') AS t')->fetchColumn();
    echo "OK contagem paginada\n";
    $where = [];
    $params = [];
    foreach ($mod['filters'] as $column => $key) {
        $where[] = "$column = :f_$key";
        $params[":f_$key"] = $key === 'status' ? 'Em Uso' : 1;
    }
    $stmt = $pdo->prepare($base . ' WHERE ' . implode(' AND ', $where) . ' LIMIT 1');
    $stmt->execute($params);
    echo "OK filtros qualificados do registry\n";
    $parts = [];
    $params = [];
    foreach ($mod['search'] as $index => $column) {
        $parts[] = "$column LIKE :search$index";
        $params[":search$index"] = '%EST-%';
    }
    $stmt = $pdo->prepare($base . ' WHERE (' . implode(' OR ', $parts) . ') LIMIT 1');
    $stmt->execute($params);
    echo "OK busca em todas as colunas configuradas\n";
    $stmt = $pdo->prepare($base . ' WHERE estacoes.id = :id LIMIT 1');
    $stmt->execute([':id' => 1]);
    echo "OK consulta por ID\n";
    foreach (['empresas', 'setores', 'funcionarios', 'monitores', 'fornecedores'] as $table) {
        $pdo->query("SELECT id FROM $table LIMIT 1")->fetch();
    }
    echo "OK tabelas auxiliares do formulario\n";
    $clean = Validator::filter(['codigo_interno_estacao' => 'EST-TESTE', 'setor_id' => 1, 'status' => 'Em Estoque', 'acessorios' => 'Mouse,Teclado'], $mod['fields']);
    if ($clean['setor_id'] !== 1 || $clean['acessorios'] !== 'Mouse,Teclado') {
        throw new RuntimeException('Payload de cadastro invalido.');
    }
    echo "OK validacao de payload (sem gravacao)\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'FALHA: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

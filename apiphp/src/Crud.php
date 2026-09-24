<?php
/**
 * Crud — Motor generico dos endpoints padrao do legado.
 * Acoes: listar, dropdown, buscar_por_id/buscar, salvar, excluir, proximo_codigo.
 *
 * Seguranca: tabela/colunas sempre do registry (nunca do input);
 * prepared statements; paginacao/filtros validados.
 */
declare(strict_types=1);

final class Crud
{
    public function __construct(private readonly PDO $pdo, private readonly array $mod, private readonly string $endpoint) {}

    public function listar(array $input): never
    {
        $table = $this->mod['table'];
        $base  = $this->mod['select'] ?? "SELECT {$table}.* FROM {$table}";

        $where = [];
        $params = [];

        // Busca livre (whitelist de colunas)
        if (!empty($input['search']) && !empty($this->mod['search'])) {
            $parts = [];
            foreach ($this->mod['search'] as $i => $col) {
                $parts[] = "{$col} LIKE :search{$i}";
                $params[":search{$i}"] = '%' . $input['search'] . '%';
            }
            $where[] = '(' . implode(' OR ', $parts) . ')';
        }

        // Filtros (whitelist de querystrings).
        // Aceita lista simples ('status') ou mapa "coluna qualificada" => "chave do input"
        // (ex.: 'estacoes.setor_id' => 'setor_id'), necessario quando o modulo faz JOIN
        // e a coluna existe tambem em uma tabela relacionada (evita "ambiguous column").
        foreach ($this->mod['filters'] ?? [] as $key => $f) {
            $column = is_int($key) ? $f : $key;
            if (isset($input[$f]) && $input[$f] !== '') {
                $where[] = "{$column} = :f_{$f}";
                $params[":f_{$f}"] = $input[$f];
            }
        }

        // Ordenacao (whitelist por modulo): a chave amigavel ('nome', 'setor'...)
        // so e aceita se existir em mod['sortable']; a coluna SQL vem do registry
        // e NUNCA e concatenada a partir do input do cliente. A ordenacao ocorre
        // aqui, antes do LIMIT/OFFSET, valendo para o conjunto inteiro de registros.
        $orderBy = $this->mod['order'] ?? 'ORDER BY id DESC';
        $sortKey = (string)($input['sort'] ?? '');
        if ($sortKey !== '' && !empty($this->mod['sortable'][$sortKey])) {
            $dir = (strtoupper((string)($input['dir'] ?? 'ASC')) === 'DESC') ? 'DESC' : 'ASC';
            // Desempate pelo id (mesma ordem do padrao) para ordenacao estavel entre paginas.
            $orderBy = 'ORDER BY ' . $this->mod['sortable'][$sortKey] . ' ' . $dir . ", {$table}.id DESC";
        }

        $sql = $base;
        if ($where) { $sql .= ' WHERE ' . implode(' AND ', $where); }
        $sql .= ' ' . $orderBy;

        // Paginacao (inteiros garantidos)
        $page  = max(1, (int)($input['page'] ?? 1));
        $limit = min(200, max(1, (int)($input['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $stmtCount = $this->pdo->prepare(
            'SELECT COUNT(*) FROM (' . $base . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ') AS t'
        );
        $stmtCount->execute($params);
        $total = (int)$stmtCount->fetchColumn();

        $stmt = $this->pdo->prepare($sql . " LIMIT {$limit} OFFSET {$offset}");
        $stmt->execute($params);
        $data = $stmt->fetchAll();

        Response::success([
            'items'       => $data,
            'total'       => $total,
            'page'        => $page,
            'limit'       => $limit,
            'total_pages' => (int)ceil($total / $limit),
        ]);
    }

    public function dropdown(): never
    {
        $cfg = $this->mod['dropdown'] ?? null;
        if (!$cfg) {
            Response::error('Este modulo nao possui endpoint de dropdown.', 400);
        }
        $sql = "SELECT id, {$cfg['name_col']} AS nome FROM {$cfg['table']}";
        if (!empty($cfg['where'])) { $sql .= ' WHERE ' . $cfg['where']; }
        $sql .= ' ORDER BY nome';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute();
        Response::success($stmt->fetchAll());
    }

    public function handle(string $action, array $input): never
    {
        $action = match ($action) {
            'listar', 'listar_estacoes'   => 'listar',
            'listar_simples', 'dropdown'  => 'dropdown',
            'buscar_por_id', 'buscar', 'buscar_estacao_por_id' => 'buscar',
            'proximo_codigo', 'get_next_codigo' => 'proximo_codigo',
            'salvar', 'salvar_estacao'    => 'salvar',
            'excluir', 'excluir_estacao'  => 'excluir',
            default                        => $action,
        };

        match ($action) {
            'listar'         => $this->listar($input),
            'dropdown'       => $this->dropdown(),
            'buscar'         => $this->buscarPorId((int)($input['id'] ?? 0)),
            'proximo_codigo' => $this->proximoCodigo(),
            'salvar'         => $this->salvar($input),
            'excluir'        => $this->excluir((int)($input['id'] ?? 0)),
            default          => Response::error('Acao invalida ou nao especificada para este modulo.', 400),
        };
    }

    public function buscarPorId(int $id): never
    {
        if ($id <= 0) {
            Response::error('ID invalido.', 400);
        }
        $table = $this->mod['table'];
        $base  = $this->mod['select'] ?? "SELECT {$table}.* FROM {$table}";
        $stmt = $this->pdo->prepare($base . ' WHERE ' . $table . '.id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Registro nao encontrado.', 404);
        }
        Response::success($row);
    }

    public function proximoCodigo(): never
    {
        $field = $this->mod['code_field'] ?? null;
        if (!$field) {
            Response::error('Este modulo nao possui codigo sequencial.', 400);
        }
        $stmt = $this->pdo->prepare("SELECT {$field} FROM {$this->mod['table']} ORDER BY id DESC LIMIT 1");
        $stmt->execute();
        $last = $stmt->fetchColumn();
        $num = ($last && preg_match('/(\d+)\s*$/', (string)$last, $m)) ? (int)$m[1] + 1 : 1;
        $format = $this->mod['code_format'] ?? '%d';
        Response::success(['next_codigo' => sprintf($format, $num)]);
    }

    public function salvar(array $input): never
    {
        $clean = Validator::filter($input, $this->mod['fields']);
        $table = $this->mod['table'];
        $id = (int)($input['id'] ?? 0);

        if ($id > 0) {
            $sets = [];
            foreach (array_keys($clean) as $col) { $sets[] = "{$col} = :{$col}"; }
            $sets[] = 'data_atualizacao = NOW()';
            $sql = "UPDATE {$table} SET " . implode(', ', $sets) . ' WHERE id = :id';
            $params = $clean + [':id' => $id];
            $auditAction = 'update';
        } else {
            $cols = array_keys($clean);
            $phs = array_map(fn($c) => ":{$c}", $cols);
            $sql = "INSERT INTO {$table} (" . implode(', ', $cols) . ", data_cadastro, data_atualizacao) VALUES (" . implode(', ', $phs) . ", NOW(), NOW())";
            $params = $clean;
            $auditAction = 'insert';
        }

        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
        } catch (PDOException $e) {
            if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                // Melhoria herdada do 409 do legado: erro claro de duplicidade
                Response::error('Registro duplicado: ja existe um registro com este valor unico.', 409);
            }
            throw $e;
        }

        $newId = $id > 0 ? $id : (int)$this->pdo->lastInsertId();
        Audit::log($this->pdo, null, $auditAction, $this->endpoint, $newId, []);
        Response::success(
            ['id' => $newId],
            $id > 0 ? 'Registro atualizado com sucesso.' : 'Registro criado com sucesso.',
            $id > 0 ? 200 : 201
        );
    }

    public function excluir(int $id): never
    {
        if ($id <= 0) {
            Response::error('ID invalido para exclusao.', 400);
        }
        $table = $this->mod['table'];
        $this->pdo->beginTransaction();
        try {
            $chk = $this->pdo->prepare("SELECT COUNT(*) FROM {$table} WHERE id = :id");
            $chk->execute([':id' => $id]);
            if ((int)$chk->fetchColumn() === 0) {
                Response::error('Registro nao encontrado para exclusao.', 404);
            }
            $stmt = $this->pdo->prepare("DELETE FROM {$table} WHERE id = :id");
            $stmt->execute([':id' => $id]);
            $this->pdo->commit();
            Audit::log($this->pdo, null, 'delete', $this->endpoint, $id, []);
            Response::success(null, 'Registro excluido com sucesso.');
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}


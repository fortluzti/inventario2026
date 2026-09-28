<?php
/**
 * UsuariosHandler — API dedicada para gerenciamento de contas de acesso (users).
 *
 * Tabela base: users (id_usuario, nome, login, email, senha)
 *
 * Ações:
 *   - listar: Lista contas de acesso (tabela users apenas, SEM JOIN)
 *   - buscar: Busca por login, email ou id_usuario (com JOIN opcional para Perfil)
 *   - salvar: Atualiza nome, login, email (tabela users apenas)
 *   - alterar_senha: Altera senha do usuário
 *   - ativar: Não suportado — a tabela users nao possui campo ativo
 *   - novo: Cria nova conta de acesso
 *
 * IMPORTANTE: A tabela users NÃO possui campo ativo, nem cargo/setor/rg.
 * Estes campos pertencem a funcionarios. Para evitar duplicatas no JOIN
 * por email (funcionarios.email nao e unico), o listar consulta users apenas.
 */
declare(strict_types=1);

require_once __DIR__ . '/../Crud.php';
require_once __DIR__ . '/../Audit.php';

final class UsuariosHandler
{
    /** Colunas de users que podem ser ordenadas via sort/dir. */
    private const SORTABLE = [
        'id'     => 'u.id_usuario',
        'nome'   => 'u.nome',
        'login'  => 'u.login',
        'email'  => 'u.email',
    ];

    public static function handle(PDO $pdo, string $action, array $input): never
    {
        match ($action) {
            'listar'                    => self::listar($pdo, $input),
            'buscar_por_id', 'buscar'   => self::buscar($pdo, $input),
            'salvar'                    => self::salvar($pdo, $input),
            'alterar_senha'             => self::alterarSenha($pdo, $input),
            'ativar'                    => self::ativar($pdo, $input),
            'novo'                      => self::novo($pdo, $input),
            default                     => Response::error('Acao invalida para usuarios.', 400),
        };
    }

    public static function listar(PDO $pdo, array $input): never
    {
        $search = trim((string)($input['search'] ?? ''));
        $where = [];
        $params = [];

        if ($search !== '') {
            $where[] = '(u.nome LIKE :s OR u.login LIKE :s OR u.email LIKE :s)';
            $params[':s'] = '%' . $search . '%';
        }

        $page  = max(1, (int)($input['page'] ?? 1));
        $limit = min(200, max(1, (int)($input['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';

        $orderBy = 'ORDER BY u.nome ASC, u.id_usuario DESC';
        $sortKey = (string)($input['sort'] ?? '');
        $dir = (strtoupper((string)($input['dir'] ?? 'ASC')) === 'DESC') ? 'DESC' : 'ASC';
        if ($sortKey !== '' && isset(self::SORTABLE[$sortKey])) {
            $orderBy = 'ORDER BY ' . self::SORTABLE[$sortKey] . ' ' . $dir . ', u.id_usuario DESC';
        }

        $sql = "SELECT u.id_usuario AS id, u.nome, u.login, u.email
                FROM users u
                {$whereSql} {$orderBy}
                LIMIT {$limit} OFFSET {$offset}";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        $sqlCount = "SELECT COUNT(*) FROM users u{$whereSql}";
        $stmtCount = $pdo->prepare($sqlCount);
        $stmtCount->execute($params);
        $total = (int)$stmtCount->fetchColumn();

        Response::success([
            'items'       => $items,
            'total'       => $total,
            'page'        => $page,
            'limit'       => $limit,
            'total_pages' => (int)ceil($total / $limit),
        ]);
    }

    public static function buscar(PDO $pdo, array $input): never
    {
        $ident = trim((string)($input['id'] ?? ''));
        if ($ident === '') {
            Response::error('ID, login ou email do usuario nao informado.', 400);
        }

        $sql = "SELECT u.id_usuario AS id, u.nome, u.login, u.email,
                       f.cargo, f.setor, f.rg, f.ativo AS ativo_func, f.id AS funcionario_id
                FROM users u
                LEFT JOIN funcionarios f ON f.email = u.email
                WHERE u.id_usuario = :id OR u.login = :ident1 OR u.email = :ident2
                ORDER BY u.id_usuario ASC
                LIMIT 1";

        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':id', ctype_digit($ident) ? (int)$ident : 0, PDO::PARAM_INT);
        $stmt->bindValue(':ident1', $ident, PDO::PARAM_STR);
        $stmt->bindValue(':ident2', $ident, PDO::PARAM_STR);
        $stmt->execute();

        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Usuario nao encontrado.', 404);
        }

        Audit::log($pdo, null, 'buscar', 'usuarios', (int)$row['id'], []);
        Response::success($row);
    }

    public static function salvar(PDO $pdo, array $input): never
    {
        $id = trim((string)($input['id'] ?? ''));
        if ($id === '') {
            Response::error('ID do usuario nao informado.', 400);
        }

        if (array_key_exists('trocar_senha', $input) && !empty($input['trocar_senha'])) {
            self::alterarSenha($pdo, $input);
        }

        $idUsuario = self::resolverIdUsuario($pdo, $id);

        $nome = trim((string)($input['nome'] ?? ''));
        if ($nome === '') {
            Response::error('Nome e obrigatorio.', 400);
        }

        $login = trim((string)($input['login'] ?? ''));
        if ($login !== '') {
            $chk = $pdo->prepare('SELECT 1 FROM users WHERE login = :login AND id_usuario <> :id LIMIT 1');
            $chk->execute([':login' => $login, ':id' => $idUsuario]);
            if ($chk->fetch()) {
                Response::error('Ja existe um usuario com este login.', 409);
            }
        }

        $email = trim((string)($input['email'] ?? ''));
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Email invalido.', 400);
        }

        $pdo->beginTransaction();
        try {
            $sets = [];
            $params = [];
            if ($nome !== '') {
                $sets[] = "nome = :nome";
                $params[':nome'] = $nome;
            }
            if ($login !== '' && array_key_exists('login', $input)) {
                $sets[] = "login = :login";
                $params[':login'] = $login;
            }
            if (array_key_exists('email', $input)) {
                $sets[] = "email = :email";
                $params[':email'] = $email !== '' ? $email : null;
            }
            if (!empty($sets)) {
                $sets[] = 'data_atualizacao = NOW()';
                $params[':id'] = $idUsuario;
                $sql = "UPDATE users SET " . implode(', ', $sets) . ' WHERE id_usuario = :id';
                $pdo->prepare($sql)->execute($params);
            }

            $pdo->commit();
            Audit::log($pdo, null, 'update', 'usuarios', $idUsuario, ['campos' => array_keys($input)]);
            Response::success(
                ['id' => $idUsuario],
                'Usuario atualizado com sucesso.',
                200
            );
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) { $pdo->rollBack(); }
            error_log('[usuarios] salvar: ' . $e->getMessage());
            Response::error('Falha ao atualizar o usuario.', 500);
        }
    }

    public static function alterarSenha(PDO $pdo, array $input): never
    {
        $id = trim((string)($input['id'] ?? ''));
        $novaSenha = $input['nova_senha'] ?? $input['nova'] ?? '';

        if ($id === '' || $novaSenha === '') {
            Response::error('ID do usuario e nova senha sao obrigatorios.', 400);
        }
        if (strlen($novaSenha) < 6) {
            Response::error('A senha deve ter no minimo 6 caracteres.', 400);
        }

        $idUsuario = self::resolverIdUsuario($pdo, $id);

        $senhaAtual = $input['senha_atual'] ?? '';
        if ($senhaAtual !== '') {
            $stmt = $pdo->prepare('SELECT senha FROM users WHERE id_usuario = :id');
            $stmt->execute([':id' => $idUsuario]);
            $row = $stmt->fetch();
            if (!$row || !password_verify($senhaAtual, $row['senha'])) {
                Response::error('Senha atual incorreta.', 401);
            }
        }

        $hash = password_hash($novaSenha, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare(
            'UPDATE users SET senha = :senha, data_atualizacao = NOW() WHERE id_usuario = :id'
        );
        $stmt->execute([':senha' => $hash, ':id' => $idUsuario]);

        Audit::log($pdo, null, 'senha_alterada', 'usuarios', $idUsuario, []);
        Response::success(null, 'Senha alterada com sucesso.');
    }

    /**
     * Tabela users NAO possui campo ativo.
     * O status de ativo/inativo pertence a funcionarios, que e uma entidade distinta.
     * Para evitar atuar sobre dados de funcionario (mixing de entidades),
     * este endpoint retorna 409 informando que a operacao nao e suportada
     * no nivel de usuario. A ativacao/desativacao requer campo de schema
     * nao disponivel na tabela users.
     */
    public static function ativar(PDO $pdo, array $input): never
    {
        $id = trim((string)($input['id'] ?? ''));
        if ($id === '') {
            Response::error('ID do usuario nao informado.', 400);
        }

        $idUsuario = self::resolverIdUsuario($pdo, $id);

        Response::error(
            'A tabela users nao possui campo ativo. Nao e possivel ativar/desativar ' .
            'uma conta de acesso sem informar status. Use o modulo de Funcionarios para ' .
            'gerenciar o status funcional.',
            409
        );
    }

    /**
     * Cria nova conta de acesso (tabela users apenas).
     * Params: { nome*, login*, senha*, email? }
     * Nao cria registro em funcionarios — entidades distintas.
     */
    public static function novo(PDO $pdo, array $input): never
    {
        $nome  = trim((string)($input['nome'] ?? ''));
        $login = trim((string)($input['login'] ?? ''));
        $senha = $input['senha'] ?? '';

        if ($nome === '' || $login === '') {
            Response::error('Nome e login sao obrigatorios.', 400);
        }
        if (strlen($senha) < 6) {
            Response::error('A senha deve ter no minimo 6 caracteres.', 400);
        }

        $stmt = $pdo->prepare('SELECT id_usuario FROM users WHERE login = :login LIMIT 1');
        $stmt->execute([':login' => $login]);
        if ($stmt->fetch()) {
            Response::error('Ja existe um usuario com este login.', 409);
        }

        $email = trim((string)($input['email'] ?? ''));
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Email invalido.', 400);
        }

        $usr = $_SERVER['PHP_AUTH_USER'] ?? 'api';
        $pdo->beginTransaction();
        try {
            $hash = password_hash($senha, PASSWORD_DEFAULT);
            $sql = "INSERT INTO users (nome, login, email, senha, data_cadastro, usuario_cadastro, data_atualizacao, usuario_atualizacao)
                    VALUES (:nome, :login, :email, :senha, NOW(), :usr_cad, NOW(), :usr_atu)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':nome'    => $nome,
                ':login'   => $login,
                ':email'   => $email !== '' ? $email : null,
                ':senha'   => $hash,
                ':usr_cad' => $usr,
                ':usr_atu' => $usr,
            ]);
            $idUsuario = (int)$pdo->lastInsertId();

            $pdo->commit();
            Audit::log($pdo, null, 'create', 'usuarios', $idUsuario, []);
            Response::success(['id' => $idUsuario], 'Usuario criado com sucesso.', 201);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) { $pdo->rollBack(); }
            error_log('[usuarios] novo: ' . $e->getMessage());
            if ($e instanceof PDOException && $e->errorInfo[1] === 1062) {
                Response::error('Conflito: login ou email duplicado.', 409);
            }
            Response::error('Falha ao criar usuario.', 500);
        }
    }

    private static function resolverIdUsuario(PDO $pdo, string $id): int
    {
        if (ctype_digit($id)) {
            $idInt = (int)$id;
            $stmt = $pdo->prepare('SELECT id_usuario FROM users WHERE id_usuario = :id LIMIT 1');
            $stmt->execute([':id' => $idInt]);
            $result = $stmt->fetchColumn();
            if ($result) {
                return (int)$result;
            }
        }

        $stmt = $pdo->prepare(
            'SELECT id_usuario FROM users WHERE login = :ident1 OR email = :ident2 LIMIT 1'
        );
        $stmt->execute([':ident1' => $id, ':ident2' => $id]);
        $result = $stmt->fetchColumn();

        if (!$result) {
            Response::error('Usuario nao encontrado.', 404);
        }
        return (int)$result;
    }
}

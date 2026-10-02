<?php
/**
 * UsuariosHandler — API dedicada para gerenciamento de contas de acesso (users).
 *
 * Tabela base: users (id_usuario, nome, login, email, senha, ativo)
 *
 * Ações:
 *   - listar: Lista contas de acesso (tabela users apenas, SEM JOIN)
 *   - buscar: Busca por login, email ou id_usuario (com JOIN opcional para Perfil)
 *   - salvar: Atualiza nome, login, email, ativo (tabela users apenas)
 *   - alterar_senha: Altera senha do usuário
 *   - ativar: Ativa ou desativa o usuário
 *   - toggleAtivo: Alterna o status ativo/inativo do usuário
 *   - novo: Cria nova conta de acesso
 *
 * IMPORTANTE: A tabela users possui campo ativo (tinyint), indicando se o usuário está ativo ou inativo.
 * Também possui os campos nome, login, email e senha.
 * Não possui cargo, setor ou rg — estes pertencem à tabela funcionarios.
 * Para evitar duplicatas no JOIN por email (funcionarios.email não é único), o listar consulta users apenas.
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
        'ativo'  => 'ativo',
    ];

    public static function handle(PDO $pdo, string $action, array $input): never
    {
        match ($action) {
            'listar'                    => self::listar($pdo, $input),
            'buscar_por_id', 'buscar'   => self::buscar($pdo, $input),
            'salvar'                    => self::salvar($pdo, $input),
            'alterar_senha'             => self::alterarSenha($pdo, $input),
            'ativar'                    => self::ativar($pdo, $input),
            'toggleAtivo'               => self::toggleAtivo($pdo, $input),
            'excluir'                   => self::excluir($pdo, $input),
            'novo'                      => self::novo($pdo, $input),
            default                     => Response::error('Acao invalida para usuarios.', 400),
        };
    }

    public static function listar(PDO $pdo, array $input): never
    {
        $search = trim((string)($input['search'] ?? ''));
        $where = [];
        $params = [];

        // Exclude deleted users (those with login containing #DELETED#)
        $where[] = "u.login NOT LIKE :deletedPattern";
        $params[':deletedPattern'] = '%#DELETED#%';

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

        $sql = "SELECT u.id_usuario AS id, u.nome, u.login, u.email, u.ativo
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

        $sql = "SELECT u.id_usuario AS id, u.nome, u.login, u.email, u.ativo,
                        f.cargo, f.setor, f.rg, f.ativo AS ativo_func, f.id AS funcionario_id
                 FROM users u
                 LEFT JOIN funcionarios f ON f.email = u.email
                 WHERE u.login NOT LIKE :deletedPattern
                   AND (u.id_usuario = :id OR u.login = :ident1 OR u.email = :ident2)
                 ORDER BY u.id_usuario ASC
                 LIMIT 1";

        $stmt = $pdo->prepare($sql);
        // Bind the deleted pattern
        $stmt->bindValue(':deletedPattern', '%#DELETED#%');
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

        // Fetch current login to check if user is deleted (has #DELETED# marker)
        $currentLoginStmt = $pdo->prepare('SELECT login FROM users WHERE id_usuario = :id');
        $currentLoginStmt->execute([':id' => $idUsuario]);
        $currentLoginRow = $currentLoginStmt->fetch();
        $isDeletedLogin = $currentLoginRow && strpos($currentLoginRow['login'], '#DELETED#') !== false;

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
            if (strpos($login, '#DELETED#') !== false) {
                Response::error('Login invalido.', 400);
            }
            $chk = $pdo->prepare('SELECT 1 FROM users WHERE login = :login AND id_usuario <> :id LIMIT 1');
            $chk->execute([':login' => $login, ':id' => $idUsuario]);
            if ($chk->fetch()) {
                Response::error('Ja existe um usuario com este login.', 409);
            }
            $sets[] = "login = :login";
            $params[':login'] = $login;
        }
if (array_key_exists('email', $input)) {
            $sets[] = "email = :email";
            $params[':email'] = $email !== '' ? $email : null;
        }
        if (array_key_exists('ativo', $input)) {
            $sets[] = "ativo = :ativo";
            $params[':ativo'] = (int)$input['ativo'];
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
     * Ativa ou desativa o usuario.
     * Params: { id, ativo? } (ativo: 1 para ativo, 0 para inativo, padrao 1)
     */
    public static function ativar(PDO $pdo, array $input): never
    {
        $id = trim((string)($input['id'] ?? ''));
        if ($id === '') {
            Response::error('ID do usuario nao informado.', 400);
        }

        $idUsuario = self::resolverIdUsuario($pdo, $id);

        $ativo = isset($input['ativo']) ? (int)$input['ativo'] : 1;
        if ($ativo !== 0 && $ativo !== 1) {
            $ativo = 1;
        }

        $stmt = $pdo->prepare('UPDATE users SET ativo = :ativo, data_atualizacao = NOW() WHERE id_usuario = :id');
        $stmt->execute([':ativo' => $ativo, ':id' => $idUsuario]);

        Audit::log($pdo, null, 'ativar', 'usuarios', $idUsuario, ['ativo' => $ativo]);
        Response::success(null, 'Status atualizado com sucesso.');
    }

    public static function toggleAtivo(PDO $pdo, array $input): never
    {
        $id = trim((string)($input['id'] ?? ''));
        if ($id === '') {
            Response::error('ID do usuario nao informado.', 400);
        }

        $idUsuario = self::resolverIdUsuario($pdo, $id);

        // Get current ativo status
        $stmt = $pdo->prepare('SELECT ativo FROM users WHERE id_usuario = :id');
        $stmt->execute([':id' => $idUsuario]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Usuario nao encontrado.', 404);
        }
        $novoAtivo = !$row['ativo'];

        // Update ativo in users
        $stmt = $pdo->prepare('UPDATE users SET ativo = :ativo, data_atualizacao = NOW() WHERE id_usuario = :id');
        $stmt->execute([':ativo' => $novoAtivo ? 1 : 0, ':id' => $idUsuario]);

        Audit::log($pdo, null, 'toggleAtivo', 'usuarios', $idUsuario, ['ativo' => $novoAtivo]);
        Response::success(null, 'Status atualizado com sucesso.');
    }

    /**
     * Exclui logicamente o usuario (soft delete).
     * Params: { id }
     * Altera o login e email para incluir um marcador de exclusao e define ativo=0.
     */
    public static function excluir(PDO $pdo, array $input): never
    {
        $id = trim((string)($input['id'] ?? ''));
        if ($id === '') {
            Response::error('ID do usuario nao informado.', 400);
        }

        $idUsuario = self::resolverIdUsuario($pdo, $id);

        // Get current login and email
        $stmt = $pdo->prepare('SELECT login, email FROM users WHERE id_usuario = :id');
        $stmt->execute([':id' => $idUsuario]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Usuario nao encontrado.', 404);
        }
        $login = $row['login'];
        $email = $row['email'];

        // Generate a deleted marker to make login unique and free the original login
        $timestamp = (int)(microtime(true) * 1000); // milliseconds
        $deletedLogin = $login . '#DELETED#' . $id . '#' . $timestamp;
        $deletedEmail = $email !== '' ? $email . '#DELETED#' . $id . '#' . $timestamp : null;

        $pdo->beginTransaction();
        try {
            $sets = [];
            $params = [];
            $sets[] = "login = :login";
            $params[':login'] = $deletedLogin;
            if ($email !== '') {
                $sets[] = "email = :email";
                $params[':email'] = $deletedEmail;
            }
            $sets[] = "ativo = :ativo";
            $params[':ativo'] = 0;
            $sets[] = "data_atualizacao = NOW()";
            $params[':id'] = $idUsuario;

            $sql = "UPDATE users SET " . implode(', ', $sets) . ' WHERE id_usuario = :id';
            $pdo->prepare($sql)->execute($params);

            $pdo->commit();
            Audit::log($pdo, null, 'excluir', 'usuarios', $idUsuario, ['deletedLogin' => $deletedLogin]);
            Response::success(null, 'Usuario excluido com sucesso.');
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) { $pdo->rollBack(); }
            error_log('[usuarios] excluir: ' . $e->getMessage());
            Response::error('Falha ao excluir o usuario.', 500);
        }
    }

    /**
     * Cria nova conta de acesso (tabela users apenas).
     * Params: { nome*, login*, senha*, email?, ativo? }
     * Nao cria registro em funcionarios — entidades distintas.
     */
    public static function novo(PDO $pdo, array $input): never
    {
        $nome  = trim((string)($input['nome'] ?? ''));
        if ($nome === '') {
            Response::error('Nome e obrigatorio.', 400);
        }
        $login = trim((string)($input['login'] ?? ''));
        if ($login === '') {
            Response::error('Login e obrigatorio.', 400);
        }
        if (strpos($login, '#DELETED#') !== false) {
            Response::error('Login invalido.', 400);
        }
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
            $ativo = isset($input['ativo']) ? (int)$input['ativo'] : 1;
            $sql = "INSERT INTO users (nome, login, email, senha, ativo, data_cadastro, usuario_cadastro, data_atualizacao, usuario_atualizacao)
                    VALUES (:nome, :login, :email, :senha, :ativo, NOW(), :usr_cad, NOW(), :usr_atu)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':nome'    => $nome,
                ':login'   => $login,
                ':email'   => $email !== '' ? $email : null,
                ':senha'   => $hash,
                ':ativo'   => $ativo,
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

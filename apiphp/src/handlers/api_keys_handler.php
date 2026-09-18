<?php
/**
 * ApiKeysHandler — Gerenciamento de chaves de API via web.
 *
 * Acoes:
 *   listar  (GET)   — lista chaves com colunas seguras (nunca retorna key_hash/key_prefix)
 *   criar   (POST)  — cria uma nova chave; a chave em texto puro e retornada UMA VEZ
 *   revogar (POST)  — revoga uma chave (ativo = 0)
 */
declare(strict_types=1);

final class ApiKeysHandler
{
    public static function handle(PDO $pdo, string $action, array $input): never
    {
        match ($action) {
            'listar'  => self::listar($pdo),
            'criar'   => self::criar($pdo, $input),
            'revogar' => self::revogar($pdo, $input),
            'atualizar' => self::atualizar($pdo, $input),
            default   => Response::error('Acao invalida para api_keys.', 400),
        };
    }

    /** Lista chaves — nunca expoe key_hash ou key_prefix. */
    public static function listar(PDO $pdo): never
    {
        $stmt = $pdo->query(
            'SELECT id, nome, scopes, rate_limit, ativo, expira_em, criado_em, ultimo_uso
             FROM api_keys ORDER BY id DESC'
        );
        $items = $stmt->fetchAll();
        // Mascara: nunca expoe key_hash ou key_prefix. Mostra prefixo fixo + dots.
        foreach ($items as &$item) {
            $item['key_masked'] = 'flz_' . str_repeat('•', 20);
        }
        unset($item);
        Response::success($items);
    }

    /**
     * Cria uma nova API Key.
     * Retorna a chave em texto puro uma unica vez. O banco armazena apenas o hash.
     */
    public static function criar(PDO $pdo, array $input): never
    {
        $nome   = trim((string)($input['nome'] ?? ''));
        $scopes = trim((string)($input['scopes'] ?? '*'));

        if ($nome === '') {
            Response::error('Identificacao e obrigatoria.', 422);
        }

        if ($scopes === '' || $scopes === '*') {
            $scopes = '*';
        } else {
            // Valida cada scope contra a lista de modulos conhecidos
            $validModules = self::validModules();
            $parts = array_map('trim', explode(',', $scopes));
            foreach ($parts as $p) {
                if ($p === '' || !in_array($p, $validModules, true)) {
                    Response::error("Escopo invalido: {$p}. Use '*' ou modulos validos.", 422);
                }
            }
            $scopes = implode(',', $parts);
        }

        $rateLimit = (int)($input['rate_limit'] ?? 0);

        $raw    = 'flz_' . bin2hex(random_bytes(24));
        $prefix = substr($raw, 0, 8);
        $hash   = hash('sha256', $raw);

        $stmt = $pdo->prepare(
            'INSERT INTO api_keys (nome, key_prefix, key_hash, scopes, rate_limit, ativo, expira_em)
             VALUES (:n, :p, :h, :s, :rl, 1, NULL)'
        );
        $stmt->execute([
            ':n'  => $nome,
            ':p'  => $prefix,
            ':h'  => $hash,
            ':s'  => $scopes,
            ':rl' => $rateLimit,
        ]);

        $id = (int)$pdo->lastInsertId();
        Audit::log($pdo, $id, 'api_key_create', 'api_keys', $id, ['nome' => $nome, 'scopes' => $scopes]);

        Response::success(
            ['id' => $id, 'nome' => $nome, 'scopes' => $scopes, 'key' => $raw],
            'API Key criada com sucesso.',
            201
        );
    }

    /** Atualiza uma chave existente (nome, scopes, rate_limit, ativo, expira_em). */
    public static function atualizar(PDO $pdo, array $input): never
    {
        $id     = (int)($input['id'] ?? 0);
        $nome   = trim((string)($input['nome'] ?? ''));
        $scopes = trim((string)($input['scopes'] ?? '*'));

        if ($id <= 0) {
            Response::error('ID invalido.', 400);
        }
        if ($nome === '') {
            Response::error('Identificacao e obrigatoria.', 422);
        }

        $sets = ['nome = :nome', 'scopes = :scopes'];
        $params = [':id' => $id, ':nome' => $nome, ':scopes' => $scopes === '*' ? '*' : $scopes];

        if (array_key_exists('rate_limit', $input) && $input['rate_limit'] !== '') {
            $sets[] = 'rate_limit = :rate_limit';
            $params[':rate_limit'] = (int)$input['rate_limit'];
        }
        if (array_key_exists('ativo', $input) && $input['ativo'] !== '') {
            $sets[] = 'ativo = :ativo';
            $params[':ativo'] = (int)$input['ativo'];
        }
        if (array_key_exists('expira_em', $input) && $input['expira_em'] !== '') {
            $sets[] = 'expira_em = :expira_em';
            $params[':expira_em'] = $input['expira_em'] === 'NULL' ? null : $input['expira_em'];
        }

        $stmt = $pdo->prepare('UPDATE api_keys SET ' . implode(', ', $sets) . ' WHERE id = :id');
        $stmt->execute($params);

        if ($stmt->rowCount() === 0) {
            Response::error('Chave nao encontrada.', 404);
        }

        Audit::log($pdo, $id, 'api_key_update', 'api_keys', $id, ['nome' => $nome]);
        Response::success(null, 'API Key atualizada com sucesso.');
    }

    /** Revoga (soft-delete) uma chave: ativo = 0. */
    public static function revogar(PDO $pdo, array $input): never
    {
        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) {
            Response::error('ID invalido.', 400);
        }

        $stmt = $pdo->prepare('SELECT id FROM api_keys WHERE id = :id AND ativo = 1');
        $stmt->execute([':id' => $id]);
        if (!$stmt->fetch()) {
            Response::error('Chave nao encontrada ou ja revogada.', 404);
        }

        $pdo->prepare('UPDATE api_keys SET ativo = 0 WHERE id = :id')->execute([':id' => $id]);
        Audit::log($pdo, $id, 'api_key_revoke', 'api_keys', $id, []);

        Response::success(null, 'API Key revogada com sucesso.');
    }

    /** Retorna a lista de endpoints/modulos validos para escopos. */
    private static function validModules(): array
    {
        return [
            'ativos_diversos', 'ativos_tipos', 'empresas', 'estacoes',
            'fornecedores', 'funcionarios', 'impressoras', 'impressoras_modelos',
            'monitores', 'nobreaks', 'setores', 'softwares', 'toners',
            'api_keys', 'configuracoes', 'health', 'dashboard_kpis',
            'dashboard_alertas', 'dashboard_atividade', 'qrcode',
        ];
    }
}

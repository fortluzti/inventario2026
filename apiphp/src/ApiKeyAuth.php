<?php
/**
 * ApiKeyAuth — Autenticacao por chave de API (melhoria central da v2).
 *
 * Como funciona:
 *  - As chaves sao armazenadas na tabela `api_keys` (prefixo + hash SHA-256).
 *  - O cliente envia `X-API-KEY: <chave>` (ou `?api_key=` para navegacao — NAO recomendado).
 *  - A chave enviada e hasheada e comparada com hash_equals (timing-safe).
 *  - Cada chave tem `scopes` (lista separada por virgula de modulos autorizados,
 *    ou `*` para todos) e `rate_limit` proprio.
 *  - Toda chamada e registrada em auditoria (uso de chave, endpoint, IP).
 */
declare(strict_types=1);

final class ApiKeyAuth
{
    public static function authenticate(PDO $pdo): array
    {
        $key = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['api_key'] ?? '';
        if ($key === '' || !is_string($key)) {
            Response::error('Acesso nao autorizado: API Key ausente.', 401);
        }

        // Rate limit antes mesmo de consultar o banco
        RateLimiter::check('key:' . hash('sha256', $key), Config::int('RATE_LIMIT_PER_MIN', 120));

        $prefix = substr($key, 0, 8);
        $stmt = $pdo->prepare(
            'SELECT id, nome, key_hash, scopes, rate_limit, ativo, expira_em
               FROM api_keys WHERE key_prefix = :prefix LIMIT 1'
        );
        $stmt->execute([':prefix' => $prefix]);
        $row = $stmt->fetch();

        if (!$row) {
            Audit::log($pdo, null, 'auth_fail', 'api_keys', null, ['motivo' => 'prefixo_inexistente']);
            Response::error('Acesso nao autorizado: API Key invalida.', 401);
        }
        if ((int)$row['ativo'] !== 1) {
            Response::error('Acesso nao autorizado: API Key revogada.', 401);
        }
        if ($row['expira_em'] !== null && strtotime((string)$row['expira_em']) < time()) {
            Response::error('Acesso nao autorizado: API Key expirada.', 401);
        }

        $hash = hash('sha256', $key);
        if (!hash_equals((string)$row['key_hash'], $hash)) {
            Audit::log($pdo, (int)$row['id'], 'auth_fail', 'api_keys', (int)$row['id'], ['motivo' => 'hash_divergente']);
            Response::error('Acesso nao autorizado: API Key invalida.', 401);
        }

        RateLimiter::check('apikey:' . (int)$row['id'], (int)($row['rate_limit'] ?: Config::int('RATE_LIMIT_PER_MIN', 120)));

        Audit::log($pdo, (int)$row['id'], 'api_call', $_GET['endpoint'] ?? '', null, []);
        return $row;
    }

    /** Verifica se a chave autenticada pode acessar o modulo/escopo. */
    public static function authorize(array $keyRow, string $endpoint): void
    {
        $scopes = array_map('trim', explode(',', (string)$keyRow['scopes']));
        if (in_array('*', $scopes, true) || in_array($endpoint, $scopes, true)) {
            return;
        }
        Response::error('Acesso negado: a chave nao possui escopo para este modulo.', 403);
    }
}

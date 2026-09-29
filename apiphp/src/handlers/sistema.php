<?php
/**
 * SistemaHandler — Endpoint dedicado de informacoes de versao do sistema.
 *
 * Fonte unica de verdade no banco (migration `004_sistema_info.sql`):
 *   - sistema_info.app_versao = versao da aplicacao (ex.: 2026.1.0)
 *   - sistema_info.app_build  = canal/tipo do build (ex.: web)
 *   - sistema_info.db_versao  = ultima migration aplicada (tabela `schema_migrations`)
 *
 * O texto exibido no frontend ("Build 2026.1.0-web") e montado no campo `build`
 * a partir desses dados — nenhuma versao fica hardcoded no codigo.
 * As acoes sao somente leitura: a versao e atualizada por migration/runner.
 */
declare(strict_types=1);

final class SistemaHandler
{
    public static function handle(PDO $pdo, string $action, array $input): never
    {
        match ($action) {
            'versao', 'info' => self::versao($pdo),
            default          => Response::error('Acao invalida para sistema.', 400),
        };
    }

    /** GET — versao da aplicacao, build, versao do schema e banco conectado. */
    public static function versao(PDO $pdo): never
    {
        if (!self::tableExists($pdo, 'sistema_info')) {
            Response::error(
                'Controle de versao do sistema nao inicializado. Execute: php apiphp/scripts/migrate.php',
                503
            );
        }

        $stmt = $pdo->query(
            'SELECT app_versao, app_build, db_versao, atualizado_em FROM sistema_info WHERE id = 1'
        );
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Registro de versao do sistema ausente (sistema_info.id = 1).', 503);
        }

        $appVersao = trim((string)$row['app_versao']);
        $appBuild  = trim((string)$row['app_build']);

        Response::success([
            'app_versao'           => $appVersao,
            'app_build'            => $appBuild,
            'build'                => $appBuild === '' ? $appVersao : $appVersao . '-' . $appBuild,
            'db_versao'            => trim((string)$row['db_versao']),
            'db_nome'              => self::bancoAtual($pdo),
            'migrations_aplicadas' => self::migrationsAplicadas($pdo),
            'atualizado_em'        => $row['atualizado_em'],
        ]);
    }

    /** Nome do banco efetivamente conectado (nao versionado no codigo). */
    private static function bancoAtual(PDO $pdo): string
    {
        $nome = (string)$pdo->query('SELECT DATABASE()')->fetchColumn();
        return $nome !== '' ? $nome : (string)Config::get('DB_NAME', '');
    }

    /** Quantidade de migrations registradas em `schema_migrations`. */
    private static function migrationsAplicadas(PDO $pdo): int
    {
        if (!self::tableExists($pdo, 'schema_migrations')) {
            return 0;
        }
        return (int)$pdo->query('SELECT COUNT(*) FROM schema_migrations')->fetchColumn();
    }

    private static function tableExists(PDO $pdo, string $table): bool
    {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t'
        );
        $stmt->execute([':t' => $table]);
        return (int)$stmt->fetchColumn() > 0;
    }
}

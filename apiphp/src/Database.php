<?php
/**
 * Database — PDO singleton MySQL (apenas prepared statements).
 */
declare(strict_types=1);

final class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }
        try {
            self::$pdo = self::connect();
        } catch (PDOException $e) {
            error_log('[apiphp] Falha na conexao do BD: ' . $e->getMessage());
            Response::error('Servico temporariamente indisponivel.', 503);
        }
        return self::$pdo;
    }

    /** Verifica saude do BD sem derrubar a resposta (usado pelo endpoint health). */
    public static function ping(): bool
    {
        try {
            self::connect()->query('SELECT 1');
            return true;
        } catch (Throwable) {
            return false;
        }
    }

    private static function connect(): PDO
    {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            Config::get('DB_HOST', '127.0.0.1'),
            Config::get('DB_PORT', '3306'),
            Config::get('DB_NAME'),
            Config::get('DB_CHARSET', 'utf8mb4')
        );
        return new PDO($dsn, Config::get('DB_USER'), Config::get('DB_PASS'), [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false, // prepara no servidor (anti SQL injection)
            PDO::ATTR_STRINGIFY_FETCHES  => false,
        ]);
    }
}

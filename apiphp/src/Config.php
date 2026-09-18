<?php
/**
 * Config — Carrega e valida o .env ( Twelve/Fort style, zero dependencias).
 *
 * Principios de seguranca:
 *  - Nenhuma credencial no codigo: tudo vem de .env (fora do web root).
 *  - Em APP_DEBUG=false, erros sao registrados em log e mascarados na resposta.
 */
declare(strict_types=1);

final class Config
{
    private static array $data = [];

    public static function load(string $envFile): void
    {
        if (!is_readable($envFile)) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => 'Configuracao ausente (.env).']);
            exit;
        }
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
            $key = trim($key);
            $value = trim($value);
            // Suporta aspas simples (senha com #, por exemplo)
            if (strlen($value) >= 2 && $value[0] === "'" && str_ends_with($value, "'")) {
                $value = substr($value, 1, -1);
            }
            self::$data[$key] = $value;
        }
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        $v = self::$data[$key] ?? null;
        if ($v === null || $v === '') {
            return $default;
        }
        return $v;
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $v = self::get($key);
        return $v === null ? $default : in_array(strtolower($v), ['1', 'true', 'yes', 'on'], true);
    }

    public static function int(string $key, int $default): int
    {
        $v = self::get($key);
        return $v === null ? $default : (int)$v;
    }

    public static function isDebug(): bool
    {
        return self::bool('APP_DEBUG', false);
    }
}

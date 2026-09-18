<?php
/**
 * RateLimiter — Janela fixa por minuto, armazenado em arquivos (sem dependencias).
 * Pasta de estado: <projeto>/storage/ratelimit/
 */
declare(strict_types=1);

final class RateLimiter
{
    public static function check(string $bucket, int $limitPerMin): void
    {
        if ($limitPerMin <= 0) {
            return;
        }
        $dir = __DIR__ . '/../storage/ratelimit';
        if (!is_dir($dir)) { @mkdir($dir, 0770, true); }
        $file = $dir . '/' . preg_replace('/[^a-z0-9]/i', '_', $bucket) . '_' . date('YmdHi') . '.cnt';

        $count = 0;
        if (is_file($file)) {
            $count = (int)file_get_contents($file);
        }
        $count++;
        file_put_contents($file, (string)$count, LOCK_EX);

        if ($count > $limitPerMin) {
            header('Retry-After: 60');
            Response::error('Limite de requisicoes excedido. Tente novamente em um minuto.', 429);
        }
    }
}

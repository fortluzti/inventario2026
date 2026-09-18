<?php
/**
 * Security — Headers, CORS por allowlist e coleta segura de input.
 */
declare(strict_types=1);

final class Security
{
    public static function sendHeaders(): void
    {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: no-referrer');
        header('X-XSS-Protection: 0'); // CSP cuida disso; header legado desabilitado
        header("Permissions-Policy: geolocation=(), microphone=(), camera=()");
        if (Config::get('APP_ENV') === 'production') {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        }

        $origins = array_filter(array_map('trim', explode(',', (string)Config::get('CORS_ORIGINS', ''))));
        $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin !== '' && in_array($origin, $origins, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
            header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, X-API-KEY');
            header('Access-Control-Max-Age: 600');
        }
    }

    /** Aceita GET/POST form e POST JSON. Entrada estranha e descartada. */
    public static function input(): array
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if ($method === 'POST') {
            $ctype = $_SERVER['CONTENT_TYPE'] ?? '';
            if (str_contains($ctype, 'application/json')) {
                $raw = file_get_contents('php://input') ?: '';
                $json = json_decode($raw, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    Response::error('Corpo JSON invalido.', 400);
                }
                return is_array($json) ? $json : [];
            }
            return $_POST;
        }
        return $_GET;
    }
}

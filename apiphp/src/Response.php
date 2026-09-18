<?php
/**
 * Response — Envelope JSON padrao, compativel com os handlers legados:
 *   sucesso:  { "success": true,  "data": ...,  "message": "..." }
 *   erro:     { "success": false, "message": "...", "errors": { campo: [..] } }
 */
declare(strict_types=1);

final class Response
{
    public static function json(array $payload, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function success(mixed $data = null, string $message = '', int $status = 200): never
    {
        $payload = ['success' => true];
        if ($data !== null)  { $payload['data'] = $data; }
        if ($message !== '') { $payload['message'] = $message; }
        self::json($payload, $status);
    }

    public static function error(string $message, int $status = 400, array $errors = []): never
    {
        $payload = ['success' => false, 'message' => $message];
        if ($errors !== []) { $payload['errors'] = $errors; }
        self::json($payload, $status);
    }
}

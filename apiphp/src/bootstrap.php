<?php
/**
 * Bootstrap — Setup unico da API v2.
 */
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

require_once __DIR__ . '/Config.php';
require_once __DIR__ . '/Response.php';
require_once __DIR__ . '/Security.php';
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Validator.php';
require_once __DIR__ . '/RateLimiter.php';
require_once __DIR__ . '/Audit.php';
require_once __DIR__ . '/ApiKeyAuth.php';
require_once __DIR__ . '/Crud.php';

Config::load(__DIR__ . '/../.env');
date_default_timezone_set(Config::get('APP_TIMEZONE', 'America/Sao_Paulo'));

// Converter erros/warnings PHP em JSON 500 (sem vazar stack trace em producao)
set_error_handler(function (int $no, string $str, string $file, int $line): bool {
    error_log("[apiphp][{$no}] {$str} @ {$file}:{$line}");
    if (Config::isDebug()) {
        Response::error("Erro interno: {$str}", 500);
    }
    Response::error('Erro interno do servidor.', 500);
});

set_exception_handler(function (Throwable $e): void {
    error_log('[apiphp][exception] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    if ($e instanceof ValidationException) {
        Response::error('Erros de validacao.', 422, $e->errors);
    }
    if (Config::isDebug()) {
        Response::error('Erro interno: ' . $e->getMessage(), 500);
    }
    Response::error('Erro interno do servidor.', 500);
});

Security::sendHeaders();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

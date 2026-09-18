<?php
/**
 * Front controller da API v2 (apiphp).
 *
 * Uso: /apiphp/public/index.php?endpoint=impressoras&action=listar&page=1
 * Autenticacao: header `X-API-KEY: <chave>`
 *
 * Endpoints generico-CRUD (via src/modules.php):
 *   acessorios, ativos_diversos, empresas, fornecedores, funcionarios,
 *   impressoras, impressoras_modelos, monitores, nobreaks, setores,
 *   softwares, toners, ativos_tipos
 * Endpoints dedicados:
 *   health, dashboard_kpis, dashboard_alertas, dashboard_atividade, qrcode
 */
declare(strict_types=1);

require_once __DIR__ . '/../src/bootstrap.php';

$endpoint = preg_replace('/[^a-z0-9_]/', '', strtolower((string)($_GET['endpoint'] ?? '')));
$action   = (string)($_GET['action'] ?? ($_GET['acao'] ?? ''));
$method   = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// --- Health check: sem API key e sem forcar conexao com o BD ---
if ($endpoint === 'health') {
    Response::success(['api' => 'ativos2026/apiphp', 'status' => 'ok', 'db' => Database::ping() ? 'ok' : 'fail']);
}

if ($endpoint === '') {
    Response::error('Endpoint nao especificado. Use ?endpoint=<modulo>&action=<acao>.', 400);
}

// --- Autenticacao por API Key (obrigatoria para todo o resto) ---
$pdo = Database::pdo();

// --- Autenticacao por API Key (obrigatoria para todo o resto) ---
$keyRow = ApiKeyAuth::authenticate($pdo);
ApiKeyAuth::authorize($keyRow, $endpoint);

$input = Security::input();

// --- Modulos dedicados ---
try {
    switch ($endpoint) {
        case 'dashboard_kpis':
            require __DIR__ . '/../src/handlers/dashboard.php';
            Dashboard::kpis($pdo);

        case 'dashboard_alertas':
            require __DIR__ . '/../src/handlers/dashboard.php';
            Dashboard::alertas($pdo);

        case 'dashboard_atividade':
            require __DIR__ . '/../src/handlers/dashboard.php';
            Dashboard::atividade($pdo);

        case 'qrcode':
            require __DIR__ . '/../src/handlers/qrcode.php';
            Qrcode::handle($pdo, $action, $input);

        case 'api_keys':
            require __DIR__ . '/../src/handlers/api_keys_handler.php';
            ApiKeysHandler::handle($pdo, $action, $input);

        case 'configuracoes':
            require __DIR__ . '/../src/handlers/configuracoes.php';
            ConfiguracoesHandler::handle($pdo, $action, $input);

        default:
            // --- Modulos genericos via registry ---
            $modules = require __DIR__ . '/../src/modules.php';
            if (!isset($modules[$endpoint])) {
                Response::error("Endpoint '{$endpoint}' nao reconhecido.", 404);
            }
            $crud = new Crud($pdo, $modules[$endpoint], $endpoint);
            $crud->handle($action, $input);
    }
} catch (ValidationException $e) {
    throw $e;
} catch (PDOException $e) {
    error_log('[apiphp][pdo] ' . $e->getMessage());
    Response::error('Erro no banco de dados. Verifique os logs.', 500);
}

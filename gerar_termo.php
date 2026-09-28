<?php
/**
 * Gerador de Termos (.docx) — Celulares (ativos2026)
 *
 * Rota: ativos2026/gerar_termo.php
 *   ?tipo_ativo=celular
 *   &ativo_id=<id>
 *   &funcionario_id=<id>
 *   &tipo_termo=entrega|devolucao|dano
 *   &api_key=<chave>
 *
 * Autenticação por API Key (via query — aceitável pois gera download).
 * Templates reais copiados de core/termos/templates/ para templates/celulares/.
 * PhpWord carregado via vendor do projeto (vendor/phpoffice/phpword).
 */
declare(strict_types=1);

use PhpOffice\PhpWord\TemplateProcessor;

// --- Autoload do Composer (PhpWord) ---
$autoload_path = dirname(__DIR__, 2) . '/vendor/autoload.php';
if (!file_exists($autoload_path)) {
    http_response_code(500);
    header('Content-Type: text/html; charset=utf-8');
    echo '<h1>Erro: vendor/autoload.php não encontrado.</h1>';
    exit;
}
require_once $autoload_path;

// --- Carrega .env do apiphp ---
$envFile = __DIR__ . '/apiphp/.env';
function loadEnv(string $file): array {
    $data = [];
    if (!is_readable($file)) return $data;
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
        $key = trim($key); $value = trim($value);
        if (strlen($value) >= 2 && $value[0] === "'" && str_ends_with($value, "'")) {
            $value = substr($value, 1, -1);
        }
        $data[$key] = $value;
    }
    return $data;
}
$env = loadEnv($envFile);

// --- Conexão PDO (mesmo banco do apiphp) ---
$dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s',
    $env['DB_HOST'] ?? '127.0.0.1', $env['DB_PORT'] ?? '3306',
    $env['DB_NAME'] ?? 'inventario2', $env['DB_CHARSET'] ?? 'utf8mb4');
try {
    $pdo = new PDO($dsn, $env['DB_USER'] ?? 'root', $env['DB_PASS'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: text/html; charset=utf-8');
        echo '<h1>Erro de conexão com o banco.</h1>';
    exit;
}

// --- Autenticação por API Key ---
$apiKey = $_GET['api_key'] ?? $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($apiKey === '') {
    http_response_code(401);
    header('Content-Type: text/html; charset=utf-8');
    echo '<h1>Acesso não autorizado.</h1><p>API Key ausente.</p>';
    exit;
}

$prefix = substr($apiKey, 0, 8);
$stmt = $pdo->prepare(
    'SELECT id, nome, key_hash, scopes, ativo, expira_em
       FROM api_keys WHERE key_prefix = :prefix LIMIT 1'
);
$stmt->execute([':prefix' => $prefix]);
$keyRow = $stmt->fetch();

if (!$keyRow || (int)$keyRow['ativo'] !== 1) {
    http_response_code(401);
    echo '<h1>Acesso não autorizado: API Key inválida ou revogada.</h1>';
    exit;
}
$hash = hash('sha256', $apiKey);
if (!hash_equals((string)$keyRow['key_hash'], $hash)) {
    http_response_code(401);
    echo '<h1>Acesso não autorizado: API Key inválida.</h1>';
    exit;
}

$scopes = array_map('trim', explode(',', (string)$keyRow['scopes']));
if (!in_array('*', $scopes, true) && !in_array('celulares', $scopes, true) && !in_array('termo_antigo', $scopes, true)) {
    http_response_code(403);
    echo '<h1>Acesso negado: escopo insuficiente.</h1>';
    exit;
}

// --- Validar parâmetros ---
$tipo_ativo     = $_GET['tipo_ativo'] ?? '';
$ativo_id       = (int)($_GET['ativo_id'] ?? 0);
$funcionario_id = (int)($_GET['funcionario_id'] ?? 0);
$tipo_termo     = $_GET['tipo_termo'] ?? '';

if (empty($tipo_ativo) || $ativo_id === 0 || $funcionario_id === 0 || empty($tipo_termo)) {
    http_response_code(400);
    header('Content-Type: text/html; charset=utf-8');
    echo '<h1>Parâmetros inválidos.</h1>';
    exit;
}


// --- Formatar data por extenso em português ---
function formatarDataPortugues(?string $data): string {
    if (!$data) return 'N/A';
    $timestamp = strtotime($data);
    if ($timestamp === false) return 'N/A';
    $dias_semana = [
        'Sunday' => 'Domingo', 'Monday' => 'Segunda-feira', 'Tuesday' => 'Terça-feira',
        'Wednesday' => 'Quarta-feira', 'Thursday' => 'Quinta-feira', 'Friday' => 'Sexta-feira', 'Saturday' => 'Sábado'
    ];
    $meses = [
        '01' => 'Janeiro', '02' => 'Fevereiro', '03' => 'Março', '04' => 'Abril',
        '05' => 'Maio', '06' => 'Junho', '07' => 'Julho', '08' => 'Agosto',
        '09' => 'Setembro', '10' => 'Outubro', '11' => 'Novembro', '12' => 'Dezembro'
    ];
    $dia_extenso = $dias_semana[date('l', $timestamp)] ?? '';
    $dia_num = date('d', $timestamp);
    $mes_extenso = $meses[date('m', $timestamp)] ?? '';
    $ano = date('Y', $timestamp);
        return trim("{$dia_extenso}, {$dia_num} de {$mes_extenso} de {$ano}");
}

try {
    $temp_dir = sys_get_temp_dir();
    if (!is_dir($temp_dir) || !@is_writable($temp_dir)) {
        $temp_alt = __DIR__ . '/apiphp/storage/uploads';
        if (!is_dir($temp_alt)) { @mkdir($temp_alt, 0755, true); }
        $temp_dir = (is_dir($temp_alt) && @is_writable($temp_alt)) ? $temp_alt : throw new RuntimeException('Nenhum diretório temporário gravável.');
    }

    $sql_funcionario = "SELECT nome, cargo, rg FROM funcionarios WHERE id = :id";
    $stmt_funcionario = $pdo->prepare($sql_funcionario);
    $stmt_funcionario->execute([':id' => $funcionario_id]);
    $funcionario = $stmt_funcionario->fetch();
    if (!$funcionario) {
                throw new InvalidArgumentException('Funcionário não encontrado.');
    }

    $dados_ativo = [];
    $template_path = '';
    $placeholders = [];
    $data_formatada = 'Não aplicável';

    switch ($tipo_ativo) {
        case 'celular':
            $stmt = $pdo->prepare("SELECT id, marca, modelo, imei, serial, numero FROM celulares WHERE id = :id");
            $stmt->execute([':id' => $ativo_id]);
            $dados_ativo = $stmt->fetch();
            if (!$dados_ativo) { throw new InvalidArgumentException('Celular não encontrado.'); }

            $template_path = __DIR__ . "/templates/celulares/termo_{$tipo_termo}_celular.docx";
            $placeholders = [
                'celular_id'     => $dados_ativo['id'],
                'celular_marca'  => $dados_ativo['marca'],
                'celular_modelo' => $dados_ativo['modelo'],
                'celular_imei'   => $dados_ativo['imei'],
                'celular_serial' => $dados_ativo['serial'],
                'celular_numero' => $dados_ativo['numero'] ?? 'N/A',
            ];

            if ($tipo_termo === 'entrega') {
                $sql_assoc = "SELECT data_entrega FROM celulares_funcionarios
                              WHERE celular_id = :ativo_id AND usuario_id = :funcionario_id AND data_desassociacao IS NULL
                              ORDER BY data_associacao DESC LIMIT 1";
                $stmt_assoc = $pdo->prepare($sql_assoc);
                $stmt_assoc->execute([':ativo_id' => $ativo_id, ':funcionario_id' => $funcionario_id]);
                $assoc_result = $stmt_assoc->fetch();
                if ($assoc_result) {
                    $data_formatada = formatarDataPortugues($assoc_result['data_entrega']);
                }
            } elseif ($tipo_termo === 'devolucao') {
                $sql_assoc = "SELECT cf.data_desassociacao, d.descricao as danos
                              FROM celulares_funcionarios cf
                              LEFT JOIN danos d ON d.celular_id = cf.celular_id AND DATE(d.data_dano) = DATE(cf.data_desassociacao)
                              WHERE cf.celular_id = :ativo_id AND cf.usuario_id = :funcionario_id AND cf.data_desassociacao IS NOT NULL
                              ORDER BY cf.data_desassociacao DESC LIMIT 1";
                $stmt_assoc = $pdo->prepare($sql_assoc);
                $stmt_assoc->execute([':ativo_id' => $ativo_id, ':funcionario_id' => $funcionario_id]);
                $assoc_result = $stmt_assoc->fetch();
                if ($assoc_result) {
                    $data_formatada = formatarDataPortugues($assoc_result['data_desassociacao']);
                    $placeholders['danos_devolucao'] = htmlspecialchars($assoc_result['danos'] ?? 'Nenhum');
                    $placeholders['observacoes'] = '';
                    $placeholders['recebedor_nome'] = 'Responsável';
                    $placeholders['recebedor_cargo'] = '';
                }
            } elseif ($tipo_termo === 'dano') {
                $data_formatada = formatarDataPortugues(date('Y-m-d'));
                $placeholders['danos_relatados'] = '';
            } else {
                throw new InvalidArgumentException('Tipo de termo inválido.');
            }
            break;
                default:
            throw new InvalidArgumentException('Tipo de ativo não suportado.');
    }

    if (empty($template_path) || !file_exists($template_path)) {
        throw new RuntimeException('Template não encontrado: ' . $template_path);
    }
    if (!is_readable($template_path)) {
        throw new RuntimeException('Template sem permissão de leitura.');
    }

    $templateProcessor = new TemplateProcessor($template_path);

    foreach ($placeholders as $key => $value) {
        $templateProcessor->setValue($key, htmlspecialchars($value ?? '', ENT_QUOTES, 'UTF-8'));
    }

    $templateProcessor->setValue('funcionario_nome', htmlspecialchars($funcionario['nome'] ?? '', ENT_QUOTES, 'UTF-8'));
    $templateProcessor->setValue('funcionario_cargo', htmlspecialchars($funcionario['cargo'] ?? '', ENT_QUOTES, 'UTF-8'));
    $templateProcessor->setValue('funcionario_rg', htmlspecialchars($funcionario['rg'] ?? '', ENT_QUOTES, 'UTF-8'));

    if ($tipo_termo === 'entrega') {
        $templateProcessor->setValue('data_entrega', $data_formatada);
    } elseif ($tipo_termo === 'devolucao') {
        $templateProcessor->setValue('data_desassociacao', $data_formatada);
        $templateProcessor->setValue('data_dano', $data_formatada);
    } elseif ($tipo_termo === 'dano') {
        $templateProcessor->setValue('data_dano', $data_formatada);
    }

    $nome_func = preg_replace('/[^A-Za-z0-9_]/', '_', (string)$funcionario['nome']);
    $filename = "Termo_{$tipo_termo}_{$tipo_ativo}_{$nome_func}_" . date('Y-m-d') . ".docx";
    $temp_file_path = rtrim($temp_dir, '/\\') . DIRECTORY_SEPARATOR . uniqid('termo_') . '_' . $filename;

    $templateProcessor->saveAs($temp_file_path);
    if (!file_exists($temp_file_path) || filesize($temp_file_path) === 0) {
        throw new RuntimeException('Falha ao gravar o documento temporário.');
    }

    header("Content-Description: File Transfer");
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    header('Content-Transfer-Encoding: binary');
    header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
    header('Expires: 0');
    header('Content-Length: ' . filesize($temp_file_path));
    readfile($temp_file_path);
    @unlink($temp_file_path);
    exit;

} catch (Throwable $e) {
    error_log('[gerar_termo] ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: text/html; charset=utf-8');
    echo '<h1>Erro ao gerar termo</h1><p>' . htmlspecialchars($e->getMessage()) . '</p>';
}

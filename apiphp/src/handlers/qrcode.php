<?php
/**
 * Qrcode — Portado do legado qrcode_handler.php (que ja usava API Key).
 * Acoes: get_ativos_por_tipo (GET), buscar codigo direto (?codigo=),
 *        gerar_qrcodes (POST, exige ext-gd ou lib composer — ver docs).
 */
declare(strict_types=1);

final class Qrcode
{
    private const MAP = [
        'monitores'   => ['monitores', 'codigo_interno_monitor'],
        'estacoes'    => ['estacoes', 'codigo_interno_estacao'],
        'impressoras' => ['impressoras', 'codigo_interno_impressora'],
        'nobreaks'    => ['nobreaks', 'codigo_interno_nobreak'],
    ];

    public static function handle(PDO $pdo, string $action, array $input): never
    {
        // Consulta direta por codigo (scanner QR)
        if (!empty($input['codigo'])) {
            self::buscarPorCodigo($pdo, (string)$input['codigo']);
        }

        switch ($action) {
            case 'get_ativos_por_tipo':
                self::ativosPorTipo($pdo, (string)($input['tipo_ativo'] ?? ''));
            case 'gerar_qrcodes':
                if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
                    Response::error('Metodo invalido para gerar_qrcodes. Use POST.', 405);
                }
                self::gerar($pdo, (string)($input['tipo_ativo'] ?? ''), (string)($input['ativos'] ?? ''));
            default:
                Response::error('Acao invalida ou nao especificada.', 400);
        }
    }

    private static function ativosPorTipo(PDO $pdo, string $tipo): never
    {
        if (!isset(self::MAP[$tipo])) {
            Response::error('Tipo de ativo invalido.', 400);
        }
        [$table, $codeCol] = self::MAP[$tipo];
        $stmt = $pdo->prepare("SELECT id, {$codeCol} AS codigo_interno FROM {$table} ORDER BY id");
        $stmt->execute();
        Response::success($stmt->fetchAll());
    }

    private static function buscarPorCodigo(PDO $pdo, string $codigo): never
    {
        foreach (self::MAP as $tipo => [$table, $codeCol]) {
            $stmt = $pdo->prepare("SELECT id, {$codeCol} AS codigo FROM {$table} WHERE {$codeCol} = :c LIMIT 1");
            $stmt->execute([':c' => $codigo]);
            if ($row = $stmt->fetch()) {
                Response::success(['tipo' => $tipo] + $row);
            }
        }
        Response::error('Nenhum ativo encontrado com este codigo.', 404);
    }

    private static function gerar(PDO $pdo, string $tipo, string $ativosCsv): never
    {
        if (!isset(self::MAP[$tipo])) {
            Response::error('Tipo de ativo invalido.', 400);
        }
        [$table, $codeCol] = self::MAP[$tipo];
        $ids = array_filter(array_map('intval', explode(',', $ativosCsv)));
        if (!$ids) {
            Response::error('Nenhum ativo selecionado.', 400);
        }
        $in = implode(',', $ids);
        $stmt = $pdo->prepare("SELECT id, {$codeCol} AS codigo FROM {$table} WHERE id IN ({$in})");
        $stmt->execute();
        $ativos = $stmt->fetchAll();
        if (!$ativos) {
            Response::error('Nenhum ativo encontrado com os IDs fornecidos.', 404);
        }

        // Geracao de imagem requer endroid/qr-code (composer require endroid/qr-code).
        // Sem a lib, retorna a lista de codigos para o cliente gerar localmente.
        if (!class_exists(\Endroid\QrCode\QrCode::class)) {
            Response::success(
                ['gerado' => false, 'motivo' => 'lib endroid/qr-code ausente', 'codigos' => array_column($ativos, 'codigo')],
                'Codigos retornados sem geracao de imagem (instale endroid/qr-code).'
            );
        }

        $writer = new \Endroid\QrCode\Writer\PngWriter();
        $gerados = [];
        foreach ($ativos as $a) {
            $qr = new \Endroid\QrCode\QrCode(data: (string)$a['codigo'], size: 300, margin: 10);
            $gerados[] = ['id' => $a['id'], 'codigo' => $a['codigo'], 'data_uri' => $writer->write($qr)->getDataUri()];
        }
        Response::success(['gerado' => true, 'itens' => $gerados], 'QR Codes gerados com sucesso.');
    }
}

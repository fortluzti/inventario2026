<?php
/**
 * Validação SOMENTE LEITURA do relatório de conferência de celulares.
 *
 * Executa a própria ação `celulares/conferencia_dados` (mesmo handler usado pela API)
 * em subprocessos, contra o banco configurado em .env, e imprime as checagens.
 *
 * Uso:
 *   php validar_conferencia_celulares.php                  -> checagens + resumo da auditoria
 *   php validar_conferencia_celulares.php --dump "page=1"  -> imprime o JSON bruto (uso interno)
 *
 * Nada é gravado/alterado no banco.
 */
declare(strict_types=1);
require_once __DIR__ . '/../src/bootstrap.php';

/* ---------- Modo dump: executa o handler real e imprime o JSON (subprocesso) ---------- */
$modoDump = null;
$payload = '';
foreach ($argv ?? [] as $i => $arg) {
    if ($arg === '--dump' || $arg === '--dump-json') {
        $modoDump = $arg;
        $payload = (string)($argv[$i + 1] ?? '');
    }
}

if ($modoDump !== null) {
    require_once __DIR__ . '/../src/handlers/celulares_handler.php';

    if ($modoDump === '--dump-json') {
        // JSON em base64: imune ao escapeshellarg() do Windows (que troca % por espaço).
        $input = json_decode((string)base64_decode($payload, true), true) ?: [];
    } else {
        $input = [];
        if ($payload !== '') {
            parse_str($payload, $input);
        }
    }
    CelularesHandler::handle(Database::pdo(), 'conferencia_dados', $input);
}

/* ---------- Modo validação: chama o handler em subprocessos e confere ---------- */
$falhas = 0;
$check = static function (string $nome, bool $cond, string $detalhe = '') use (&$falhas): void {
    if (!$cond) {
        $falhas++;
    }
    echo ($cond ? 'OK   ' : 'FALHA') . '  ' . $nome . ($detalhe !== '' ? "  [{$detalhe}]" : '') . PHP_EOL;
};

$chamar = static function (array $params): array {
    // Parâmetros em base64(JSON): escapeshellarg() do Windows troca '%' por espaço.
    $cmd = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__) . ' --dump-json '
        . escapeshellarg(base64_encode((string)json_encode($params)));
    $out = (string)shell_exec($cmd);
    $json = json_decode($out, true);
    if (!is_array($json)) {
        throw new RuntimeException('Resposta invalida do handler: ' . substr($out, 0, 400));
    }
    if (empty($json['success'])) {
        throw new RuntimeException('Handler retornou erro: ' . ($json['message'] ?? '?'));
    }
    return $json['data'];
};

try {
    $tudo = $chamar(['todos' => 1]);
    $check('handler responde com items/total/resumo', isset($tudo['items'], $tudo['total'], $tudo['resumo']));
    $check('consulta é somente leitura (flag)', ($tudo['somente_leitura'] ?? false) === true);
    $check('fontes de dados documentadas', !empty($tudo['fontes']['numero'])
        && !empty($tudo['fontes']['gmail']) && !empty($tudo['fontes']['email_corporativo']));
    $check('limitações do modelo documentadas', count($tudo['limitacoes'] ?? []) >= 3);
    $check('todos=1 devolve o conjunto completo', count($tudo['items']) === $tudo['total'] && $tudo['total'] > 0,
        'total=' . $tudo['total']);

    // ---- Colunas exigidas + presença real de cada tipo de dado ----
    $chaves = ['codigo', 'numero', 'gmail', 'email_corporativo', 'funcionario', 'funcionario_status',
        'celular_status', 'data_inicio', 'data_fim', 'associacao', 'situacoes', 'observacoes'];
    $faltando = [];
    $temAtivo = $temInativo = $temNumero = $temGmail = $temEmail = false;
    $temHistorico = $temSemAssociacao = false;
    foreach ($tudo['items'] as $item) {
        foreach ($chaves as $k) {
            if (!array_key_exists($k, $item)) { $faltando[$k] = true; }
        }
        if ((int)$item['funcionario_ativo'] === 1) { $temAtivo = true; }
        if ((int)$item['funcionario_ativo'] === 0) { $temInativo = true; }
        if (trim((string)$item['numero']) !== '') { $temNumero = true; }
        if (trim((string)$item['gmail']) !== '') { $temGmail = true; }
        if (trim((string)$item['email_corporativo']) !== '') { $temEmail = true; }
        if ($item['associacao'] === 'Histórica') { $temHistorico = true; }
        if ($item['associacao'] === null) { $temSemAssociacao = true; }
    }
    $check('grid traz todas as colunas exigidas', $faltando === [], implode(',', array_keys($faltando)));
    $check('funcionários ativos aparecem', $temAtivo);
    $check('funcionários inativos aparecem', $temInativo);
    $check('números aparecem', $temNumero);
    $check('Gmail aparece', $temGmail);
    $check('e-mail corporativo aparece', $temEmail);
    $check('histórico (associação encerrada) aparece', $temHistorico);
    $check('celular sem associação aparece (histórico não é escondido)', $temSemAssociacao);

    // ---- Filtros ----
    $inativos = $chamar(['status_funcionario' => 'inativos', 'todos' => 1]);
    $soInativos = array_filter($inativos['items'], static fn(array $i): bool => (int)$i['funcionario_ativo'] !== 0);
    $check('filtro status_funcionario=inativos', $soInativos === [] && $inativos['total'] > 0, 'total=' . $inativos['total']);

    $ativos = $chamar(['status_funcionario' => 'ativos', 'todos' => 1]);
    $soAtivos = array_filter($ativos['items'], static fn(array $i): bool => (int)$i['funcionario_ativo'] !== 1);
    $check('filtro status_funcionario=ativos', $soAtivos === [] && $ativos['total'] > 0, 'total=' . $ativos['total']);

    $status = $tudo['opcoes']['status_celular'] ?? [];
    $check('opções de status do celular vêm dos dados reais', $status !== [], implode(' | ', $status));
    if ($status !== []) {
        $porStatus = $chamar(['status_celular' => $status[0], 'todos' => 1]);
        $errados = array_filter($porStatus['items'], static fn(array $i): bool => $i['celular_status'] !== $status[0]);
        $check('filtro status_celular=' . $status[0], $errados === [] && $porStatus['total'] > 0, 'total=' . $porStatus['total']);
    }

    $comInc = $chamar(['situacao' => 'inconsistencia', 'todos' => 1]);
    $semFlag = array_filter($comInc['items'], static fn(array $i): bool => $i['situacoes'] === []);
    $check('filtro situacao=inconsistencia', $semFlag === [], 'total=' . $comInc['total']);
    $check('inconsistências identificadas nos dados reais', $comInc['total'] > 0, 'total=' . $comInc['total']);

    $ok = $chamar(['situacao' => 'ok', 'todos' => 1]);
    $comFlag = array_filter($ok['items'], static fn(array $i): bool => $i['situacoes'] !== []);
    $check('filtro situacao=ok', $comFlag === [], 'total=' . $ok['total']);
    $check('resumo bate com as listagens', $comInc['total'] + $ok['total'] === $tudo['total']);

    // Cada regra (inconsistência e observação): rótulo em PHP e filtro SQL coerentes.
    foreach ($tudo['regras'] as $regra) {
        $codigo = (string)$regra['codigo'];
        $chave  = $regra['tipo'] === 'inconsistencia' ? 'situacoes' : 'observacoes';
        $porCodigo = $chamar(['situacao_codigo' => $codigo, 'todos' => 1]);
        $divergentes = array_filter($porCodigo['items'], static function (array $i) use ($codigo, $chave): bool {
            return !in_array($codigo, array_column($i[$chave], 'codigo'), true);
        });
        $esperado = $tudo['resumo'][$regra['tipo'] === 'inconsistencia' ? 'por_inconsistencia' : 'por_observacao'][$codigo] ?? 0;
        $check("regra {$codigo} (filtro x rótulo)", $divergentes === [] && $porCodigo['total'] === $esperado,
            "total={$porCodigo['total']} resumo={$esperado}");
    }

    $atual = $chamar(['associacao' => 'atual', 'todos' => 1]);
    $soAtual = array_filter($atual['items'], static fn(array $i): bool => $i['associacao'] !== 'Atual');
    $check('filtro associacao=atual', $soAtual === [] && $atual['total'] > 0, 'total=' . $atual['total']);

    $hist = $chamar(['associacao' => 'historica', 'todos' => 1]);
    $soHist = array_filter($hist['items'], static fn(array $i): bool => $i['associacao'] !== 'Histórica');
    $check('filtro associacao=historica', $soHist === [] && $hist['total'] > 0, 'total=' . $hist['total']);

    $semAssoc = $chamar(['associacao' => 'sem_associacao', 'todos' => 1]);
    $comAssoc = array_filter($semAssoc['items'], static fn(array $i): bool => $i['associacao'] !== null);
    $check('filtro associacao=sem_associacao', $comAssoc === [] && $semAssoc['total'] > 0, 'total=' . $semAssoc['total']);

    // ---- Pesquisa (número, Gmail, e-mail corporativo, funcionário, código) ----
    $alvo = '';
    foreach ($tudo['items'] as $item) {
        if (trim((string)$item['numero']) !== '') { $alvo = (string)$item['numero']; break; }
    }
    if ($alvo !== '') {
        $busca = $chamar(['search' => $alvo, 'todos' => 1]);
        $check('pesquisa por número', $busca['total'] > 0 && $busca['total'] < $tudo['total'], 'total=' . $busca['total']);
    }
    $porGmail = $chamar(['search' => 'gmail.com', 'todos' => 1]);
    $check('pesquisa por Gmail', $porGmail['total'] > 0, 'total=' . $porGmail['total']);
    $porEmail = $chamar(['search' => 'fortluz.com.br', 'todos' => 1]);
    $check('pesquisa por e-mail corporativo', $porEmail['total'] > 0, 'total=' . $porEmail['total']);
    $porFuncionario = $chamar(['search' => 'RAFAEL', 'todos' => 1]);
    $check('pesquisa por funcionário', $porFuncionario['total'] > 0, 'total=' . $porFuncionario['total']);
    $porCodigo = $chamar(['search' => 'CEL-0', 'todos' => 1]);
    $check('pesquisa por código do celular', $porCodigo['total'] > 0, 'total=' . $porCodigo['total']);

    // ---- Paginação ----
    $pag1 = $chamar(['page' => 1, 'limit' => 5]);
    $pag2 = $chamar(['page' => 2, 'limit' => 5]);
    $check('paginação limit=5 devolve 5 itens', count($pag1['items']) === 5, 'itens=' . count($pag1['items']));
    $check('paginação calcula total_pages', $pag1['total_pages'] === (int)ceil($pag1['total'] / 5), 'total_pages=' . $pag1['total_pages']);
    $idsPag1 = array_map(static fn(array $i): string => $i['codigo'] . '#' . ($i['associacao_id'] ?? 'sem'), $pag1['items']);
    $idsPag2 = array_map(static fn(array $i): string => $i['codigo'] . '#' . ($i['associacao_id'] ?? 'sem'), $pag2['items']);
    $check('páginas não repetem registros', array_intersect($idsPag1, $idsPag2) === []);
    $check('total não muda com a página', $pag1['total'] === $pag2['total'] && $pag1['total'] === $tudo['total']);

    // ---- Ordenação (cabeçalho: ↑ asc / ↓ desc) combinada com filtros ----
    foreach ([['numero', 'asc'], ['numero', 'desc'], ['codigo', 'asc'], ['situacao', 'desc'], ['inicio', 'desc']] as [$campo, $dir]) {
        $ord = $chamar(['sort' => $campo, 'dir' => $dir, 'todos' => 1]);
        $check("ordenação aceita sort={$campo}&dir={$dir}", $ord['total'] > 0 && $ord['items'] !== []);
    }
    $asc = $chamar(['sort' => 'codigo', 'dir' => 'asc', 'todos' => 1]);
    $codigos = array_map(static fn(array $i): string => (string)$i['codigo'], $asc['items']);
    $ordenado = $codigos;
    sort($ordenado, SORT_STRING);
    $check('ordenação ASC por código', $codigos === $ordenado);
    $desc = $chamar(['sort' => 'codigo', 'dir' => 'desc', 'todos' => 1]);
    $codigosDesc = array_map(static fn(array $i): string => (string)$i['codigo'], $desc['items']);
    $invertido = $codigosDesc;
    rsort($invertido, SORT_STRING);
    $check('ordenação DESC por código', $codigosDesc === $invertido);

    $porSituacao = $chamar(['sort' => 'situacao', 'dir' => 'desc', 'todos' => 1]);
    $qtd = array_map(static fn(array $i): int => count($i['situacoes']), $porSituacao['items']);
    $qtdDesc = $qtd;
    rsort($qtdDesc);
    $check('ordenação por situação (inconsistências primeiro)', $qtd === $qtdDesc, 'primeiras=' . implode(',', array_slice($qtd, 0, 8)));

    $combinado = $chamar(['sort' => 'numero', 'dir' => 'asc', 'status_funcionario' => 'inativos', 'page' => 1, 'limit' => 10]);
    $checagem = array_filter($combinado['items'], static fn(array $i): bool => (int)$i['funcionario_ativo'] !== 0);
    $check('ordenação + filtro + paginação juntos', $checagem === [] && count($combinado['items']) > 0,
        'total=' . $combinado['total']);

    // ---- Integridade do histórico antigo (conferência, sem alterar nada) ----
    $pdo = Database::pdo();
    $orfaos = (int)$pdo->query('SELECT COUNT(*) FROM historico_uso hu
        LEFT JOIN celulares_funcionarios cf
               ON cf.celular_id = hu.celular_id AND cf.usuario_id = hu.usuario_id
        WHERE cf.id IS NULL')->fetchColumn();
    $check('termos de historico_uso têm associação correspondente em celulares_funcionarios', $orfaos === 0, "orfaos={$orfaos}");

    // ---- Resumo da auditoria (o que o relatório deve mostrar) ----
    $resumo = $tudo['resumo'];
    echo PHP_EOL . '--- AUDITORIA (somente leitura) ---' . PHP_EOL;
    echo 'INFO  escopo: ' . json_encode($resumo['escopo'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    echo "INFO  registros na conferência: {$resumo['total']} | OK: {$resumo['ok']} | com inconsistência: {$resumo['com_inconsistencia']}" . PHP_EOL;
    echo 'INFO  inconsistências por tipo: ' . json_encode($resumo['por_inconsistencia'], JSON_UNESCAPED_UNICODE) . PHP_EOL;
    echo 'INFO  observações por tipo: ' . json_encode($resumo['por_observacao'], JSON_UNESCAPED_UNICODE) . PHP_EOL;

    if ($falhas > 0) {
        fwrite(STDERR, "FALHAS: {$falhas}" . PHP_EOL);
        exit(1);
    }
    echo PHP_EOL . 'Todas as checagens da conferência de celulares passaram.' . PHP_EOL;
} catch (Throwable $e) {
    fwrite(STDERR, 'FALHA: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

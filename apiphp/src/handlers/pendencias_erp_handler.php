<?php
/**
 * Pendencias do ERP - CRUD com fluxo controlado de atendimentos/status.
 */
declare(strict_types=1);

require_once __DIR__ . '/../Crud.php';

final class PendenciasErpHandler
{
    /**
     * Status oficiais do fluxo (migracao 016).
     * 'Aguardando suporte' -> pendencia aberta / aguardando o suporte.
     * 'Aguardando testes'  -> suporte respondeu/corrigiu; aguarda teste interno.
     * 'Resolvido'          -> somente teste interno aprovado.
     * 'Cancelado'          -> preservado (ja existia).
     */
    private const FLUXO_STATUS = [
        'Aguardando suporte',
        'Aguardando testes',
        'Resolvido',
        'Cancelado',
    ];

    /** Toda nova pendencia nasce aguardando o suporte. */
    private const STATUS_INICIAL = 'Aguardando suporte';

    private const TIPOS_ATENDIMENTO = [
        'Envio ao suporte',
        'Retorno do suporte',
        'Correção/atualização',
        'Teste',
        'Observação',
    ];

    /**
     * Status antigos (antes da migracao 016) -> status oficial vigente.
     * Usado para preservar compatibilidade com registros/historicos antigos;
     * nunca grava os valores legados.
     */
    private const LEGACY_STATUS = [
        'Pendente' => 'Aguardando suporte',
        'Enviado ao suporte' => 'Aguardando suporte',
        'Em análise' => 'Aguardando suporte',
        'Em Análise' => 'Aguardando suporte',
        'Aguardando correção/atualização' => 'Aguardando suporte',
        'Aguardando Suporte' => 'Aguardando suporte',
        'Pronto para testes' => 'Aguardando testes',
        'Em teste' => 'Aguardando testes',
        'Testando' => 'Aguardando testes',
        'Aguardando Testes' => 'Aguardando testes',
    ];

    public static function handle(PDO $pdo, string $action, array $input): never
    {
        $modules = require __DIR__ . '/../modules.php';
        $crud = new Crud($pdo, $modules['pendencias_erp'], 'pendencias_erp');

        $action = match ($action) {
            'salvar_pendencia', 'salvar' => 'salvar',
            'registrar_atendimento', 'registrarAtendimento' => 'registrar_atendimento',
            'registrar_teste', 'registrarTeste' => 'registrar_teste',
            'upload_evidencia', 'uploadEvidencia' => 'upload_evidencia',
            default => $action,
        };

        match ($action) {
            'salvar' => self::salvar($pdo, $modules['pendencias_erp'], $input),
            'registrar_atendimento' => self::registrarAtendimento($pdo, $input),
            'registrar_teste' => self::registrarTeste($pdo, $input),
            'upload_evidencia' => self::uploadEvidencia($pdo),
            default => $crud->handle($action, $input),
        };
    }

    private static function salvar(PDO $pdo, array $mod, array $input): never
    {
        $id = (int)($input['id'] ?? 0);

        if ($id > 0) {
            $atual = self::buscarPendencia($pdo, $id);
            $statusAtual = self::normalizarStatus((string)$atual['status']);
            $statusInput = array_key_exists('status', $input)
                ? self::normalizarStatus((string)$input['status'])
                : $statusAtual;

            if ($statusInput !== $statusAtual) {
                Response::error(
                    'O status da pendencia deve ser alterado pela acao Registrar atendimento.',
                    409
                );
            }
            $input['status'] = $statusAtual;
        } else {
            $statusInput = array_key_exists('status', $input)
                ? self::normalizarStatus((string)$input['status'])
                : self::STATUS_INICIAL;
            if ($statusInput !== self::STATUS_INICIAL) {
                Response::error('Nova pendencia deve iniciar com status Aguardando suporte.', 409);
            }
            $input['status'] = self::STATUS_INICIAL;
        }

        $crud = new Crud($pdo, $mod, 'pendencias_erp');
        $crud->salvar($input);
    }

    private static function registrarAtendimento(PDO $pdo, array $input): never
    {
        $pendenciaId = (int)($input['pendencia_id'] ?? 0);
        if ($pendenciaId <= 0) {
            Response::error('Pendencia invalida para atendimento.', 400);
        }

        $tipo = trim((string)($input['tipo_atendimento'] ?? ''));
        if (!in_array($tipo, self::TIPOS_ATENDIMENTO, true)) {
            Response::error('Tipo de atendimento invalido para o fluxo.', 400);
        }
        // O teste da correcao tem acao/modal proprio ("Testar correção") e so
        // pode ser registrado com status 'Aguardando testes'. Aqui ele e
        // bloqueado para impedir que "Responder" finalize a pendencia.
        if ($tipo === 'Teste') {
            Response::error('Use a acao Testar correção para registrar o teste da correcao.', 400);
        }

        $metodo = trim((string)($input['metodo_envio'] ?? ''));
        $metodos = ['E-mail', 'WhatsApp', 'Portal do Suporte', 'Telefone', 'Outro'];
        if (!in_array($metodo, $metodos, true)) {
            Response::error('Metodo de atendimento invalido.', 400);
        }

        $usuarioId = (int)($input['usuario_id'] ?? 0);
        if ($usuarioId <= 0) {
            Response::error('Usuario responsavel obrigatorio.', 400);
        }

        $observacoes = trim((string)($input['observacoes'] ?? ''));
        if ($observacoes === '') {
            Response::error('Conteudo da interacao obrigatorio.', 400);
        }

        $pdo->beginTransaction();
        try {
            $pendencia = self::buscarPendencia($pdo, $pendenciaId, true);
            $statusAnterior = self::normalizarStatus((string)$pendencia['status']);
            $statusNovo = array_key_exists('status_novo', $input)
                ? self::normalizarStatus((string)$input['status_novo'])
                : $statusAnterior;

            $erroTransicao = self::erroTransicao($tipo, $statusAnterior, $statusNovo);
            if ($erroTransicao !== null) {
                throw new InvalidArgumentException($erroTransicao);
            }

            $stmt = $pdo->prepare(
                'INSERT INTO atendimentos_erp (
                    pendencia_id, usuario_id, metodo_envio, tipo_atendimento, versao_sistema,
                    destinatario, contato, protocolo, status_anterior, status_novo,
                    observacoes, anexos_ids, data_cadastro, data_atualizacao
                 ) VALUES (
                    :pendencia_id, :usuario_id, :metodo_envio, :tipo_atendimento, :versao_sistema,
                    :destinatario, :contato, :protocolo, :status_anterior, :status_novo,
                    :observacoes, :anexos_ids, NOW(), NOW()
                 )'
            );
            $stmt->execute([
                ':pendencia_id' => $pendenciaId,
                ':usuario_id' => $usuarioId,
                ':metodo_envio' => $metodo,
                ':tipo_atendimento' => $tipo,
                ':versao_sistema' => self::nullableString($input['versao_sistema'] ?? null, 50),
                ':destinatario' => self::nullableString($input['destinatario'] ?? null, 200),
                ':contato' => self::nullableString($input['contato'] ?? null, 100),
                ':protocolo' => self::nullableString($input['protocolo'] ?? null, 100),
                ':status_anterior' => $statusAnterior,
                ':status_novo' => $statusNovo,
                ':observacoes' => mb_substr($observacoes, 0, 2000),
                ':anexos_ids' => self::nullableString($input['anexos_ids'] ?? null, 500),
            ]);
            $atendimentoId = (int)$pdo->lastInsertId();

            if ($statusNovo !== $statusAnterior) {
                $stmt = $pdo->prepare(
                    'UPDATE pendencias_erp
                        SET status = :status, usuario_id = :usuario_id,
                            ultimo_teste_reprovado = 0, data_atualizacao = NOW()
                      WHERE id = :id'
                );
                $stmt->execute([
                    ':status' => $statusNovo,
                    ':usuario_id' => $usuarioId,
                    ':id' => $pendenciaId,
                ]);
            }

            $pdo->commit();
            Audit::log($pdo, null, 'registrar_atendimento', 'pendencias_erp', $pendenciaId, []);
            Response::success(
                ['id' => $atendimentoId, 'pendencia_id' => $pendenciaId, 'status' => $statusNovo],
                'Atendimento registrado no historico.',
                201
            );
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($e instanceof InvalidArgumentException) {
                Response::error($e->getMessage(), 409);
            }
            throw $e;
        }
    }

    /**
     * Registra o teste da correcao no MESMO chamado (nunca cria outro chamado).
     *
     * Regras:
     *  - so e permitido com status 'Aguardando testes';
     *  - Aprovado  -> 'Aguardando testes' => 'Resolvido';
     *  - Reprovado -> 'Aguardando testes' => 'Aguardando suporte' (nova rodada);
     *  - Reprovado exige a secao "Problema encontrado na validacao" completa;
     *  - INSERT do teste + UPDATE do status acontecem na mesma transacao.
     */
    private static function registrarTeste(PDO $pdo, array $input): never
    {
        $pendenciaId = (int)($input['pendencia_id'] ?? 0);
        if ($pendenciaId <= 0) {
            Response::error('Pendencia invalida para o teste.', 400);
        }

        $resultado = trim((string)($input['resultado'] ?? ''));
        if (!in_array($resultado, ['Aprovado', 'Reprovado'], true)) {
            Response::error('Resultado do teste deve ser Aprovado ou Reprovado.', 400);
        }

        $usuarioId = (int)($input['usuario_id'] ?? 0);
        if ($usuarioId <= 0) {
            Response::error('Usuario responsavel obrigatorio.', 400);
        }

        $oque = trim((string)($input['oque_foi_testado'] ?? ''));
        if ($oque === '') {
            Response::error('Descreva o que foi testado.', 400);
        }

        $observacoes = trim((string)($input['observacoes'] ?? ''));
        $descricao   = trim((string)($input['descricao_detalhada'] ?? ''));
        $telaModulo  = trim((string)($input['tela_modulo'] ?? ''));
        $esperado    = trim((string)($input['comportamento_esperado'] ?? ''));
        $encontrado  = trim((string)($input['comportamento_encontrado'] ?? ''));

        // Reprovacao: secao obrigatoria (a evidencia e opcional: "quando disponivel").
        if ($resultado === 'Reprovado') {
            $erros = [];
            if ($descricao === '') {
                $erros['descricao_detalhada'] = ['Descreva detalhadamente o que deu errado.'];
            }
            if ($telaModulo === '') {
                $erros['tela_modulo'] = ['Informe a tela/modulo onde ocorreu o problema.'];
            }
            if ($esperado === '') {
                $erros['comportamento_esperado'] = ['Descreva o comportamento esperado.'];
            }
            if ($encontrado === '') {
                $erros['comportamento_encontrado'] = ['Descreva o comportamento encontrado.'];
            }
            if ($observacoes === '') {
                $erros['observacoes'] = ['Registre as observacoes do teste reprovado.'];
            }
            if ($erros !== []) {
                Response::error('Preencha a secao Problema encontrado na validacao.', 400, $erros);
            }
        }

        $pdo->beginTransaction();
        try {
            $pendencia = self::buscarPendencia($pdo, $pendenciaId, true);
            $statusAnterior = self::normalizarStatus((string)$pendencia['status']);
            if ($statusAnterior !== 'Aguardando testes') {
                throw new InvalidArgumentException(
                    'O teste so pode ser registrado com status Aguardando testes.'
                );
            }

            $statusNovo = $resultado === 'Aprovado' ? 'Resolvido' : 'Aguardando suporte';
            $erroTransicao = self::erroTransicao('Teste', $statusAnterior, $statusNovo);
            if ($erroTransicao !== null) {
                throw new InvalidArgumentException($erroTransicao);
            }

            // Evidencias precisam pertencer a esta mesma pendencia.
            $anexosIds = self::nullableString($input['anexos_ids'] ?? null, 500);
            if ($anexosIds !== null) {
                $ids = array_values(array_filter(array_map('intval', explode(',', $anexosIds))));
                if ($ids !== []) {
                    $ph = implode(',', array_fill(0, count($ids), '?'));
                    $stmt = $pdo->prepare(
                        "SELECT COUNT(*) FROM anexos_erp WHERE id IN ({$ph}) AND pendencia_id = ?"
                    );
                    $stmt->execute([...$ids, $pendenciaId]);
                    if ((int)$stmt->fetchColumn() !== count($ids)) {
                        throw new InvalidArgumentException(
                            'Evidencia anexada nao pertence a esta pendencia.'
                        );
                    }
                    $anexosIds = implode(',', $ids);
                } else {
                    $anexosIds = null;
                }
            }

            $stmt = $pdo->prepare(
                'INSERT INTO atendimentos_erp (
                    pendencia_id, usuario_id, metodo_envio, tipo_atendimento, versao_sistema,
                    resultado_teste, oque_foi_testado, descricao_detalhada, tela_modulo,
                    comportamento_esperado, comportamento_encontrado,
                    status_anterior, status_novo, observacoes, anexos_ids,
                    data_cadastro, data_atualizacao
                 ) VALUES (
                    :pendencia_id, :usuario_id, :metodo_envio, :tipo_atendimento, :versao_sistema,
                    :resultado_teste, :oque_foi_testado, :descricao_detalhada, :tela_modulo,
                    :comportamento_esperado, :comportamento_encontrado,
                    :status_anterior, :status_novo, :observacoes, :anexos_ids,
                    NOW(), NOW()
                 )'
            );
            $stmt->execute([
                ':pendencia_id' => $pendenciaId,
                ':usuario_id' => $usuarioId,
                // Teste interno: nao ha "metodo de envio"; 'Outro' apenas satisfaz
                // o ENUM obrigatorio da coluna.
                ':metodo_envio' => 'Outro',
                ':tipo_atendimento' => 'Teste',
                ':versao_sistema' => self::nullableString($input['versao_sistema'] ?? null, 50),
                ':resultado_teste' => $resultado,
                ':oque_foi_testado' => mb_substr($oque, 0, 60000),
                ':descricao_detalhada' => $descricao === '' ? null : mb_substr($descricao, 0, 60000),
                ':tela_modulo' => self::nullableString($telaModulo, 150),
                ':comportamento_esperado' => $esperado === '' ? null : mb_substr($esperado, 0, 60000),
                ':comportamento_encontrado' => $encontrado === '' ? null : mb_substr($encontrado, 0, 60000),
                ':status_anterior' => $statusAnterior,
                ':status_novo' => $statusNovo,
                ':observacoes' => $observacoes === '' ? null : mb_substr($observacoes, 0, 2000),
                ':anexos_ids' => $anexosIds,
            ]);
            $atendimentoId = (int)$pdo->lastInsertId();

            $stmt = $pdo->prepare(
                'UPDATE pendencias_erp
                    SET status = :status, usuario_id = :usuario_id,
                        ultimo_teste_reprovado = :reprovado, data_atualizacao = NOW()
                  WHERE id = :id'
            );
            $stmt->execute([
                ':status' => $statusNovo,
                ':usuario_id' => $usuarioId,
                ':reprovado' => $resultado === 'Reprovado' ? 1 : 0,
                ':id' => $pendenciaId,
            ]);

            $pdo->commit();
            Audit::log($pdo, null, 'registrar_teste', 'pendencias_erp', $pendenciaId, [
                'resultado' => $resultado,
                'status_novo' => $statusNovo,
            ]);
            Response::success(
                [
                    'id' => $atendimentoId,
                    'pendencia_id' => $pendenciaId,
                    'resultado' => $resultado,
                    'status' => $statusNovo,
                ],
                $resultado === 'Aprovado'
                    ? 'Teste aprovado. Pendencia resolvida.'
                    : 'Teste reprovado. Pendencia devolvida ao suporte.',
                201
            );
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($e instanceof InvalidArgumentException) {
                Response::error($e->getMessage(), 409);
            }
            throw $e;
        }
    }

    /**
     * Upload de evidencia (imagem/arquivo) vinculado a pendencia.
     * Mesmo padrao de ConfiguracoesHandler::uploadLogo (multipart + $_FILES);
     * os arquivos ficam em storage/uploads/evidencias (fora da web root).
     */
    private static function uploadEvidencia(PDO $pdo): never
    {
        if (!isset($_FILES['arquivo']) || ($_FILES['arquivo']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            Response::error('Arquivo de evidencia nao enviado ou erro no upload.', 400);
        }
        $arquivo = $_FILES['arquivo'];
        if ((int)$arquivo['size'] > 10 * 1024 * 1024) {
            Response::error('Evidencia acima do limite de 10 MB.', 400);
        }

        $pendenciaId = (int)($_POST['pendencia_id'] ?? 0);
        if ($pendenciaId <= 0) {
            Response::error('Pendencia invalida para anexar evidencia.', 400);
        }
        self::buscarPendencia($pdo, $pendenciaId);

        $usuarioId = (int)($_POST['usuario_id'] ?? 0) ?: null;

        if (class_exists('finfo', false)) {
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mime = (string)$finfo->file($arquivo['tmp_name']);
        } else {
            $mime = (string)($arquivo['type'] ?: 'application/octet-stream');
        }

        // Somente formatos seguros de evidencia (imagens, PDF e texto/log).
        $permitidos = [
            'image/png' => 'png', 'image/jpeg' => 'jpg', 'image/gif' => 'gif',
            'image/webp' => 'webp', 'image/bmp' => 'bmp', 'application/pdf' => 'pdf',
            'text/plain' => 'txt', 'text/csv' => 'csv', 'application/json' => 'txt',
        ];
        if (!isset($permitidos[$mime])) {
            Response::error('Formato de evidencia invalido. Use PNG, JPG, GIF, WEBP, PDF, TXT ou CSV.', 400);
        }
        $ext = $permitidos[$mime];

        $dir = __DIR__ . '/../../storage/uploads/evidencias';
        if (!is_dir($dir) && !@mkdir($dir, 0770, true) && !is_dir($dir)) {
            Response::error('Falha ao criar o diretorio de evidencias.', 500);
        }

        $nomeSeguro = 'evidencia_p' . $pendenciaId . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $dest = $dir . '/' . $nomeSeguro;
        if (!move_uploaded_file($arquivo['tmp_name'], $dest)) {
            Response::error('Falha ao salvar o arquivo de evidencia.', 500);
        }

        $nomeOriginal = basename((string)($arquivo['name'] ?? 'evidencia'));
        $nomeOriginal = mb_substr((string)preg_replace('/[\x00-\x1F"]+/', '', $nomeOriginal), 0, 255);
        if ($nomeOriginal === '') {
            $nomeOriginal = 'evidencia.' . $ext;
        }
        $caminho = '/storage/uploads/evidencias/' . $nomeSeguro;

        $stmt = $pdo->prepare(
            'INSERT INTO anexos_erp (
                pendencia_id, nome_arquivo, tipo_arquivo, caminho, tamanho_bytes,
                hash_sha256, usuario_id, enviado_ao_suporte, data_cadastro, data_atualizacao
             ) VALUES (
                :pendencia_id, :nome_arquivo, :tipo_arquivo, :caminho, :tamanho_bytes,
                :hash_sha256, :usuario_id, 0, NOW(), NOW()
             )'
        );
        $stmt->execute([
            ':pendencia_id' => $pendenciaId,
            ':nome_arquivo' => $nomeOriginal,
            ':tipo_arquivo' => strtoupper($ext),
            ':caminho' => $caminho,
            ':tamanho_bytes' => (int)$arquivo['size'],
            ':hash_sha256' => hash_file('sha256', $dest),
            ':usuario_id' => $usuarioId,
        ]);
        $anexoId = (int)$pdo->lastInsertId();

        Audit::log($pdo, null, 'upload_evidencia', 'pendencias_erp', $pendenciaId, [
            'anexo_id' => $anexoId,
            'arquivo' => $nomeOriginal,
        ]);
        Response::success(
            [
                'id' => $anexoId,
                'pendencia_id' => $pendenciaId,
                'nome_arquivo' => $nomeOriginal,
                'tipo_arquivo' => strtoupper($ext),
                'tamanho_bytes' => (int)$arquivo['size'],
            ],
            'Evidencia anexada com sucesso.',
            201
        );
    }

    private static function erroTransicao(string $tipo, string $anterior, string $novo): ?string
    {
        if (!in_array($anterior, self::FLUXO_STATUS, true)) {
            return "Status atual '{$anterior}' nao pertence ao fluxo vigente.";
        }

        if (!in_array($novo, self::FLUXO_STATUS, true)) {
            return "Status destino '{$novo}' nao pertence ao fluxo vigente.";
        }

        if ($tipo === 'Observação') {
            if ($novo !== $anterior) {
                return 'Observacao nao deve alterar o status da pendencia.';
            }
            return null;
        }

        $permitidas = [
            // Pendencia nasce aqui e permanece enquanto o suporte nao responde.
            // 'Envio ao suporte' apenas registra a interacao (status nao muda).
            'Aguardando suporte' => [
                'Envio ao suporte' => ['Aguardando suporte'],
                'Retorno do suporte' => ['Aguardando testes'],
                'Correção/atualização' => ['Aguardando testes'],
            ],
            // Somente o teste interno pode finalizar (aprovado) ou devolver
            // a pendencia ao suporte (reprovado). O suporte NAO marca Resolvido.
            'Aguardando testes' => [
                'Teste' => ['Resolvido', 'Aguardando suporte'],
            ],
            // Estados finais: apenas 'Observacao' (sem mudanca de status).
            'Resolvido' => [],
            'Cancelado' => [],
        ];

        if (!in_array($novo, $permitidas[$anterior][$tipo] ?? [], true)) {
            return 'Transicao de status incompativel com o fluxo da pendencia.';
        }

        return null;
    }

    private static function buscarPendencia(PDO $pdo, int $id, bool $forUpdate = false): array
    {
        $sql = 'SELECT * FROM pendencias_erp WHERE id = :id LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '');
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Pendencia nao encontrada.', 404);
        }
        return $row;
    }

    private static function normalizarStatus(string $status): string
    {
        return self::LEGACY_STATUS[$status] ?? $status;
    }

    private static function nullableString(mixed $value, int $max): ?string
    {
        $text = trim((string)($value ?? ''));
        return $text === '' ? null : mb_substr($text, 0, $max);
    }
}

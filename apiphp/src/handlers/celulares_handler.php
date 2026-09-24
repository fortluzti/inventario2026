<?php
/**
 * CelularesHandler — API dedicada para o módulo Celulares.
 *
 * Ações genéricas (listar, buscar_por_id, salvar, excluir, proximo_codigo)
 * são delegadas à classe Crud usando o registry em modules.php.
 *
 * Ações customizadas (fluxos de Entrega/Devolução/Dano/Histórico),
 * inspiradas no legado modules/celulares_handler.php:
 *   - listar_celulares_em_estoque  (select para Entrega)
 *   - listar_celulares_em_uso      (select para Devolução)
 *   - listar_funcionarios         (select para Entrega)
 *   - entregar_celular            (POST)
 *   - devolver_celular            (POST)
 *   - registrar_dano              (POST)
 *   - listar_historico_uso        (GET)
 *   - conferencia_dados          (GET) — relatório SOMENTE LEITURA de conferência
 *     dos dados de celulares (duplicidades, funcionário inativo com número,
 *     histórico x associação atual). Não altera nenhum dado.
 */
declare(strict_types=1);

require_once __DIR__ . '/../Crud.php';

final class CelularesHandler
{
    public static function handle(PDO $pdo, string $action, array $input): never
    {
        $mod = require __DIR__ . '/../modules.php';
        $mod = $mod['celulares'];

        // Ações customizadas — antes de tudo, senão cai no Crud genérico
        match (true) {
            $action === 'listar_celulares_em_estoque' => self::listarEmEstoque($pdo),
            $action === 'listar_celulares_em_uso'     => self::listarEmUso($pdo),
            $action === 'listar_funcionarios'        => self::listarFuncionarios($pdo),
            $action === 'entregar_celular'            => self::entregarCelular($pdo, $input),
            $action === 'devolver_celular'            => self::devolverCelular($pdo, $input),
            $action === 'registrar_dano'              => self::registrarDano($pdo, $input),
            $action === 'listar_historico_uso'       => self::listarHistoricoUso($pdo, (int)($input['celular_id'] ?? 0)),
            $action === 'conferencia_dados'           => self::conferenciaDados($pdo, $input),
            default                                   => (new Crud($pdo, $mod, 'celulares'))->handle($action, $input),
        };
    }

    /* ---------- Ações customizadas ---------- */

    private static function listarEmEstoque(PDO $pdo): never
    {
        $stmt = $pdo->prepare("SELECT id, codigo_interno_celular, marca, modelo, imei, numero, status FROM celulares WHERE status = 'Em Estoque' ORDER BY codigo_interno_celular");
        $stmt->execute();
        Response::success($stmt->fetchAll());
    }

    private static function listarEmUso(PDO $pdo): never
    {
        $sql = "SELECT c.id, c.codigo_interno_celular, c.marca, c.modelo, c.imei, c.numero, c.status,
                       f.nome  AS usuario_atual,
                       f.email AS email_usuario,
                       cf.usuario_id AS funcionario_id
                FROM celulares c
                LEFT JOIN (SELECT cf1.* FROM celulares_funcionarios cf1
                           INNER JOIN (SELECT celular_id, MAX(id) AS max_id
                                       FROM celulares_funcionarios
                                       WHERE data_desassociacao IS NULL
                                       GROUP BY celular_id) cf2
                           ON cf2.celular_id = cf1.celular_id AND cf2.max_id = cf1.id) cf
                       ON cf.celular_id = c.id
                LEFT JOIN funcionarios f ON cf.usuario_id = f.id
                WHERE c.status = 'Em Uso'
                ORDER BY f.nome, c.marca, c.modelo";
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        Response::success($stmt->fetchAll());
    }

    private static function listarFuncionarios(PDO $pdo): never
    {
        $stmt = $pdo->prepare("SELECT id, nome FROM funcionarios ORDER BY nome");
        $stmt->execute();
        Response::success($stmt->fetchAll());
    }

    /**
     * Entrega de celular a funcionário — reproduz o fluxo do legado entregarCelular().
     */
    private static function entregarCelular(PDO $pdo, array $input): never
    {
        $celularId     = (int)($input['celular_id'] ?? 0);
        $funcionarioId = (int)($input['funcionario_id'] ?? 0);
        $dataEntrega   = trim((string)($input['data_entrega'] ?? ''));

        if ($celularId <= 0 || $funcionarioId <= 0 || $dataEntrega === '') {
            Response::error('Dados inválidos para a entrega do celular.', 400);
        }

        try {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("SELECT status FROM celulares WHERE id = :celular_id FOR UPDATE");
            $stmt->execute([':celular_id' => $celularId]);
            $celular = $stmt->fetch();

            if (!$celular || $celular['status'] !== 'Em Estoque') {
                $pdo->rollBack();
                Response::error('O celular não está disponível para entrega (status: ' . ($celular['status'] ?? 'Não encontrado') . ').', 400);
            }

            $termoEntrega = 'Termo_' . date('YmdHis') . '_' . $funcionarioId . '_' . $celularId . '.docx';
            $user = $_SERVER['REMOTE_USER'] ?? 'api';

            $pdo->prepare("INSERT INTO celulares_funcionarios
                (celular_id, usuario_id, data_entrega, usuario_cadastro)
                VALUES (:celular_id, :funcionario_id, :data_entrega, :usuario_cadastro)")
                ->execute([
                    ':celular_id' => $celularId, ':funcionario_id' => $funcionarioId,
                    ':data_entrega' => $dataEntrega, ':usuario_cadastro' => $user,
                ]);

            $pdo->prepare("UPDATE celulares SET status = 'Em Uso', usuario_atualizacao = :u, data_atualizacao = NOW() WHERE id = :id")
                ->execute([':u' => $user, ':id' => $celularId]);

            $pdo->prepare("INSERT INTO historico_uso
                (celular_id, usuario_id, data_entrega, termo_entrega)
                VALUES (:celular_id, :usuario_id, :data_entrega, :termo_entrega)")
                ->execute([
                    ':celular_id' => $celularId, ':usuario_id' => $funcionarioId,
                    ':data_entrega' => $dataEntrega, ':termo_entrega' => $termoEntrega,
                ]);

            $pdo->commit();
            Response::success([
                'funcionario_id' => $funcionarioId, 'celular_id' => $celularId,
                'termo_entrega'  => $termoEntrega,
            ], 'Celular entregue com sucesso ao funcionário!');

        } catch (Throwable $e) {
            $pdo->rollBack();
            error_log('[celulares] entregarCelular: ' . $e->getMessage());
            Response::error('Falha ao entregar o celular: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Devolução de celular — reproduz o fluxo do legado devolverCelular().
     */
    private static function devolverCelular(PDO $pdo, array $input): never
    {
        $celularId     = (int)($input['celular_id'] ?? 0);
        $dataDevolucao = trim((string)($input['data_devolucao'] ?? ''));
        $danos         = trim((string)($input['danos'] ?? ''));

        if ($celularId <= 0 || $dataDevolucao === '') {
            Response::error('Dados insuficientes para a devolução.', 400);
        }

        try {
            $pdo->beginTransaction();
            $user = $_SERVER['REMOTE_USER'] ?? 'api';

            $stmt = $pdo->prepare("SELECT usuario_id FROM celulares_funcionarios
                WHERE celular_id = :celular_id AND data_desassociacao IS NULL LIMIT 1");
            $stmt->execute([':celular_id' => $celularId]);
            $funcionarioId = (int)($stmt->fetchColumn() ?: 0);

            if ($funcionarioId <= 0) {
                throw new RuntimeException('Funcionário associado não encontrado.');
            }

            $pdo->prepare("UPDATE celulares_funcionarios
                SET data_desassociacao = :data, usuario_desassociacao = :u,
                    usuario_atualizacao = :u, data_atualizacao = NOW()
                WHERE celular_id = :celular_id AND data_desassociacao IS NULL")
                ->execute([':data' => $dataDevolucao, ':u' => $user, ':celular_id' => $celularId]);

            $pdo->prepare("UPDATE historico_uso SET data_devolucao = :data
                WHERE celular_id = :celular_id AND data_devolucao IS NULL")
                ->execute([':data' => $dataDevolucao, ':celular_id' => $celularId]);

            $novoStatus = $danos !== '' ? 'Danificado' : 'Em Estoque';
            $pdo->prepare("UPDATE celulares SET status = :s, usuario_atualizacao = :u, data_atualizacao = NOW() WHERE id = :id")
                ->execute([':s' => $novoStatus, ':u' => $user, ':id' => $celularId]);

            if ($danos !== '') {
                $pdo->prepare("INSERT INTO danos
                    (celular_id, descricao, data_dano, usuario_cadastro)
                    VALUES (:celular_id, :descricao, :data_dano, :usuario_cadastro)")
                    ->execute([
                        ':celular_id' => $celularId, ':descricao' => $danos,
                        ':data_dano' => $dataDevolucao, ':usuario_cadastro' => $user,
                    ]);
            }

            $pdo->commit();
            Response::success([
                'funcionario_id' => $funcionarioId, 'celular_id' => $celularId,
            ], 'Celular devolvido com sucesso!');

        } catch (Throwable $e) {
            $pdo->rollBack();
            error_log('[celulares] devolverCelular: ' . $e->getMessage());
            Response::error('Falha ao devolver o celular: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Registro de dano isolado — reproduz o fluxo do legado registrarDano().
     */
    private static function registrarDano(PDO $pdo, array $input): never
    {
        $celularId   = (int)($input['celular_id'] ?? 0);
        $descricao   = trim((string)($input['descricao'] ?? ''));
        $dataDano    = trim((string)($input['data_dano'] ?? ''));

        if ($celularId <= 0 || $descricao === '' || $dataDano === '') {
            Response::error('Dados inválidos para registrar o dano.', 400);
        }

        try {
            $pdo->beginTransaction();
            $user = $_SERVER['REMOTE_USER'] ?? 'api';

            $stmt = $pdo->prepare("SELECT usuario_id FROM celulares_funcionarios
                WHERE celular_id = :celular_id AND data_desassociacao IS NULL LIMIT 1");
            $stmt->execute([':celular_id' => $celularId]);
            $funcionarioId = $stmt->fetchColumn() ?: null;

            $pdo->prepare("INSERT INTO danos
                (celular_id, descricao, data_dano, usuario_cadastro)
                VALUES (:celular_id, :descricao, :data_dano, :usuario_cadastro)")
                ->execute([
                    ':celular_id' => $celularId, ':descricao' => $descricao,
                    ':data_dano' => $dataDano, ':usuario_cadastro' => $user,
                ]);

            $pdo->prepare("UPDATE celulares SET status = 'Danificado',
                usuario_atualizacao = :u, data_atualizacao = NOW() WHERE id = :id")
                ->execute([':u' => $user, ':id' => $celularId]);

            $pdo->commit();
            Response::success([
                'funcionario_id' => $funcionarioId, 'celular_id' => $celularId,
            ], 'Dano registrado com sucesso!');

        } catch (Throwable $e) {
            $pdo->rollBack();
            error_log('[celulares] registrarDano: ' . $e->getMessage());
            Response::error('Falha ao registrar o dano: ' . $e->getMessage(), 500);
        }
    }

    /* ---------- Conferência de dados (AUDITORIA — somente leitura) ---------- */

    /**
     * Regras de conferência.
     *
     * Cada regra possui:
     *  - label: texto exibido na grid/CSV;
     *  - tipo:  'inconsistencia' (alerta a corrigir depois) | 'observacao' (informativo);
     *  - sql:   condição sobre as colunas calculadas da subconsulta (usada nos filtros,
     *           na ordenação e no resumo — nenhum dado do cliente entra neste SQL);
     *  - php:   teste equivalente sobre a linha já materializada.
     *
     * Nenhuma regra cria campo/valor que não exista no modelo atual.
     */
    private static function conferenciaRegras(): array
    {
        return [
            // --- Duplicidades por valor cadastrado no celular ---
            'numero_duplicado' => [
                'label' => 'Número repetido em mais de um celular',
                'tipo'  => 'inconsistencia',
                'sql'   => 'numero_em_outros_celulares > 0',
                'php'   => static fn(array $r): bool => (int)$r['numero_em_outros_celulares'] > 0,
            ],
            'numero_associado_a_varios_funcionarios' => [
                'label' => 'Número atualmente associado a mais de um funcionário',
                'tipo'  => 'inconsistencia',
                'sql'   => 'numero_usuarios_atuais > 1',
                'php'   => static fn(array $r): bool => (int)$r['numero_usuarios_atuais'] > 1,
            ],
            'gmail_duplicado' => [
                'label' => 'Gmail repetido em mais de um celular',
                'tipo'  => 'inconsistencia',
                'sql'   => 'gmail_em_outros_celulares > 0',
                'php'   => static fn(array $r): bool => (int)$r['gmail_em_outros_celulares'] > 0,
            ],
            'gmail_associado_a_varios_funcionarios' => [
                'label' => 'Gmail atualmente associado a mais de um funcionário',
                'tipo'  => 'inconsistencia',
                'sql'   => 'gmail_usuarios_atuais > 1',
                'php'   => static fn(array $r): bool => (int)$r['gmail_usuarios_atuais'] > 1,
            ],
            'email_corporativo_duplicado' => [
                'label' => 'E-mail corporativo repetido em mais de um celular',
                'tipo'  => 'inconsistencia',
                'sql'   => 'email_em_outros_celulares > 0',
                'php'   => static fn(array $r): bool => (int)$r['email_em_outros_celulares'] > 0,
            ],
            'email_corporativo_associado_a_varios_funcionarios' => [
                'label' => 'E-mail corporativo atualmente associado a mais de um funcionário',
                'tipo'  => 'inconsistencia',
                'sql'   => 'email_usuarios_atuais > 1',
                'php'   => static fn(array $r): bool => (int)$r['email_usuarios_atuais'] > 1,
            ],

            // --- Funcionário inativo x uso atual ---
            'funcionario_inativo_com_uso_atual' => [
                'label' => 'Funcionário inativo ainda possui número/e-mail em uso (associação ativa)',
                'tipo'  => 'inconsistencia',
                'sql'   => 'funcionario_status_ativo = 0 AND associacao_atual = 1',
                'php'   => static fn(array $r): bool => (int)$r['funcionario_status_ativo'] === 0 && (int)$r['associacao_atual'] === 1,
            ],

            // --- Associações vigentes ---
            'celular_associado_a_varios_funcionarios' => [
                'label' => 'Celular atualmente associado a mais de um funcionário',
                'tipo'  => 'inconsistencia',
                'sql'   => 'celular_associacoes_atuais > 1',
                'php'   => static fn(array $r): bool => (int)$r['celular_associacoes_atuais'] > 1,
            ],
            'associacao_ativa_repetida' => [
                'label' => 'Mesmo funcionário com mais de uma associação ativa no celular',
                'tipo'  => 'inconsistencia',
                'sql'   => 'associacoes_atuais_mesmo_funcionario > 1',
                'php'   => static fn(array $r): bool => (int)$r['associacoes_atuais_mesmo_funcionario'] > 1,
            ],

            // --- Status do celular x associação ---
            'celular_em_uso_sem_associacao' => [
                'label' => 'Celular com status "Em Uso" sem associação ativa',
                'tipo'  => 'inconsistencia',
                'sql'   => "celular_status = 'Em Uso' AND celular_associacoes_atuais = 0",
                'php'   => static fn(array $r): bool => $r['celular_status'] === 'Em Uso' && (int)$r['celular_associacoes_atuais'] === 0,
            ],
            'celular_fora_de_uso_com_associacao' => [
                'label' => 'Celular fora de uso (status diferente de "Em Uso") com associação ativa',
                'tipo'  => 'inconsistencia',
                'sql'   => "celular_status <> 'Em Uso' AND celular_associacoes_atuais > 0",
                'php'   => static fn(array $r): bool => $r['celular_status'] !== 'Em Uso' && (int)$r['celular_associacoes_atuais'] > 0,
            ],

            // --- Coerência das datas de uso ---
            'data_fim_antes_do_inicio' => [
                'label' => 'Data de fim do uso anterior à data de início',
                'tipo'  => 'inconsistencia',
                'sql'   => 'data_fim IS NOT NULL AND data_inicio IS NOT NULL AND data_fim < data_inicio',
                'php'   => static fn(array $r): bool => $r['data_fim'] !== null && $r['data_inicio'] !== null && $r['data_fim'] < $r['data_inicio'],
            ],

            // --- Observações (não são erro; apoiam a conferência humana) ---
            'sem_associacao' => [
                'label' => 'Celular sem nenhuma associação/histórico registrado',
                'tipo'  => 'observacao',
                'sql'   => 'associacao_id IS NULL',
                'php'   => static fn(array $r): bool => $r['associacao_id'] === null,
            ],
            'funcionario_inativo_historico' => [
                'label' => 'Funcionário inativo — associação já encerrada (histórico legítimo)',
                'tipo'  => 'observacao',
                'sql'   => 'associacao_id IS NOT NULL AND funcionario_status_ativo = 0 AND associacao_atual = 0',
                'php'   => static fn(array $r): bool => $r['associacao_id'] !== null
                    && (int)$r['funcionario_status_ativo'] === 0 && (int)$r['associacao_atual'] === 0,
            ],
            'associacao_sem_data_inicio' => [
                'label' => 'Associação sem data de início registrada',
                'tipo'  => 'observacao',
                'sql'   => 'associacao_id IS NOT NULL AND data_inicio IS NULL',
                'php'   => static fn(array $r): bool => $r['associacao_id'] !== null && $r['data_inicio'] === null,
            ],
            'sem_numero' => [
                'label' => 'Número não cadastrado no celular',
                'tipo'  => 'observacao',
                'sql'   => 'tem_numero = 0',
                'php'   => static fn(array $r): bool => (int)$r['tem_numero'] === 0,
            ],
            'sem_gmail' => [
                'label' => 'Gmail não cadastrado no celular',
                'tipo'  => 'observacao',
                'sql'   => 'tem_gmail = 0',
                'php'   => static fn(array $r): bool => (int)$r['tem_gmail'] === 0,
            ],
            'sem_email_corporativo' => [
                'label' => 'E-mail corporativo não cadastrado no celular',
                'tipo'  => 'observacao',
                'sql'   => 'tem_email_corporativo = 0',
                'php'   => static fn(array $r): bool => (int)$r['tem_email_corporativo'] === 0,
            ],
            'email_corporativo_difere_do_funcionario' => [
                'label' => 'E-mail corporativo do celular difere do e-mail cadastrado no funcionário',
                'tipo'  => 'observacao',
                'sql'   => "TRIM(COALESCE(email_corporativo,'')) <> '' AND TRIM(COALESCE(funcionario_email,'')) <> ''
                            AND LOWER(TRIM(email_corporativo)) <> LOWER(TRIM(funcionario_email))",
                'php'   => static fn(array $r): bool => trim((string)$r['email_corporativo']) !== ''
                    && trim((string)$r['funcionario_email']) !== ''
                    && strcasecmp(trim((string)$r['email_corporativo']), trim((string)$r['funcionario_email'])) !== 0,
            ],
        ];
    }

    /** De onde cada dado exibido na conferência vem (fonte real no banco). */
    private static function conferenciaFontes(): array
    {
        return [
            'numero'             => 'celulares.numero (número/chip do aparelho)',
            'gmail'              => 'celulares.gmail (conta Gmail vinculada ao aparelho)',
            'email_corporativo'  => 'celulares.email_corporativo (e-mail corporativo vinculado ao aparelho)',
            'funcionario'        => 'celulares_funcionarios.usuario_id → funcionarios.nome',
            'status_funcionario' => 'funcionarios.ativo (1 = Ativo, 0 = Inativo)',
            'status_celular'     => 'celulares.status (Em Uso / Em Estoque / Em Manutenção / Danificado / Descartado)',
            'inicio_do_uso'      => 'celulares_funcionarios.data_entrega (fallback: data_associacao)',
            'fim_do_uso'         => 'celulares_funcionarios.data_desassociacao (NULL = uso vigente)',
            'historico'          => 'celulares_funcionarios (todas as linhas) + historico_uso (termos de entrega/devolução)',
        ];
    }

    /** Limitações reais do modelo atual (exibidas na tela para não induzir conclusão errada). */
    private static function conferenciaLimitacoes(): array
    {
        return [
            'Número, Gmail e e-mail corporativo são atributos do APARELHO (tabela celulares): o sistema não versiona esses valores por período de uso — em registros históricos é exibido o valor ATUAL cadastrado no celular.',
            'funcionarios.gmail existe no schema, porém está vazio no banco atual; o Gmail real fica em celulares.gmail. funcionarios.email é o e-mail corporativo do funcionário e é usado aqui apenas como comparação (observação).',
            'historico_uso guarda apenas os termos (entrega/devolução) e não possui colunas de número/Gmail/e-mail; o histórico de uso propriamente dito vem de celulares_funcionarios.',
            'Data de fim vazia significa associação ainda vigente (ou dado ausente no cadastro antigo) — nenhuma data foi inferida ou preenchida.',
            'Esta consulta é SOMENTE LEITURA: nenhum cadastro, status, telefone, e-mail ou associação é alterado.',
        ];
    }

    /**
     * Relatório de conferência dos dados de celulares — SOMENTE LEITURA.
     *
     * Uma linha por associação (celular × funcionário), incluindo histórico
     * (data_desassociacao preenchida) e também celulares sem nenhuma associação.
     * Nenhum dado é gravado, alterado ou removido.
     *
     * Filtros: search, status_celular, status_funcionario (ativos|inativos),
     *          associacao (atual|historica|sem_associacao),
     *          situacao (ok|inconsistencia) e situacao_codigo (código de uma regra).
     * Ordenação: whitelist sort/dir. Paginação: page/limit.
     * todos=1 devolve o conjunto filtrado inteiro (usado pela exportação CSV).
     */
    private static function conferenciaDados(PDO $pdo, array $input): never
    {
        $regras = self::conferenciaRegras();

        // Normalização sem REGEXP (compatível MySQL 5.7+/MariaDB):
        // número -> somente dígitos | e-mails -> minúsculo e sem espaços.
        $numeroNorm = static fn(string $col): string =>
            "NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE({$col}, ''), '(', ''), ')', ''), '-', ''), ' ', ''), '')";
        $emailNorm = static fn(string $col): string => "NULLIF(LOWER(TRIM(COALESCE({$col}, ''))), '')";

        $numeroCel = $numeroNorm('c.numero');
        $gmailCel  = $emailNorm('c.gmail');
        $emailCel  = $emailNorm('c.email_corporativo');

        // Mesmo valor cadastrado em OUTRO celular (duplicidade no cadastro do aparelho).
        $emOutrosCelulares = static fn(string $outro, string $atual): string =>
            "(SELECT COUNT(*) FROM celulares d
               WHERE {$outro} IS NOT NULL AND {$outro} = {$atual} AND d.id <> c.id)";

        // Funcionários distintos associados ATUALMENTE (data_desassociacao IS NULL) ao mesmo valor.
        $usuariosAtuais = static fn(string $outro, string $atual): string =>
            "(SELECT COUNT(DISTINCT cf2.usuario_id) FROM celulares d
                INNER JOIN celulares_funcionarios cf2
                        ON cf2.celular_id = d.id AND cf2.data_desassociacao IS NULL
               WHERE {$outro} = {$atual})";

        $inner = "
            SELECT
                c.id AS celular_id,
                c.codigo_interno_celular AS codigo,
                c.marca, c.modelo, c.status AS celular_status,
                c.numero, c.gmail, c.email_corporativo,
                cf.id AS associacao_id,
                CASE WHEN cf.id IS NULL THEN NULL
                     WHEN cf.data_desassociacao IS NULL THEN 1 ELSE 0 END AS associacao_atual,
                cf.usuario_id AS funcionario_id,
                f.nome AS funcionario, f.cargo AS funcionario_cargo,
                f.email AS funcionario_email, f.ativo AS funcionario_status_ativo,
                COALESCE(cf.data_entrega, cf.data_associacao) AS data_inicio,
                cf.data_desassociacao AS data_fim,
                CASE WHEN NULLIF(TRIM(COALESCE(c.numero, '')), '') IS NULL THEN 0 ELSE 1 END AS tem_numero,
                CASE WHEN NULLIF(TRIM(COALESCE(c.gmail, '')), '') IS NULL THEN 0 ELSE 1 END AS tem_gmail,
                CASE WHEN NULLIF(TRIM(COALESCE(c.email_corporativo, '')), '') IS NULL THEN 0 ELSE 1 END AS tem_email_corporativo,
                {$emOutrosCelulares($numeroNorm('d.numero'), $numeroCel)} AS numero_em_outros_celulares,
                {$emOutrosCelulares($emailNorm('d.gmail'), $gmailCel)} AS gmail_em_outros_celulares,
                {$emOutrosCelulares($emailNorm('d.email_corporativo'), $emailCel)} AS email_em_outros_celulares,
                {$usuariosAtuais($numeroNorm('d.numero'), $numeroCel)} AS numero_usuarios_atuais,
                {$usuariosAtuais($emailNorm('d.gmail'), $gmailCel)} AS gmail_usuarios_atuais,
                {$usuariosAtuais($emailNorm('d.email_corporativo'), $emailCel)} AS email_usuarios_atuais,
                (SELECT COUNT(*) FROM celulares_funcionarios cfx
                  WHERE cfx.celular_id = c.id AND cfx.data_desassociacao IS NULL) AS celular_associacoes_atuais,
                (SELECT COUNT(*) FROM celulares_funcionarios cfy
                  WHERE cfy.celular_id = c.id AND cfy.usuario_id = cf.usuario_id
                    AND cfy.data_desassociacao IS NULL) AS associacoes_atuais_mesmo_funcionario
            FROM celulares c
            LEFT JOIN celulares_funcionarios cf ON cf.celular_id = c.id
            LEFT JOIN funcionarios f ON f.id = cf.usuario_id";

        // Total de inconsistências da linha (mesmas condições das regras — fonte única).
        $somaInconsistencias = [];
        foreach ($regras as $regra) {
            if ($regra['tipo'] !== 'inconsistencia') {
                continue;
            }
            $somaInconsistencias[] = "CASE WHEN {$regra['sql']} THEN 1 ELSE 0 END";
        }
        $derivada = 'SELECT x.*, (' . implode(' + ', $somaInconsistencias)
            . ') AS inconsistencias_qtd FROM (' . $inner . ') AS x';

        // Nível extra de subconsulta: o MySQL não aceita alias de coluna dentro do
        // próprio WHERE — assim `inconsistencias_qtd` pode ser filtrado/ordenado.
        $baseRegras = 'SELECT * FROM (' . $derivada . ') AS y';

        // Whitelist de filtros/ordenação — o input do cliente nunca é concatenado no SQL.
        [$whereSql, $params] = self::conferenciaFiltros($input, $regras);
        $fromSql = $baseRegras . $whereSql;

        // ---- Paginação (todos=1 devolve o conjunto filtrado inteiro, para o CSV) ----
        $todos  = !empty($input['todos']) && (string)$input['todos'] !== '0';
        $page   = max(1, (int)($input['page'] ?? 1));
        $limit  = min(500, max(1, (int)($input['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $stmtCount = $pdo->prepare('SELECT COUNT(*) FROM (' . $fromSql . ') AS t');
        $stmtCount->execute($params);
        $total = (int)$stmtCount->fetchColumn();

        $sql = $fromSql . ' ' . self::conferenciaOrdem($input);
        $sql .= $todos ? ' LIMIT 5000' : " LIMIT {$limit} OFFSET {$offset}";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $linhas = $stmt->fetchAll();

        // ---- Situação de cada linha (mesmas regras do SQL, avaliadas em PHP) ----
        $itens = [];
        foreach ($linhas as $linha) {
            $situacoes = [];
            $observacoes = [];
            foreach ($regras as $codigo => $regra) {
                if (!($regra['php'])($linha)) {
                    continue;
                }
                $item = ['codigo' => $codigo, 'label' => $regra['label']];
                if ($regra['tipo'] === 'inconsistencia') {
                    $situacoes[] = $item;
                } else {
                    $observacoes[] = $item;
                }
            }
            $itens[] = [
                'celular_id'         => (int)$linha['celular_id'],
                'codigo'             => $linha['codigo'],
                'marca'              => $linha['marca'],
                'modelo'             => $linha['modelo'],
                'numero'             => $linha['numero'],
                'gmail'              => $linha['gmail'],
                'email_corporativo'  => $linha['email_corporativo'],
                'associacao_id'      => $linha['associacao_id'] !== null ? (int)$linha['associacao_id'] : null,
                'associacao'         => $linha['associacao_atual'] === null
                    ? null
                    : ((int)$linha['associacao_atual'] === 1 ? 'Atual' : 'Histórica'),
                'funcionario_id'     => $linha['funcionario_id'] !== null ? (int)$linha['funcionario_id'] : null,
                'funcionario'        => $linha['funcionario'],
                'funcionario_cargo'  => $linha['funcionario_cargo'],
                'funcionario_email'  => $linha['funcionario_email'],
                'funcionario_ativo'  => $linha['funcionario_status_ativo'] !== null ? (int)$linha['funcionario_status_ativo'] : null,
                'funcionario_status' => $linha['funcionario_status_ativo'] === null
                    ? null
                    : ((int)$linha['funcionario_status_ativo'] === 1 ? 'Ativo' : 'Inativo'),
                'celular_status'     => $linha['celular_status'],
                'data_inicio'        => $linha['data_inicio'],
                'data_fim'           => $linha['data_fim'],
                'conferencia_status' => $situacoes ? 'Inconsistência' : 'OK',
                'situacoes'          => $situacoes,
                'observacoes'        => $observacoes,
            ];
        }

        // ---- Resumo com os mesmos filtros, sem paginação ----
        $resumo = self::conferenciaResumo($pdo, $fromSql, $params, $regras);

        $catalogo = [];
        foreach ($regras as $codigo => $regra) {
            $catalogo[] = ['codigo' => $codigo, 'label' => $regra['label'], 'tipo' => $regra['tipo']];
        }

        Response::success([
            'items'           => $itens,
            'total'           => $total,
            'page'            => $todos ? 1 : $page,
            'limit'           => $todos ? $total : $limit,
            'total_pages'     => $todos ? 1 : max(1, (int)ceil($total / $limit)),
            'resumo'          => $resumo,
            'regras'          => $catalogo,
            'opcoes'          => ['status_celular' => self::conferenciaStatusCelular($pdo)],
            'fontes'          => self::conferenciaFontes(),
            'limitacoes'      => self::conferenciaLimitacoes(),
            'somente_leitura' => true,
        ]);
    }

    /**
     * Monta WHERE + parâmetros da conferência (tudo por prepared statement;
     * somente as condições das regras entram no SQL, nunca texto do cliente).
     *
     * @return array{0: string, 1: array<string, string>}
     */
    private static function conferenciaFiltros(array $input, array $regras): array
    {
        $where = [];
        $params = [];

        $search = trim((string)($input['search'] ?? ''));
        if ($search !== '') {
            $colunas = ['codigo', 'numero', 'gmail', 'email_corporativo', 'funcionario', 'funcionario_email'];
            $parts = [];
            foreach ($colunas as $i => $coluna) {
                $parts[] = "{$coluna} LIKE :search{$i}";
                $params[":search{$i}"] = '%' . $search . '%';
            }
            $where[] = '(' . implode(' OR ', $parts) . ')';
        }

        $statusCelular = trim((string)($input['status_celular'] ?? ''));
        if ($statusCelular !== '') {
            $where[] = 'celular_status = :f_status_celular';
            $params[':f_status_celular'] = $statusCelular;
        }

        $statusFuncionario = strtolower(trim((string)($input['status_funcionario'] ?? '')));
        if ($statusFuncionario === 'ativos') {
            $where[] = 'funcionario_status_ativo = 1';
        } elseif ($statusFuncionario === 'inativos') {
            $where[] = 'funcionario_status_ativo = 0';
        }

        $associacao = strtolower(trim((string)($input['associacao'] ?? '')));
        if ($associacao === 'atual') {
            $where[] = 'associacao_atual = 1';
        } elseif ($associacao === 'historica') {
            $where[] = 'associacao_id IS NOT NULL AND associacao_atual = 0';
        } elseif ($associacao === 'sem_associacao') {
            $where[] = 'associacao_id IS NULL';
        }

        $situacao = strtolower(trim((string)($input['situacao'] ?? '')));
        if ($situacao === 'ok') {
            $where[] = 'inconsistencias_qtd = 0';
        } elseif ($situacao === 'inconsistencia' || $situacao === 'com_inconsistencia') {
            $where[] = 'inconsistencias_qtd > 0';
        }

        $situacaoCodigo = trim((string)($input['situacao_codigo'] ?? ''));
        if ($situacaoCodigo !== '') {
            if (!isset($regras[$situacaoCodigo])) {
                Response::error("Situacao '{$situacaoCodigo}' nao reconhecida para conferencia.", 400);
            }
            $where[] = '((' . $regras[$situacaoCodigo]['sql'] . ') = 1)';
        }

        return [$where ? ' WHERE ' . implode(' AND ', $where) : '', $params];
    }

    /** Ordenação da conferência: só aceita chaves da whitelist (nunca SQL do cliente). */
    private static function conferenciaOrdem(array $input): string
    {
        $sortable = [
            'codigo'             => 'codigo',
            'numero'             => 'numero',
            'gmail'              => 'gmail',
            'email_corporativo'  => 'email_corporativo',
            'funcionario'        => 'funcionario',
            'status_funcionario' => 'funcionario_status_ativo',
            'status_celular'     => 'celular_status',
            'associacao'         => 'associacao_atual',
            'inicio'             => 'data_inicio',
            'fim'                => 'data_fim',
            'situacao'           => 'inconsistencias_qtd',
        ];

        $sortKey = (string)($input['sort'] ?? '');
        if ($sortKey !== '' && isset($sortable[$sortKey])) {
            $dir = strtoupper((string)($input['dir'] ?? 'ASC')) === 'DESC' ? 'DESC' : 'ASC';
            // Desempate estável entre páginas.
            return "ORDER BY {$sortable[$sortKey]} {$dir}, codigo ASC, associacao_id ASC";
        }

        // Padrão da conferência: inconsistências primeiro, uso mais recente no topo.
        return 'ORDER BY inconsistencias_qtd DESC, data_inicio DESC, codigo ASC, associacao_id ASC';
    }

    /**
     * Contagens da conferência (por situação e por código de regra) para o painel da tela
     * e para o relatório final — mesmos filtros da listagem, sem paginação.
     *
     * @return array<string, mixed>
     */
    private static function conferenciaResumo(PDO $pdo, string $fromSql, array $params, array $regras): array
    {
        $somas = [];
        foreach ($regras as $codigo => $regra) {
            $somas[] = "SUM(CASE WHEN {$regra['sql']} THEN 1 ELSE 0 END) AS `{$codigo}`";
        }

        $sql = 'SELECT COUNT(*) AS total,
                       SUM(CASE WHEN inconsistencias_qtd > 0 THEN 1 ELSE 0 END) AS com_inconsistencia,
                       SUM(CASE WHEN inconsistencias_qtd = 0 THEN 1 ELSE 0 END) AS ok, '
            . implode(', ', $somas)
            . ' FROM (' . $fromSql . ') AS t';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch() ?: [];

        $inconsistencias = [];
        $observacoes = [];
        foreach ($regras as $codigo => $regra) {
            $valor = (int)($row[$codigo] ?? 0);
            if ($regra['tipo'] === 'inconsistencia') {
                $inconsistencias[$codigo] = $valor;
            } else {
                $observacoes[$codigo] = $valor;
            }
        }

        $escopo = $pdo->query('SELECT
                (SELECT COUNT(*) FROM celulares) AS celulares,
                (SELECT COUNT(*) FROM celulares_funcionarios) AS associacoes,
                (SELECT COUNT(*) FROM funcionarios) AS funcionarios,
                (SELECT COUNT(*) FROM historico_uso) AS termos_historico_uso')->fetch() ?: [];

        return [
            'total'              => (int)($row['total'] ?? 0),
            'ok'                 => (int)($row['ok'] ?? 0),
            'com_inconsistencia' => (int)($row['com_inconsistencia'] ?? 0),
            'por_inconsistencia' => $inconsistencias,
            'por_observacao'     => $observacoes,
            'escopo'             => [
                'celulares'            => (int)($escopo['celulares'] ?? 0),
                'associacoes'          => (int)($escopo['associacoes'] ?? 0),
                'funcionarios'         => (int)($escopo['funcionarios'] ?? 0),
                'termos_historico_uso' => (int)($escopo['termos_historico_uso'] ?? 0),
            ],
        ];
    }

    /** Status realmente existentes em celulares.status (opções do filtro da tela). */
    private static function conferenciaStatusCelular(PDO $pdo): array
    {
        $stmt = $pdo->query("SELECT DISTINCT status FROM celulares
                              WHERE status IS NOT NULL AND status <> '' ORDER BY status");
        return array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    /**
     * Histórico de uso — union de eventos: Uso, Dano, Manutenção.
     * Reproduz a query do legado listarHistoricoUso().
     */
    private static function listarHistoricoUso(PDO $pdo, int $celularId): never
    {
        if ($celularId <= 0) {
            Response::error('ID do celular inválido.', 400);
        }

        $sql = "
            SELECT 'Uso' AS tipo_evento, DATE(cf.data_entrega) AS data_evento,
                   DATE(cf.data_desassociacao) AS data_fim_evento,
                   f.nome AS pessoa_relacionada,
                   CASE WHEN cf.data_desassociacao IS NOT NULL THEN 'Devolvido' ELSE 'Em Uso' END AS status_evento,
                   (SELECT hu.termo_entrega FROM historico_uso hu
                    WHERE hu.celular_id = cf.celular_id AND hu.usuario_id = cf.usuario_id
                    AND DATE(hu.data_entrega) = DATE(cf.data_entrega) LIMIT 1) AS detalhes
            FROM celulares_funcionarios cf
            LEFT JOIN funcionarios f ON cf.usuario_id = f.id
            WHERE cf.celular_id = :id1

            UNION ALL

            SELECT 'Dano' AS tipo_evento, DATE(d.data_dano) AS data_evento,
                   NULL AS data_fim_evento, u.nome AS pessoa_relacionada,
                   NULL AS status_evento, d.descricao AS detalhes
            FROM danos d
            LEFT JOIN users u ON d.usuario_cadastro = u.login
            WHERE d.celular_id = :id2

            UNION ALL

            SELECT 'Manutenção' AS tipo_evento, DATE(m.data_inicio) AS data_evento,
                   DATE(m.data_fim) AS data_fim_evento, forn.nome AS pessoa_relacionada,
                   m.status AS status_evento,
                   CONCAT('Problema: ', m.problema_relatado) AS detalhes
            FROM manutencoes m
            INNER JOIN itens_manutencao im ON m.id = im.id_manutencao
            LEFT JOIN fornecedores forn ON m.fornecedor_id = forn.id
            WHERE im.item_type = 'celular' AND im.item_id = :id3

            ORDER BY data_evento DESC, tipo_evento ASC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':id1' => $celularId, ':id2' => $celularId, ':id3' => $celularId,
        ]);
        Response::success($stmt->fetchAll());
    }
}






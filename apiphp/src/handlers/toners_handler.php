<?php
/**
 * TonersHandler — API dedicada do módulo Consumíveis (`toner`, singular).
 *
 * Acoes genericas (listar, buscar_por_id, salvar, excluir, proximo_codigo,
 * dropdown) delegam para a classe Crud com o registry em modules.php.
 *
 * Acoes customizadas — reproduzem os fluxos que o sistema legado concentrava
 * na TELA de Toners (modules/toners/toners_list.php + api/*_toner_handler.php),
 * agora em MODAL sobre a listagem (nenhuma pagina separada):
 *   - listar_compativeis  (GET)  consumiveis compativeis com o MODELO da
 *                                impressora escolhida (relacao existente
 *                                `impressora_modelos_toner`, migration 006).
 *                                TONER e CILINDRO seguem a MESMA regra — a
 *                                classificacao vem sempre de `toner.tipo`.
 *   - registrar_troca     (POST) registra a troca em `historico_troca_toner`,
 *                                da baixa de 1 unidade do estoque e atualiza
 *                                `impressoras.data_ultima_troca_toner`, tudo na
 *                                mesma transacao. O RESPONSAVEL e SEMPRE o
 *                                usuario logado: nao existe selecao manual de
 *                                funcionario (o login e resolvido para o
 *                                funcionario de MESMO NOME apenas na exibicao).
 *   - listar_historico    (GET)  historico de trocas com os filtros do legado
 *                                (impressora, setor, consumivel) + paginacao.
 *   - receber_multiplos   (POST) recebimento MULTIPLO: funcionario recebedor +
 *                                data/observacao + varios consumiveis com
 *                                quantidade; soma no estoque e grava cada
 *                                linha em `recebimentos_toner`.
 *
 * Nenhuma tabela/coluna nova: reusa `historico_troca_toner`,
 * `recebimentos_toner`, `impressora_modelos_toner` e `toner`.
 */
declare(strict_types=1);

require_once __DIR__ . '/../Crud.php';

final class TonersHandler
{
    /** Limite de observacoes (coluna TEXT). */
    private const MAX_OBS = 1000;

    public static function handle(PDO $pdo, string $action, array $input): never
    {
        $mod = require __DIR__ . '/../modules.php';
        $mod = $mod['toners'];

        // Acoes customizadas — antes de tudo, senao cai no Crud generico
        match (true) {
            $action === 'listar_compativeis' => self::listarCompativeis($pdo, (int)($input['impressora_id'] ?? 0)),
            $action === 'registrar_troca'    => self::registrarTroca($pdo, $input),
            $action === 'listar_historico'   => self::listarHistorico($pdo, $input),
            $action === 'receber_multiplos'  => self::receberMultiplos($pdo, $input),
            default                          => (new Crud($pdo, $mod, 'toners'))->handle($action, $input),
        };
    }

    /* ---------- Acoes customizadas ---------- */

    /**
     * Responsavel pela operacao = usuario LOGADO (login enviado pelo frontend a
     * partir da sessao autenticada). Campo apenas de auditoria/responsabilidade:
     * nunca permite escolher um funcionario manualmente. Sanitizado e limitado a
     * 50 caracteres (mesmo tamanho de `usuario_cadastro`).
     */
    private static function responsavel(array $input): string
    {
        $raw = trim((string)($input['usuario'] ?? ''));
        $login = trim(substr((string)preg_replace('/[^A-Za-z0-9._\- ]/', '', $raw), 0, 50));
        if ($login !== '') {
            return $login;
        }
        $fallback = trim((string)($_SERVER['PHP_AUTH_USER'] ?? ($_SERVER['REMOTE_USER'] ?? 'api')));
        return $fallback !== '' ? substr($fallback, 0, 50) : 'api';
    }

    private static function observacoes(array $input): ?string
    {
        $obs = trim((string)($input['observacoes'] ?? ''));
        return $obs === '' ? null : substr($obs, 0, self::MAX_OBS);
    }

    /**
     * Consumiveis compativeis com o MODELO da impressora informada.
     * A impressora determina o modelo (`impressoras.modelo_id`); o vinculo com os
     * consumiveis vem de `impressora_modelos_toner` (migration 006). Um consumivel
     * compativel com N modelos continua aparecendo 1x (o vinculo e unico por par).
     */
    private static function listarCompativeis(PDO $pdo, int $impressoraId): never
    {
        if ($impressoraId <= 0) {
            Response::error('ID da impressora invalido.', 400);
        }

        $stmt = $pdo->prepare('SELECT modelo_id FROM impressoras WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $impressoraId]);
        $modeloId = $stmt->fetchColumn();
        if ($modeloId === false) {
            Response::error('Impressora nao encontrada.', 404);
        }

        $sql = 'SELECT t.id, t.codigo, t.tipo, t.estoque, t.estoque_minimo, t.autonomia
                FROM toner t
                INNER JOIN impressora_modelos_toner r ON r.toner_id = t.id
                WHERE r.modelo_id = :modelo_id
                ORDER BY t.tipo ASC, t.codigo ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':modelo_id' => (int)$modeloId]);

        Response::success([
            'impressora_id' => $impressoraId,
            'modelo_id'     => (int)$modeloId,
            'items'         => $stmt->fetchAll(),
        ]);
    }

    /**
     * Registra a troca de consumivel (TONER ou CILINDRO — mesma operacao):
     *  1. valida impressora + compatibilidade do consumivel com o modelo;
     *  2. valida estoque disponivel;
     *  3. grava `historico_troca_toner` (responsavel = usuario logado);
     *  4. da baixa de 1 unidade no estoque;
     *  5. atualiza `impressoras.data_ultima_troca_toner`.
     * Tudo em uma transacao — qualquer falha desfaz o conjunto.
     */
    private static function registrarTroca(PDO $pdo, array $input): never
    {
        $idImpressora = (int)($input['id_impressora'] ?? 0);
        $idToner      = (int)($input['id_toner'] ?? 0);
        $observacoes  = self::observacoes($input);
        $usuario      = self::responsavel($input);

        $errors = [];
        if ($idImpressora <= 0) { $errors['id_impressora'] = 'Selecione a impressora.'; }
        if ($idToner <= 0)      { $errors['id_toner'] = 'Selecione o consumivel utilizado.'; }
        if ($errors !== []) {
            Response::error('Erros de validacao.', 422, $errors);
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT modelo_id FROM impressoras WHERE id = :id LIMIT 1');
            $stmt->execute([':id' => $idImpressora]);
            $modeloId = $stmt->fetchColumn();
            if ($modeloId === false) {
                $pdo->rollBack();
                Response::error('Impressora nao encontrada.', 404);
            }

            // A impressora determina os consumiveis compativeis.
            $compat = $pdo->prepare('SELECT 1 FROM impressora_modelos_toner WHERE toner_id = :t AND modelo_id = :m LIMIT 1');
            $compat->execute([':t' => $idToner, ':m' => (int)$modeloId]);
            if ($compat->fetchColumn() === false) {
                $pdo->rollBack();
                Response::error('Consumivel incompativel com o modelo da impressora selecionada.', 422, [
                    'id_toner' => 'Nao ha vinculo deste consumivel com o modelo da impressora.',
                ]);
            }

            $lock = $pdo->prepare('SELECT codigo, estoque FROM toner WHERE id = :id FOR UPDATE');
            $lock->execute([':id' => $idToner]);
            $toner = $lock->fetch();
            if (!$toner) {
                $pdo->rollBack();
                Response::error('Consumivel nao encontrado.', 404);
            }
            if ((int)$toner['estoque'] <= 0) {
                $pdo->rollBack();
                Response::error('Consumivel sem estoque disponivel para troca.', 422, [
                    'id_toner' => 'Estoque zerado.',
                ]);
            }

            $ins = $pdo->prepare('INSERT INTO historico_troca_toner
                    (id_toner, id_impressora, observacoes, usuario_cadastro, data_cadastro, usuario_atualizacao, data_atualizacao)
                    VALUES (:id_toner, :id_impressora, :observacoes, :usr_cad, NOW(), :usr_upd, NOW())');
            $ins->execute([
                ':id_toner'      => $idToner,
                ':id_impressora' => $idImpressora,
                ':observacoes'   => $observacoes,
                ':usr_cad'       => $usuario,
                ':usr_upd'       => $usuario,
            ]);
            $idTroca = (int)$pdo->lastInsertId();

            $pdo->prepare('UPDATE toner SET estoque = estoque - 1, usuario_atualizacao = :usr, data_atualizacao = NOW()
                           WHERE id = :id AND estoque > 0')
                ->execute([':usr' => $usuario, ':id' => $idToner]);

            $pdo->prepare('UPDATE impressoras SET data_ultima_troca_toner = NOW(), usuario_atualizacao = :usr, data_atualizacao = NOW()
                           WHERE id = :id')
                ->execute([':usr' => $usuario, ':id' => $idImpressora]);

            $pdo->commit();
            Audit::log($pdo, null, 'insert', 'historico_troca_toner', $idTroca, []);

            Response::success([
                'id'            => $idTroca,
                'id_impressora' => $idImpressora,
                'id_toner'      => $idToner,
                'codigo'        => $toner['codigo'],
                'estoque'       => (int)$toner['estoque'] - 1,
                'responsavel'   => $usuario,
            ], 'Troca registrada com sucesso. Estoque atualizado.');
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) { $pdo->rollBack(); }
            throw $e;
        }
    }

    /**
     * Historico de trocas com os filtros do legado (impressora, setor e consumivel).
     * O responsavel e exibido como o funcionario de MESMO NOME do usuario que
     * registrou (`users.nome` x `funcionarios.nome`, sem diferenciar maiusculas),
     * caindo para o proprio login quando nao ha funcionario correspondente. A
     * resolucao e feita por subconsulta para nunca multiplicar linhas.
     */
    private static function listarHistorico(PDO $pdo, array $input): never
    {
        $where  = [];
        $params = [];
        $filtros = [
            'impressora_id' => 'h.id_impressora',
            'setor_id'      => 'i.setor_id',
            'toner_id'      => 'h.id_toner',
        ];
        foreach ($filtros as $key => $col) {
            if (isset($input[$key]) && $input[$key] !== '') {
                $where[] = "{$col} = :{$key}";
                $params[":{$key}"] = (int)$input[$key];
            }
        }
        $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';

        $page   = max(1, (int)($input['page'] ?? 1));
        $limit  = min(200, max(1, (int)($input['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM historico_troca_toner h'
            . ' LEFT JOIN impressoras i ON i.id = h.id_impressora'
            . $whereSql
        );
        $stmt->execute($params);
        $total = (int)$stmt->fetchColumn();

        $sql = 'SELECT h.id, h.data_cadastro, h.observacoes, h.usuario_cadastro,
                       t.id AS toner_id, t.codigo AS toner_codigo, t.tipo AS toner_tipo,
                       i.id AS impressora_id, i.codigo_interno_impressora AS impressora_codigo,
                       im.nome_modelo AS modelo_nome, im.marca AS modelo_marca,
                       s.id AS setor_id, s.nome AS setor_nome,
                       COALESCE((SELECT f.nome FROM users u2
                                 INNER JOIN funcionarios f ON UPPER(f.nome) = UPPER(u2.nome)
                                 WHERE u2.login = h.usuario_cadastro
                                 ORDER BY f.id LIMIT 1),
                                h.usuario_cadastro) AS responsavel
                FROM historico_troca_toner h
                INNER JOIN toner t ON t.id = h.id_toner
                LEFT JOIN impressoras i ON i.id = h.id_impressora
                LEFT JOIN impressora_modelos im ON im.id = i.modelo_id
                LEFT JOIN setores s ON s.id = i.setor_id'
            . $whereSql
            . " ORDER BY h.data_cadastro DESC, h.id DESC LIMIT {$limit} OFFSET {$offset}";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        Response::success([
            'items'       => $stmt->fetchAll(),
            'total'       => $total,
            'page'        => $page,
            'limit'       => $limit,
            'total_pages' => (int)ceil($total / $limit),
        ]);
    }

    /**
     * Recebimento MULTIPLO: funcionario recebedor + data/observacao + varios
     * consumiveis com quantidade. Soma no estoque e grava uma linha em
     * `recebimentos_toner` por consumivel, na mesma transacao. Itens repetidos
     * do mesmo consumivel sao somados (evita linhas duplicadas no mesmo lote).
     */
    private static function receberMultiplos(PDO $pdo, array $input): never
    {
        $funcionarioId = (int)($input['funcionario_recebedor_id'] ?? 0);
        $observacoes   = self::observacoes($input);
        $usuario       = self::responsavel($input);

        $dataRaw = trim((string)($input['data_recebimento'] ?? ''));
        $dataRecebimento = preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataRaw) === 1 ? $dataRaw : null;

        $itens = $input['toners'] ?? [];
        if (is_string($itens)) {
            $decoded = json_decode($itens, true);
            $itens = is_array($decoded) ? $decoded : [];
        }
        if (!is_array($itens)) { $itens = []; }

        if ($funcionarioId <= 0) {
            Response::error('Funcionario recebedor e obrigatorio.', 422, [
                'funcionario_recebedor_id' => 'Selecione o funcionario recebedor.',
            ]);
        }

        $limpos = [];
        foreach ($itens as $item) {
            if (!is_array($item)) { continue; }
            $tonerId = (int)($item['toner_id'] ?? 0);
            $qtd     = (int)($item['quantidade'] ?? 0);
            if ($tonerId <= 0 || $qtd <= 0) { continue; }
            $limpos[$tonerId] = ($limpos[$tonerId] ?? 0) + $qtd;
        }
        if ($limpos === []) {
            Response::error('Selecione ao menos um consumivel com quantidade.', 422, [
                'toners' => 'Informe consumivel e quantidade.',
            ]);
        }

        $pdo->beginTransaction();
        try {
            $chk = $pdo->prepare('SELECT nome FROM funcionarios WHERE id = :id LIMIT 1');
            $chk->execute([':id' => $funcionarioId]);
            $recebedor = $chk->fetchColumn();
            if ($recebedor === false) {
                $pdo->rollBack();
                Response::error('Funcionario recebedor nao encontrado.', 422, [
                    'funcionario_recebedor_id' => 'Funcionario inexistente.',
                ]);
            }

            $updEstoque = $pdo->prepare('UPDATE toner SET estoque = estoque + :qtd, usuario_atualizacao = :usr, data_atualizacao = NOW()
                                         WHERE id = :id');
            $ins = $pdo->prepare('INSERT INTO recebimentos_toner
                    (toner_id, usuario_recebedor_id, data_recebimento, quantidade_recebida, nota_fiscal, fornecedor_entrada,
                     observacoes, usuario_cadastro, data_cadastro, usuario_atualizacao, data_atualizacao)
                    VALUES (:toner_id, :func, COALESCE(:data, NOW()), :qtd, NULL, NULL, :obs, :usr_cad, NOW(), :usr_upd, NOW())');

            $processados = [];
            foreach ($limpos as $tonerId => $qtd) {
                $ver = $pdo->prepare('SELECT codigo, estoque FROM toner WHERE id = :id FOR UPDATE');
                $ver->execute([':id' => $tonerId]);
                $toner = $ver->fetch();
                if (!$toner) {
                    $pdo->rollBack();
                    Response::error("Consumivel #{$tonerId} nao encontrado.", 422, [
                        'toners' => 'Ha consumivel inexistente no lote.',
                    ]);
                }

                $updEstoque->execute([':qtd' => $qtd, ':usr' => $usuario, ':id' => $tonerId]);
                $ins->execute([
                    ':toner_id' => $tonerId,
                    ':func'     => $funcionarioId,
                    ':data'     => $dataRecebimento,
                    ':qtd'      => $qtd,
                    ':obs'      => $observacoes,
                    ':usr_cad'  => $usuario,
                    ':usr_upd'  => $usuario,
                ]);

                $processados[] = [
                    'toner_id'   => $tonerId,
                    'codigo'     => $toner['codigo'],
                    'quantidade' => $qtd,
                    'estoque'    => (int)$toner['estoque'] + $qtd,
                ];
            }

            $pdo->commit();
            Audit::log($pdo, null, 'insert', 'recebimentos_toner', null, []);

            Response::success([
                'funcionario_recebedor' => $recebedor,
                'data_recebimento'      => $dataRecebimento,
                'itens'                 => $processados,
                'responsavel'           => $usuario,
            ], 'Recebimento registrado com sucesso. Estoque atualizado.');
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) { $pdo->rollBack(); }
            throw $e;
        }
    }
}

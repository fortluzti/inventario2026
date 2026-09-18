<?php
/**
 * Dashboard — KPIs, alertas e atividade (portado do legado dashboard_*.php).
 */
declare(strict_types=1);

final class Dashboard
{
    public static function kpis(PDO $pdo): never
    {
        $q = fn(string $sql) => (int)$pdo->query($sql)->fetchColumn();
        Response::success([
            'total_estacoes'  => $q('SELECT COUNT(*) FROM estacoes'),
            'total_monitores' => $q('SELECT COUNT(*) FROM monitores'),
            'total_impressoras' => $q('SELECT COUNT(*) FROM impressoras'),
            'total_nobreaks'  => $q('SELECT COUNT(*) FROM nobreaks'),
            'total_celulares' => $q('SELECT COUNT(*) FROM celulares'),
            'total_funcionarios' => $q('SELECT COUNT(*) FROM funcionarios'),
            'toners_estoque'  => $q('SELECT COALESCE(SUM(estoque),0) FROM toner'),
            'manutencoes_abertas' => $q("SELECT COUNT(*) FROM manutencoes WHERE status NOT IN ('Concluida','Cancelada','Concluída','Cancelada')"),
        ]);
    }

    public static function alertas(PDO $pdo): never
    {
        $alertas = [];
        // Toners abaixo do minimo (colunas reais: estoque / estoque_minimo)
        $stmt = $pdo->query('SELECT codigo, estoque, estoque_minimo FROM toner WHERE estoque <= estoque_minimo');
        foreach ($stmt->fetchAll() as $t) {
            $alertas[] = ['tipo' => 'toner_baixo', 'mensagem' => "Toner '{$t['codigo']}' com estoque baixo ({$t['estoque']}/{$t['estoque_minimo']})."];
        }
        // Equipamentos em manutencao (status reais: Pendente/Concluida/...)
        $count = (int)$pdo->query("SELECT COUNT(*) FROM manutencoes WHERE status NOT IN ('Concluida','Cancelada','Concluída','Cancelada')")->fetchColumn();
        if ($count > 0) {
            $alertas[] = ['tipo' => 'manutencao', 'mensagem' => "{$count} equipamento(s) em manutencao."];
        }
        Response::success($alertas);
    }

    public static function atividade(PDO $pdo): never
    {
        // Colunas reais de manutencoes (sem tipo_ativo/data_solicitacao)
        $stmt = $pdo->query(
            'SELECT m.id, m.status, m.aprovacao_status, m.problema_relatado, m.data_inicio, m.data_fim, m.data_cadastro
               FROM manutencoes m ORDER BY m.data_cadastro DESC LIMIT 20'
        );
        Response::success($stmt->fetchAll());
    }
}

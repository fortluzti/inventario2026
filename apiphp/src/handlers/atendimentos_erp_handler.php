<?php
/**
 * Atendimentos do ERP - Handler
 * Responsável pelas operações CRUD e específicas do módulo atendimentos_erp
 */
declare(strict_types=1);

require_once __DIR__ . '/../Crud.php';

class AtendimentosErpHandler extends Crud
{
    public function __construct(\PDO $pdo)
    {
        $modules = require __DIR__ . '/modules.php';
        parent::__construct($pdo, $modules['atendimentos_erp'], 'atendimentos_erp');
    }
}
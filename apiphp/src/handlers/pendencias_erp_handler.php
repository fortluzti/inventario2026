<?php
/**
 * Pendências do ERP - Handler
 * Responsável pelas operações CRUD e específicas do módulo pendencias_erp
 */
declare(strict_types=1);

require_once __DIR__ . '/../Crud.php';

class PendenciasErpHandler extends Crud
{
    public function __construct(\PDO $pdo)
    {
        $modules = require __DIR__ . '/modules.php';
        parent::__construct($pdo, $modules['pendencias_erp'], 'pendencias_erp');
    }
}
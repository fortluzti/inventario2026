<?php
/**
 * Anexos do ERP - Handler
 * Responsável pelas operações CRUD e específicas do módulo anexos_erp
 */
declare(strict_types=1);

require_once __DIR__ . '/../Crud.php';

class AnexosErpHandler extends Crud
{
    public function __construct(\PDO $pdo)
    {
        $modules = require __DIR__ . '/modules.php';
        parent::__construct($pdo, $modules['anexos_erp'], 'anexos_erp');
    }
}
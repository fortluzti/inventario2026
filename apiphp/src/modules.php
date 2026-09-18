<?php
/**
 * Registry de modulos — Mesmos endpoints do legado, mapeados por tabela.
 *
 * CAMPOS VALIDADOS CONTRA O SCHEMA REAL de `inventario2` (backup restaurado):
 *  - tabela 'toner' (singular); setores usa `ativo` (tinyint), nao `status`;
 *  - tabela 'acessorios' NAO existe neste banco — modulo removido;
 *  - funcionarios.senha_gmail propositalmente FORA da whitelist (dado sensivel).
 */
declare(strict_types=1);

return [
    'ativos_diversos' => [
        'table'   => 'ativos_diversos',
        'fields'  => [
            'codigo_patrimonio' => ['tipo' => 'string', 'max' => 50],
            'tipo_id'           => ['tipo' => 'int'],
            'marca'             => ['tipo' => 'string', 'max' => 100],
            'modelo'            => ['tipo' => 'string', 'max' => 150],
            'numero_serie'      => ['tipo' => 'string', 'max' => 100],
            'setor_id'          => ['tipo' => 'int'],
            'status'            => ['tipo' => 'string', 'max' => 50],
            'data_compra'       => ['tipo' => 'date'],
            'nota_fiscal'       => ['tipo' => 'string', 'max' => 100],
            'fornecedor_id'     => ['tipo' => 'int'],
            'empresa_id'        => ['tipo' => 'int'],
            'observacoes'       => ['tipo' => 'string', 'max' => 1000],
        ],
        'search'  => ['codigo_patrimonio', 'marca', 'modelo', 'numero_serie'],
        'filters' => ['status', 'tipo_id'],
        'code_field' => 'codigo_patrimonio',
        'code_format' => 'DIV-%03d',
    ],

    'ativos_tipos' => [
        'table'   => 'ativos_tipos',
        'fields'  => [
            'nome'      => ['tipo' => 'string', 'req' => true, 'max' => 100],
            'descricao' => ['tipo' => 'string', 'max' => 255],
        ],
        'search'  => ['nome'],
    ],

    'empresas' => [
        'table'   => 'empresas',
        'fields'  => [
            'unidade'  => ['tipo' => 'string', 'max' => 100],
            'nome'     => ['tipo' => 'string', 'req' => true, 'max' => 150],
            'cnpj'     => ['tipo' => 'string', 'max' => 20],
            'endereco' => ['tipo' => 'string', 'max' => 200],
            'telefone' => ['tipo' => 'string', 'max' => 30],
            'cidade'   => ['tipo' => 'string', 'max' => 100],
            'bairro'   => ['tipo' => 'string', 'max' => 100],
            'cep'      => ['tipo' => 'string', 'max' => 15],
        ],
        'search'  => ['nome', 'cnpj', 'unidade'],
        'dropdown' => ['table' => 'empresas', 'name_col' => 'nome'],
    ],

    'estacoes' => [
        'table'   => 'estacoes',
        // select explicito: a grid de estacoes exibe empresa, setor, responsavel e monitor.
        // A tabela principal NAO recebe alias (a coluna continua "estacoes.col")
        // para manter compativel com Crud::buscarPorId/excluir.
        'select'  =>
            'SELECT estacoes.*, '
            . 'emp.nome AS empresa_nome, emp.unidade AS empresa_unidade, '
            . 's.nome AS setor_nome, f.nome AS funcionario_nome, f.cargo AS funcionario_cargo, '
            . '(SELECT m.codigo_interno_monitor FROM monitores m WHERE m.id = estacoes.id_monitor) AS monitor_codigo, '
            . '(SELECT CONCAT_WS(" - ", m.marca, m.modelo) FROM monitores m WHERE m.id = estacoes.id_monitor) AS monitor_modelo '
            . 'FROM estacoes '
            . 'LEFT JOIN empresas emp ON emp.id = estacoes.empresa_id '
            . 'LEFT JOIN setores s ON s.id = estacoes.setor_id '
            . 'LEFT JOIN funcionarios f ON f.id = estacoes.funcionario_id',
        'fields'  => [
            'codigo_interno_estacao' => ['tipo' => 'string', 'req' => true, 'max' => 50],
            'setor_id'               => ['tipo' => 'int', 'req' => true],
            'status'                 => ['tipo' => 'string', 'req' => true, 'max' => 50],
            'ip'                     => ['tipo' => 'string', 'max' => 20],
            'processador'            => ['tipo' => 'string', 'max' => 50],
            'memoria'                => ['tipo' => 'string', 'max' => 50],
            'hd'                     => ['tipo' => 'string', 'max' => 50],
            'estado_hd'              => ['tipo' => 'string', 'max' => 50],
            'id_monitor'             => ['tipo' => 'int'],
            'acessorios'             => ['tipo' => 'string', 'max' => 100],
            'ano_compra'             => ['tipo' => 'int'],
            'data_compra'            => ['tipo' => 'date'],
            'nota_fiscal'            => ['tipo' => 'string', 'max' => 50],
            'fornecedor_id'          => ['tipo' => 'int'],
            'empresa_id'             => ['tipo' => 'int'],
            'funcionario_id'         => ['tipo' => 'int'],
        ],
        'search'  => [
            'estacoes.codigo_interno_estacao', 'estacoes.ip', 'estacoes.processador',
            'estacoes.memoria', 'estacoes.hd', 'estacoes.nota_fiscal',
            'emp.nome', 'emp.unidade', 's.nome', 'f.nome',
        ],
        // 'setor_id' tambem existe em funcionarios (join) -> filtro com coluna qualificada
        'filters' => ['estacoes.status' => 'status', 'estacoes.empresa_id' => 'empresa_id', 'estacoes.funcionario_id' => 'funcionario_id', 'estacoes.setor_id' => 'setor_id'],
        'order'   => 'ORDER BY estacoes.id DESC',
        'code_field'  => 'codigo_interno_estacao',
        'code_format' => 'EST-%03d',
    ],


    'fornecedores' => [
        'table'   => 'fornecedores',
        'fields'  => [
            'nome'          => ['tipo' => 'string', 'req' => true, 'max' => 150],
            'cnpj'          => ['tipo' => 'string', 'max' => 20],
            'telefone'      => ['tipo' => 'string', 'max' => 30],
            'endereco'      => ['tipo' => 'string', 'max' => 200],
            'tipo'          => ['tipo' => 'string', 'max' => 50],
            'nome_vendedor' => ['tipo' => 'string', 'max' => 100],
            'email'         => ['tipo' => 'email', 'max' => 150],
        ],
        'search'  => ['nome', 'cnpj', 'nome_vendedor'],
        'dropdown' => ['table' => 'fornecedores', 'name_col' => 'nome'],
    ],

    'funcionarios' => [
        'table'   => 'funcionarios',
        'fields'  => [
            'nome'     => ['tipo' => 'string', 'req' => true, 'max' => 150],
            'cargo'    => ['tipo' => 'string', 'max' => 100],
            'setor'    => ['tipo' => 'string', 'max' => 100],
            'setor_id' => ['tipo' => 'int'],
            'rg'       => ['tipo' => 'string', 'max' => 30],
            'email'    => ['tipo' => 'email', 'max' => 150],
            'gmail'    => ['tipo' => 'email', 'max' => 150],
        ],
        'search'  => ['nome', 'cargo'],
        'filters' => ['setor_id'],
    ],

    'impressoras' => [
        'table'   => 'impressoras',
        'select'  =>
            'SELECT impressoras.*, '
            . 'im.nome_modelo AS modelo_nome, im.marca AS modelo_marca, '
            . 's.nome AS setor_nome, emp.nome AS empresa_nome, emp.unidade AS empresa_unidade '
            . 'FROM impressoras '
            . 'LEFT JOIN impressora_modelos im ON im.id = impressoras.modelo_id '
            . 'LEFT JOIN setores s ON s.id = impressoras.setor_id '
            . 'LEFT JOIN empresas emp ON emp.id = impressoras.empresa_id',
        'fields'  => [
            'modelo_id'     => ['tipo' => 'int'],
            'numero_serie'  => ['tipo' => 'string', 'max' => 100],
            'setor_id'      => ['tipo' => 'int'],
            'ano_compra'    => ['tipo' => 'int'],
            'status'        => ['tipo' => 'string', 'max' => 50],
            'data_compra'   => ['tipo' => 'date'],
            'nota_fiscal'   => ['tipo' => 'string', 'max' => 100],
            'fornecedor_id' => ['tipo' => 'int'],
            'empresa_id'    => ['tipo' => 'int'],
        ],
        'search'  => [
            'impressoras.codigo_interno_impressora', 'impressoras.numero_serie',
            'im.nome_modelo', 'im.marca',
            's.nome', 'emp.nome', 'emp.unidade',
        ],
        'filters' => ['impressoras.status' => 'status', 'impressoras.setor_id' => 'setor_id', 'impressoras.modelo_id' => 'modelo_id'],
        'order'   => 'ORDER BY impressoras.id DESC',
        'code_field' => 'codigo_interno_impressora',
        'code_format' => 'IMP-%03d',
        'dropdown' => ['table' => 'impressoras', 'name_col' => 'codigo_interno_impressora'],
    ],

    'impressoras_modelos' => [
        'table'   => 'impressora_modelos',
        'fields'  => [
            'nome_modelo' => ['tipo' => 'string', 'req' => true, 'max' => 150],
            'marca'       => ['tipo' => 'string', 'max' => 100],
            'descricao'   => ['tipo' => 'string', 'max' => 255],
        ],
        'search'  => ['nome_modelo', 'marca'],
    ],

    'monitores' => [
        'table'   => 'monitores',
        'select'  =>
            'SELECT monitores.*, '
            . 'emp.nome AS empresa_nome, emp.unidade AS empresa_unidade '
            . 'FROM monitores '
            . 'LEFT JOIN empresas emp ON emp.id = monitores.empresa_id',
        'fields'  => [
            'marca'         => ['tipo' => 'string', 'req' => true, 'max' => 100],
            'modelo'        => ['tipo' => 'string', 'req' => true, 'max' => 150],
            'numero_serie'  => ['tipo' => 'string', 'req' => true, 'max' => 100],
            'status'        => ['tipo' => 'string', 'max' => 50],
            'data_compra'   => ['tipo' => 'date'],
            'nota_fiscal'   => ['tipo' => 'string', 'max' => 100],
            'fornecedor_id' => ['tipo' => 'int'],
            'empresa_id'    => ['tipo' => 'int'],
            'portas'        => ['tipo' => 'string', 'max' => 100],
        ],
        'search'  => [
            'monitores.codigo_interno_monitor', 'monitores.numero_serie', 'monitores.marca', 'monitores.modelo',
            'emp.nome', 'emp.unidade',
        ],
        'filters' => ['monitores.status' => 'status', 'monitores.empresa_id' => 'empresa_id'],
        'code_field' => 'codigo_interno_monitor',
        'code_format' => 'MON-%03d',
    ],

    'nobreaks' => [
        'table'   => 'nobreaks',
        'fields'  => [
            'marca'              => ['tipo' => 'string', 'max' => 100],
            'potencia'           => ['tipo' => 'string', 'max' => 50],
            'quantidade_bateria' => ['tipo' => 'int'],
            'numero_serie'       => ['tipo' => 'string', 'max' => 100],
            'setor_id'           => ['tipo' => 'int'],
            'status'             => ['tipo' => 'string', 'max' => 50],
            'data_compra'        => ['tipo' => 'date'],
            'nf'                 => ['tipo' => 'string', 'max' => 100],
            'fornecedor_id'      => ['tipo' => 'int'],
            'empresa_id'         => ['tipo' => 'int'],
        ],
        'search'  => ['codigo_interno_nobreak', 'numero_serie', 'marca'],
        'filters' => ['status'],
        'code_field' => 'codigo_interno_nobreak',
        'code_format' => 'NB-%03d',
    ],

    'setores' => [
        'table'   => 'setores',
        'fields'  => [
            'nome'      => ['tipo' => 'string', 'req' => true, 'max' => 100],
            'descricao' => ['tipo' => 'string', 'max' => 255],
            'ativo'     => ['tipo' => 'int'],
        ],
        'search'  => ['nome'],
        'filters' => ['ativo'],
        'dropdown' => ['table' => 'setores', 'name_col' => 'nome', 'where' => 'ativo = 1'],
    ],

    'softwares' => [
        'table'   => 'softwares',
        'fields'  => [
            'nome'         => ['tipo' => 'string', 'req' => true, 'max' => 150],
            'numero_serie' => ['tipo' => 'string', 'max' => 200],
            'observacao'   => ['tipo' => 'string', 'max' => 1000],
        ],
        'search'  => ['nome', 'numero_serie'],
    ],

    'toners' => [
        'table'   => 'toner',
        'fields'  => [
            'codigo'         => ['tipo' => 'string', 'req' => true, 'max' => 100],
            'estoque'        => ['tipo' => 'int'],
            'estoque_minimo' => ['tipo' => 'int'],
            'autonomia'      => ['tipo' => 'int'],
            'data_compra'    => ['tipo' => 'date'],
            'nota_fiscal'    => ['tipo' => 'string', 'max' => 100],
            'fornecedor_id'  => ['tipo' => 'int'],
            'empresa_id'     => ['tipo' => 'int'],
        ],
        'search'  => ['codigo'],
    ],
];

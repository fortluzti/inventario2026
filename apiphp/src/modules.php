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
            // Limits espelham o schema real (inventario2): nome varchar(100),
            // telefone varchar(20), email varchar(100), cnpj varchar(20).
            'nome'          => ['tipo' => 'string', 'req' => true, 'max' => 100],
            'cnpj'          => ['tipo' => 'string', 'max' => 20],
            'telefone'      => ['tipo' => 'string', 'max' => 20],
            'endereco'      => ['tipo' => 'string', 'max' => 200],
            // Coluna SET NOT NULL: 'Fornecedor de Produtos' | 'Prestador de Servicos'.
            'tipo'          => ['tipo' => 'string', 'req' => true, 'max' => 50],
            'nome_vendedor' => ['tipo' => 'string', 'max' => 100],
            'email'         => ['tipo' => 'email', 'max' => 100],
            // Status Ativo/Inativo: padrao do projeto (setores/funcionarios). 1=Ativo, 0=Inativo.
            'ativo'         => ['tipo' => 'int'],
        ],
        'search'  => ['nome', 'cnpj', 'nome_vendedor'],
        'filters' => ['ativo'],
        // Whitelist de ordenacao: chave amigavel enviada pelo frontend => coluna SQL.
        // O backend so aceita chaves deste mapa (nunca concatena input no SQL).
        'sortable' => [
            'nome'          => 'fornecedores.nome',
            'cnpj'          => 'fornecedores.cnpj',
            'telefone'      => 'fornecedores.telefone',
            'tipo'          => 'fornecedores.tipo',
            'nome_vendedor' => 'fornecedores.nome_vendedor',
            'email'         => 'fornecedores.email',
            'status'        => 'fornecedores.ativo',
        ],
        // Exclusao fisica apenas sem historico: as tabelas abaixo possuem FK para
        // fornecedores (todas ON DELETE SET NULL no inventario2) — apagar o
        // fornecedor zeraria o vinculo e quebraria o historico. Com vinculos, a
        // acao correta e inativar (ativo = 0). Ver Crud::excluir().
        'delete_check' => [
            ['table' => 'estacoes',              'column' => 'fornecedor_id', 'label' => 'estacoes de trabalho'],
            ['table' => 'monitores',             'column' => 'fornecedor_id', 'label' => 'monitores'],
            ['table' => 'impressoras',           'column' => 'fornecedor_id', 'label' => 'impressoras'],
            ['table' => 'celulares',             'column' => 'fornecedor_id', 'label' => 'celulares'],
            ['table' => 'nobreaks',              'column' => 'fornecedor_id', 'label' => 'nobreaks'],
            ['table' => 'toner',                 'column' => 'fornecedor_id', 'label' => 'toners'],
            ['table' => 'ativos_diversos',       'column' => 'fornecedor_id', 'label' => 'ativos diversos'],
            ['table' => 'manutencoes',           'column' => 'fornecedor_id', 'label' => 'manutencoes'],
            ['table' => 'manutencao_orcamentos', 'column' => 'fornecedor_id', 'label' => 'orcamentos'],
        ],
        'dropdown' => ['table' => 'fornecedores', 'name_col' => 'nome', 'where' => 'ativo = 1'],
    ],

    'funcionarios' => [
        'table'   => 'funcionarios',
        'select'  =>
            'SELECT funcionarios.*, '
            . 's.nome AS setor_nome '
            . 'FROM funcionarios '
            . 'LEFT JOIN setores s ON s.id = funcionarios.setor_id',
        'fields'  => [
            'nome'     => ['tipo' => 'string', 'req' => true, 'max' => 150],
            'cargo'    => ['tipo' => 'string', 'max' => 100],
            'setor'    => ['tipo' => 'string', 'max' => 100],
            'setor_id' => ['tipo' => 'int'],
            'rg'       => ['tipo' => 'string', 'max' => 30],
            'email'    => ['tipo' => 'email', 'max' => 150],
            'gmail'    => ['tipo' => 'email', 'max' => 150],
            // Status Ativo/Inativo: padrão do projeto (setores). 1=Ativo, 0=Inativo.
            'ativo'    => ['tipo' => 'int'],
        ],
        'search'  => ['funcionarios.nome', 'funcionarios.cargo', 's.nome'],
        'filters' => ['setor_id', 'funcionarios.ativo' => 'ativo'],
        // Whitelist de ordenacao: chave amigavel enviada pelo frontend => coluna SQL
        // ja qualificada. O backend so aceita chaves deste mapa (nunca concatena
        // input do cliente no SQL). 'setor' ordena pelo nome via JOIN (s.nome).
        'sortable' => [
            'nome'   => 'funcionarios.nome',
            'cargo'  => 'funcionarios.cargo',
            'setor'  => 's.nome',
            'rg'     => 'funcionarios.rg',
            'email'  => 'funcionarios.email',
            'status' => 'funcionarios.ativo',
        ],
        'dropdown' => ['table' => 'funcionarios', 'name_col' => 'nome', 'where' => 'ativo = 1'],
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
              'nome_modelo'          => ['tipo' => 'string', 'req' => true, 'max' => 150],
              'marca'                => ['tipo' => 'string', 'max' => 100],
              'descricao'            => ['tipo' => 'string', 'max' => 255],
              'estoque_minimo_toner' => ['tipo' => 'int', 'req' => true],
              'estoque_minimo_cilindro'=> ['tipo' => 'int', 'req' => true],
          ],
          'search'  => ['nome_modelo', 'marca'],
      ],

    // Tabela de juncao modelo x consumivel (migration 006_impressora_modelos_toner.sql).
    // O TIPO (TONER/CILINDRO) NUNCA e informado aqui: sempre vem de `toner.tipo`
    // (cadastro do consumivel) — exposto apenas para leitura via JOIN (toner_tipo).
    // 'audit_columns' => false: a tabela da 006 nao tem data_cadastro/data_atualizacao.
    'impressora_modelos_toner' => [
          'table'   => 'impressora_modelos_toner',
          'select'  =>
              'SELECT impressora_modelos_toner.*, '
              . 't.codigo AS toner_codigo, t.tipo AS toner_tipo, t.estoque AS toner_estoque, '
              . 'im.nome_modelo AS modelo_nome, im.marca AS modelo_marca '
              . 'FROM impressora_modelos_toner '
              . 'INNER JOIN toner t ON t.id = impressora_modelos_toner.toner_id '
              . 'LEFT JOIN impressora_modelos im ON im.id = impressora_modelos_toner.modelo_id',
          'fields'  => [
              'modelo_id' => ['tipo' => 'int', 'req' => true],
              'toner_id'  => ['tipo' => 'int', 'req' => true],
          ],
          'search'  => [],
          'filters' => [
              'impressora_modelos_toner.modelo_id' => 'modelo_id',
              'impressora_modelos_toner.toner_id'  => 'toner_id',
          ],
          'order'         => 'ORDER BY impressora_modelos_toner.id ASC',
          'audit_columns' => false,
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
          // `modelos_compat` agrega, em UMA linha por consumivel, os modelos de
          // impressora compativeis (relacao impressora_modelos_toner, migration 006).
          // Evita N+1 e NAO duplica o consumivel quando ele combina com varios modelos.
          'select'  =>
              "SELECT toner.*, "
              . "(SELECT GROUP_CONCAT(CONCAT_WS(' ', NULLIF(im.marca, ''), NULLIF(im.nome_modelo, '')) "
              . "ORDER BY im.nome_modelo SEPARATOR ', ') "
              . "FROM impressora_modelos_toner r "
              . "INNER JOIN impressora_modelos im ON im.id = r.modelo_id "
              . "WHERE r.toner_id = toner.id) AS modelos_compat "
              . "FROM toner",
          'fields'  => [
              'codigo'         => ['tipo' => 'string', 'req' => true, 'max' => 100],
              'tipo'           => ['tipo' => 'string', 'req' => true, 'enum' => ['TONER','CILINDRO']],
              'estoque'        => ['tipo' => 'int'],
              'estoque_minimo' => ['tipo' => 'int'],
              'autonomia'      => ['tipo' => 'int'],
              // Valor unitário do consumível (migration 007_toner_valor.sql).
              // Cadastro p/ futuro histórico financeiro — fora de qualquer
              // solicitação/pedido de compra e de cálculos de estoque.
              'valor'          => ['tipo' => 'decimal'],
              'data_compra'    => ['tipo' => 'date'],
              'nota_fiscal'    => ['tipo' => 'string', 'max' => 100],
              'fornecedor_id'  => ['tipo' => 'int'],
              'empresa_id'     => ['tipo' => 'int'],
          ],
          'search'  => ['codigo'],
          // Filtro TONER/CILINDRO (toner.tipo continua determinando a classificacao).
          'filters' => ['tipo' => 'tipo'],
          // Filtro "Modelo da impressora": retorna SOMENTE os consumiveis (TONER ou
          // CILINDRO, mesma regra) vinculados ao modelo via impressora_modelos_toner.
          // EXISTS garante uma unica linha por consumivel mesmo com N modelos.
          'filter_exists' => [
              'modelo_id' => ['table' => 'impressora_modelos_toner', 'column' => 'toner_id', 'ref' => 'modelo_id'],
          ],
          // Lista simples (id + codigo) para selects/filtros — ex.: filtro
          // "Consumivel" do Historico de Trocas e do Recebimento de Toners.
          'dropdown' => ['table' => 'toner', 'name_col' => 'codigo'],
      ],

    'celulares' => [
        'table'   => 'celulares',
        'select'  =>
            'SELECT celulares.*, '
            . 'f.nome AS nome_usuario, '
            . 'f.email AS email_usuario, '
            . 'cf.data_entrega AS data_ultima_entrega '
            . 'FROM celulares '
            . 'LEFT JOIN (SELECT cf1.* FROM celulares_funcionarios cf1 '
            . 'INNER JOIN (SELECT celular_id, MAX(id) AS max_id FROM celulares_funcionarios '
            . 'WHERE data_desassociacao IS NULL GROUP BY celular_id) cf2 '
            . 'ON cf2.celular_id = cf1.celular_id AND cf2.max_id = cf1.id) cf '
            . 'ON cf.celular_id = celulares.id '
            . 'LEFT JOIN funcionarios f ON f.id = cf.usuario_id',
        'fields'  => [
            'marca'          => ['tipo' => 'string', 'req' => true, 'max' => 100],
            'modelo'         => ['tipo' => 'string', 'req' => true, 'max' => 150],
            'imei'           => ['tipo' => 'string', 'req' => true, 'max' => 50, 'unique' => true],
            'serial'         => ['tipo' => 'string', 'max' => 100],
            'numero'         => ['tipo' => 'string', 'max' => 30],
            'status'         => ['tipo' => 'string', 'max' => 20,
                'values' => ['Em Estoque' => 'Em Estoque', 'Em Uso' => 'Em Uso', 'Danificado' => 'Danificado']],
            'data_compra'    => ['tipo' => 'date'],
            'nota_fiscal'    => ['tipo' => 'string', 'max' => 100],
            'fornecedor_id'  => ['tipo' => 'int'],
            'empresa_id'     => ['tipo' => 'int'],
        ],
        'search'  => ['celulares.codigo_interno_celular', 'celulares.marca', 'celulares.modelo',
            'celulares.imei', 'celulares.serial', 'celulares.numero', 'f.nome', 'f.email'],
        'filters' => ['celulares.status' => 'status'],
        'sortable' => [
            'codigo'        => 'celulares.codigo_interno_celular',
            'marca'         => 'celulares.marca',
            'numero'        => 'celulares.numero',
            'status'        => 'celulares.status',
            'nome_usuario'  => 'nome_usuario',
            'email_usuario' => 'email_usuario',
        ],
        'code_field' => 'codigo_interno_celular',
        'code_format' => 'CEL-%03d',
        'dropdown' => ['table' => 'celulares', 'name_col' => 'codigo_interno_celular'],
    ],
];

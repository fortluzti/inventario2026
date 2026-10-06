<?php

return [
    'table'   => 'anexos_erp',
    'fields'  => [
        'pendencia_id'   => ['tipo' => 'int', 'req' => true],
        'nome_arquivo'   => ['tipo' => 'string', 'req' => true, 'max' => 255],
        'tipo_arquivo'   => ['tipo' => 'string', 'req' => true, 'max' => 50],
        'caminho'        => ['tipo' => 'string', 'req' => true, 'max' => 500],
        'tamanho_bytes'  => ['tipo' => 'int'],
        'hash_sha256'    => ['tipo' => 'string', 'max' => 64],
        'usuario_id'     => ['tipo' => 'int'],
        'enviado_ao_suporte' => ['tipo' => 'int', 'default' => 0],
    ],
    'search'  => ['nome_arquivo'],
    'filters' => ['pendencia_id', 'enviado_ao_suporte'],
    'order'   => 'ORDER BY anexos_erp.data_cadastro DESC',
];
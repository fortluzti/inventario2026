<?php

return [
    'table'   => 'atendimentos_erp',
    'fields'  => [
        'pendencia_id'   => ['tipo' => 'int', 'req' => true],
        'usuario_id'     => ['tipo' => 'int', 'req' => true],
        'metodo_envio'   => ['tipo' => 'string', 'req' => true, 'max' => 50],
        'destinatario'   => ['tipo' => 'string', 'max' => 200],
        'contato'        => ['tipo' => 'string', 'max' => 100],
        'protocolo'      => ['tipo' => 'string', 'max' => 100],
        'observacoes'    => ['tipo' => 'string', 'max' => 2000],
        'anexos_ids'     => ['tipo' => 'string', 'max' => 500],
    ],
    'search'  => ['destinatario', 'protocolo'],
    'filters' => ['pendencia_id', 'usuario_id'],
    'order'   => 'ORDER BY data_cadastro DESC',
];
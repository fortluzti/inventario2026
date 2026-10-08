<?php

return [
    'table'   => 'atendimentos_erp',
    'fields'  => [
        'pendencia_id'   => ['tipo' => 'int', 'req' => true],
        'usuario_id'     => ['tipo' => 'int', 'req' => true],
        'metodo_envio'   => ['tipo' => 'string', 'req' => true, 'max' => 50],
        'tipo_atendimento' => ['tipo' => 'string', 'req' => true, 'max' => 50],
        'versao_sistema' => ['tipo' => 'string', 'max' => 50],
        'destinatario'   => ['tipo' => 'string', 'max' => 200],
        'contato'        => ['tipo' => 'string', 'max' => 100],
        'protocolo'      => ['tipo' => 'string', 'max' => 100],
        'status_anterior' => ['tipo' => 'string', 'max' => 50],
        'status_novo'     => ['tipo' => 'string', 'max' => 50],
        'observacoes'    => ['tipo' => 'string', 'max' => 2000],
        'anexos_ids'     => ['tipo' => 'string', 'max' => 500],
    ],
    'search'  => ['destinatario', 'protocolo', 'observacoes'],
    'filters' => ['pendencia_id', 'usuario_id', 'tipo_atendimento'],
    'order'   => 'ORDER BY data_cadastro ASC, id ASC',
];

-- 013 — Ampliar os estados de pendências para o fluxo de suporte e testes.
-- Mantém os estados antigos durante a transição para preservar registros existentes.
ALTER TABLE `pendencias_erp`
    MODIFY `status` ENUM(
        'Pendente',
        'Enviado ao suporte',
        'Em análise',
        'Aguardando correção/atualização',
        'Pronto para testes',
        'Em teste',
        'Resolvido',
        'Cancelado',
        'Aguardando Suporte',
        'Aguardando Testes',
        'Testando'
    ) NOT NULL DEFAULT 'Pendente';

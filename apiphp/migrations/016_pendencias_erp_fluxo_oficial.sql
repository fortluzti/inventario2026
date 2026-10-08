-- 016 — Fluxo oficial de Pendencias do ERP.
--
-- Status oficiais a partir desta migracao:
--   'Aguardando suporte'  -> pendencia aberta / aguardando acao do suporte
--   'Aguardando testes'   -> suporte respondeu ou corrigiu; aguarda teste interno
--   'Resolvido'           -> somente teste interno aprovado
--   'Cancelado'           -> ja existia; preservado
--
-- Os status intermediarios antigos (Pendente, Enviado ao suporte, Em análise,
-- Aguardando correção/atualização, Pronto para testes, Em teste, Testando)
-- deixam de ser status principal do chamado. Eles continuam preservados como
-- EVENTOS no historico, em atendimentos_erp.status_anterior / status_novo.
--
-- Regras de seguranca desta migracao (nao reescreve a 013, que e imutavel):
--   * MySQL utf8mb4_0900_ai_ci REJEITA membros de ENUM que diferem apenas em
--     maiusculas/minusculas (erro 1291: duplicated value in ENUM). Por isso os
--     membros 'Aguardando Suporte' e 'Aguardando Testes' sao SUBSTITUIDOS pelos
--     equivalentes oficiais, e nao duplicados.
--   * `ALTER ... MODIFY` reencoda os valores ja gravados pelo TEXTO (nao pelo
--     indice), entao a reordenação abaixo nao altera o significado dos dados.
--   * Fase 1: tira de circulacao os membros que serao renomeados (case antigo).
--   * Fase 2: nova definicao com os membros oficiais + legados ainda em uso.
--   * Fase 3: normaliza o status atual de cada pendencia para o fluxo oficial.
--   * Fase 4: remove os membros legados ja sem uso, restando apenas os 4
--     status oficiais — o proprio banco passa a impedir status fora do fluxo.

-- Fase 1 (dados nos membros que serao renomeados) -----------------------------
UPDATE `pendencias_erp` SET `status` = 'Enviado ao suporte' WHERE `status` = 'Aguardando Suporte';
UPDATE `pendencias_erp` SET `status` = 'Pronto para testes' WHERE `status` = 'Aguardando Testes';

-- Fase 2 (definicao com membros oficiais em minusculas) -----------------------
ALTER TABLE `pendencias_erp`
    MODIFY `status` ENUM(
        'Aguardando suporte',
        'Aguardando testes',
        'Resolvido',
        'Cancelado',
        'Pendente',
        'Enviado ao suporte',
        'Em análise',
        'Aguardando correção/atualização',
        'Pronto para testes',
        'Em teste',
        'Testando'
    ) NOT NULL DEFAULT 'Aguardando suporte';

-- Fase 3 (status atual das pendencias ja existentes) --------------------------
UPDATE `pendencias_erp`
   SET `status` = 'Aguardando suporte'
 WHERE `status` IN ('Pendente', 'Enviado ao suporte', 'Em análise', 'Aguardando correção/atualização');

UPDATE `pendencias_erp`
   SET `status` = 'Aguardando testes'
 WHERE `status` IN ('Pronto para testes', 'Em teste', 'Testando');

-- Fase 4 (apenas os status oficiais permanecem no ENUM) -----------------------
ALTER TABLE `pendencias_erp`
    MODIFY `status` ENUM(
        'Aguardando suporte',
        'Aguardando testes',
        'Resolvido',
        'Cancelado'
    ) NOT NULL DEFAULT 'Aguardando suporte';

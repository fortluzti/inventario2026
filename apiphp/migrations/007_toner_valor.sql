-- Preparação para o futuro histórico financeiro: valor unitário do consumível.
-- Padrão monetário já usado no banco: DECIMAL(10,2) (ex.: manutencao_servicos.valor_unitario).
-- Coluna apenas de cadastro: NÃO participa do cálculo de estoque mínimo e NÃO
-- altera a classificação TONER/CILINDRO. Por padrão não deve ser enviada a
-- futuras solicitações/pedidos de compra (WhatsApp, PDF, impressão ou texto).
ALTER TABLE `toner`
  ADD COLUMN `valor` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `nota_fiscal`;


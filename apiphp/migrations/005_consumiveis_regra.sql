-- Adicionar campo tipo na tabela toner
ALTER TABLE `toner` 
ADD COLUMN `tipo` ENUM('TONER','CILINDRO') NOT NULL DEFAULT 'TONER' AFTER `codigo`;

-- Adicionar campos de estoque mínimo na tabela impressora_modelos
ALTER TABLE `impressora_modelos` 
ADD COLUMN `estoque_minimo_toner` INT NOT NULL DEFAULT 0 AFTER `descricao`,
ADD COLUMN `estoque_minimo_cilindro` INT NOT NULL DEFAULT 0 AFTER `estoque_minimo_toner`;
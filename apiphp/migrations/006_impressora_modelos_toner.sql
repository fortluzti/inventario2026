-- Tabela de associação entre modelos de impressoras e consumíveis (toner)
CREATE TABLE IF NOT EXISTS `impressora_modelos_toner` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `modelo_id` INT NOT NULL,
  `toner_id` INT NOT NULL,
  `data_associacao` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_modelo_toner` (`modelo_id`, `toner_id`),
  FOREIGN KEY (`modelo_id`) REFERENCES `impressora_modelos` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`toner_id`) REFERENCES `toner` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

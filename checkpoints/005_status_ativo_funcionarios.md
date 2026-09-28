# Checkpoint: Status Ativo/Inativo em Funcionários e preparação de Fornecedores

- **Data**: 22/09/2026
- **Status**: Concluído (php -l OK; Build Vite 100% OK).
- **Regra de negócio**: registros não são excluídos fisicamente por deixarem de ser utilizados. O campo `ativo` (TINYINT(1) NOT NULL DEFAULT 1) preserva o histórico: 1 = Ativo, 0 = Inativo.

## Alterações

1. **Migração** — `apiphp/migrations/003_funcionarios_fornecedores_ativo.sql`: adiciona coluna `ativo` + índice (`idx_funcionarios_ativo`, `idx_fornecedores_ativo`) em `funcionarios` e `fornecedores`, com backfill para 1.
2. **Registry (`apiphp/src/modules.php`)**:
   - Campo `ativo` (`tipo int`) nos módulos `funcionarios` e `fornecedores`;
   - Filtro de listagem: `'funcionarios.ativo' => 'ativo'` (coluna qualificada por causa do JOIN com setores) e `'ativo'` em fornecedores;
   - `dropdown` de ambos restringe a `where: 'ativo = 1'` (selects não exibem inativos).
3. **Auto-schema (`handlers/configuracoes.php`)**: criação/alteração da coluna `ativo` como `TINYINT(1) NOT NULL DEFAULT 1` (padrão do projeto, igual a setores), ignorando a regra genérica de INT/VARCHAR.
4. **Frontend**:
   - `Funcionarios.jsx`: filtro "Status" (Ativos por padrão), indicador de filtro ativo no botão "Filtros", coluna "Status" na tabela com badge;
   - `FuncionarioDialog.jsx`: checkbox "Ativo" na edição e badge na visualização;
   - `api/funcionarios.js`: `ativo: 1` no payload e nas listagens de opções;
   - `api/estacoes.js`: selects de funcionário/fornecedor só carregam ativos;
   - `Funcionarios.css` / `index.css`: badges `.func-status.active/.inactive` e tokens `--in-use`/`--discarded` (mesmo padrão visual de Setores).

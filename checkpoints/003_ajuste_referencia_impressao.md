# Checkpoint: Ajuste do Modelo Mestre de Relatórios com base na Referência Visual e Correção da Impressão

- **Data**: 18/09/2026
- **Ações**:
  1. Adequar layout do Visualizador e do Documento A4 à imagem de referência oficial `ux/exemplo_relatorio.png`.
  2. Implementar barra superior de duas linhas (Linha 1: Título e Ações CSV/Imprimir/Fechar; Linha 2: Filtros com Status, Empresa, Marca, Modelo, Período Compra e botões Aplicar/Limpar).
  3. Corrigir problema de impressão (@media print) usando React Portal (`createPortal` para `document.body`) e isolamento no `@media print` para garantir que as folhas A4 sejam impressas com todo o conteúdo e sem elementos de tela.
  4. Implementar cabeçalhos, metadados azuis suaves, badges de status pill e paginação contínua idênticos à referência visual.

# Modelo Mestre Definitivo de Relatórios — Inventário FortLuz ERP

Este módulo define a arquitetura, o padrão visual e de interação oficial para todos os relatórios do sistema **Inventário FortLuz**.

## 1. Separação de Conceitos

* **Interface do Visualizador (`ReportViewer`)**: Toolbar fixa no topo (ícone, título, filtros dinâmicos, ações de Exportar CSV, Imprimir/PDF e Fechar) com fundo desfocado/escurecido e rolagem vertical. Nunca aparece na impressão (`no-print`).
* **Documento do Relatório (`ReportDocument`)**: Folhas A4 regulamentares (`794px` x `1123px`, 210mm x 297mm) com margem interna de `38px`, cabeçalho institucional, título, metadados, filtros, resumo executivo, tabela dinâmica e rodapé com numeração real de páginas.

---

## 2. Estrutura dos Componentes

```text
src/components/report/
├── index.js                  # Ponto central de exportação dos componentes e utilitários
├── reportUtils.js            # Formatação, paginação inteligente, exportação CSV e impressão PDF
├── ReportViewer.css          # Design system completo de cores, tipografia, A4 e @media print
├── ReportViewer.jsx          # Visualizador mestre de tela (Toolbar + Canvas + A4)
├── ReportDocument.jsx        # Orquestrador de páginas A4 reais e multipáginas
├── ReportHeader.jsx          # Cabeçalho institucional (Pág 1) e cabeçalho compacto de continuação (Págs 2+)
├── ReportTitle.jsx           # Título, código, descrição e metadados
├── ReportFilters.jsx         # Faixa de chips de filtros aplicados no documento A4
├── ReportSummary.jsx         # Cards executivos de totais e distribuição percentual
├── ReportTable.jsx           # Tabela de dados dinâmica (JetBrains Mono, badges, alinhamentos)
├── ReportFooter.jsx          # Rodapé oficial com "Página X de Y" e dados de emissão
├── ReportLoadingState.jsx    # Estado de carregamento regulamentar na folha A4
├── ReportEmptyState.jsx      # Estado vazio com orientações regulamentares
├── ReportErrorState.jsx      # Estado de erro com botão "Tentar novamente"
└── ReportShowcase.jsx        # Demonstração completa interativa (3 páginas A4, filtros e estados)
```

---

## 3. Como Utilizar em um Novo Relatório

```jsx
import { ReportViewer } from './components/report/index.js'

export default function MeuModuloReport({ empresa, onClose }) {
  // Definição das colunas
  const columns = [
    { key: 'codigo', label: 'Código', width: '90px', isCode: true },
    { key: 'descricao', label: 'Descrição', width: '200px', isStrong: true },
    { key: 'categoria', label: 'Categoria', width: '100px', isMuted: true },
    { key: 'status', label: 'Status', width: '90px' }, // badges automáticos
    { 
      key: 'valor', 
      label: 'Valor (R$)', 
      width: '90px', 
      align: 'right', 
      isMono: true,
      render: (row) => row.valor ? row.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'
    }
  ]

  return (
    <ReportViewer
      empresa={empresa}
      title="Relatório de Ativos de Exemplo"
      subtitle="Demonstrativo consolidado de equipamentos do inventário corporativo."
      reportCode="FL-REL-2026-EXEMPLO"
      filters={[{ label: 'Status', value: 'Em Uso' }]}
      columns={columns}
      rows={dados}
      loading={loading}
      error={error}
      onRetry={recarregarDados}
      onClose={onClose}
    />
  )
}
```

---

## 4. Recursos Nativos Disponíveis

1. **Multipáginas Automático**: Quebra dinâmica de folhas A4 com cabeçalho institucional completo na primeira página e cabeçalho compacto de continuação nas páginas seguintes.
2. **Repetição de Cabeçalho da Tabela**: Todas as páginas repetem o `thead` automaticamente para perfeita leitura.
3. **Numeração Real de Páginas**: "Página 1 de 3", "Página 2 de 3", "Página 3 de 3".
4. **Exportação CSV**: Codificação UTF-8 com BOM (`\uFEFF`) e separador `;` para compatibilidade total com Microsoft Excel no Windows.
5. **Impressão / PDF Automático**: Atribui o nome do relatório ao título da janela para nomear o PDF automaticamente ao imprimir (`Ctrl+P` ou botão).

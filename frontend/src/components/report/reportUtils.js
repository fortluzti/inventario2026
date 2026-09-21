/**
 * Utilitários padronizados para o Modelo Mestre de Relatórios FortLuz
 */

/**
 * Formata data no padrão brasileiro DD/MM/AAAA
 */
export function formatDate(dateStr) {
  if (!dateStr) return '–'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('pt-BR')
}

/**
 * Formata data e hora no padrão DD/MM/AAAA HH:MM:SS
 */
export function formatDateTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '–'
  const data = d.toLocaleDateString('pt-BR')
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return `${data} às ${hora}`
}

/**
 * Formata valor monetário em Real (R$ 1.234,56)
 */
export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '–'
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
  if (Number.isNaN(num)) return String(value)
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Formata valor genérico para exibição em célula
 */
export function formatValue(value) {
  if (value === null || value === undefined || value === '') return '–'
  return value
}

/**
 * Mapeamento de status para classes de estilo visual
 */
export const STATUS_VARIANT_MAP = {
  'Em Uso': 'in-use',
  'Operacional': 'in-use',
  'Ativo': 'in-use',
  'Em Estoque': 'in-stock',
  'Disponível': 'in-stock',
  'Reserva': 'in-stock',
  'Em Manutenção': 'maintenance',
  'Manutenção': 'maintenance',
  'Em Reparo': 'maintenance',
  'Danificado': 'damaged',
  'Com Defeito': 'damaged',
  'Crítico': 'damaged',
  'Descartado': 'discarded',
  'Baixado': 'discarded',
  'Inativo': 'discarded',
}

/**
 * Exporta dados tabulares para arquivo CSV com BOM UTF-8 (compatível com Excel no Windows)
 */
export function exportReportToCsv({ reportTitle = 'Relatorio', columns = [], rows = [], filename }) {
  const dateStr = new Date().toISOString().slice(0, 10)
  const defaultFilename = filename || `${reportTitle.replace(/[^a-zA-Z0-9À-ÿ_-]/g, '_')}_${dateStr}.csv`

  const headers = columns.map(c => `"${String(c.label || '').replace(/"/g, '""')}"`)
  const csvLines = [headers.join(';')]

  rows.forEach(row => {
    const line = columns.map(col => {
      let val = ''
      if (typeof col.csvRender === 'function') {
        val = col.csvRender(row)
      } else if (row[col.key] !== null && row[col.key] !== undefined) {
        val = row[col.key]
      }
      return `"${String(val ?? '').replace(/"/g, '""')}"`
    })
    csvLines.push(line.join(';'))
  })

  const csvContent = '\uFEFF' + csvLines.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = defaultFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Aciona o diálogo de impressão / PDF do navegador definindo o título do documento
 * para nomear o arquivo PDF automaticamente.
 */
export function printReportDocument(reportTitle = 'Relatorio_FortLuz') {
  const originalTitle = document.title
  const safeTitle = `${reportTitle.replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, '')}`
  document.title = safeTitle

  setTimeout(() => {
    window.print()
    setTimeout(() => {
      document.title = originalTitle
    }, 1000)
  }, 100)
}

/**
 * Algoritmo inteligente de paginação do relatório em folhas A4 regulamentares.
 * Divide os registros respeitando a capacidade da página 1 (com cabeçalho institucional e metadados)
 * e das páginas de continuação (com cabeçalho compacto).
 */
export function paginateReportRows({
  rows = [],
  firstPageCapacity = 10,
  subsequentPageCapacity = 12,
}) {
  if (!rows || rows.length === 0) {
    return [[]]
  }

  const capP1 = firstPageCapacity || 10
  const capSub = subsequentPageCapacity || 12

  const pages = []
  let currentIndex = 0
  const total = rows.length

  // Página 1
  const endP1 = Math.min(currentIndex + capP1, total)
  pages.push(rows.slice(currentIndex, endP1))
  currentIndex = endP1

  // Páginas seguintes
  while (currentIndex < total) {
    const end = Math.min(currentIndex + capSub, total)
    pages.push(rows.slice(currentIndex, end))
    currentIndex = end
  }

  return pages
}

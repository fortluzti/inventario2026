import { useEffect, useRef } from 'react'
import '../ReportTemplate.css'
import { ReportDocument } from './ReportDocument.jsx'
import { exportReportToCsv, printReportDocument } from './reportUtils.js'

export function ReportViewer({
  empresa,
  title = 'Relatório de Monitores',
  subtitle = 'Inventário e gestão de monitores corporativos.',
  reportCode = '',
  emissionDate = '',
  emissionTime = '',
  filtersText = 'Todos os registros',
  filterControls = null,
  emptyFilterHint = '',
  columns = [],
  rows = [],
  loading = false,
  error = null,
  onRetry = null,
  onClose,
  onExportCsv,
  firstPageCapacity = 10,
  subsequentPageCapacity = 12,
  totalRecords = 0,
  children,
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && typeof onClose === 'function') {
        e.preventDefault()
        onClose()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        handlePrint()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, title])

  function handleExportCsv() {
    if (typeof onExportCsv === 'function') {
      onExportCsv()
    } else {
      exportReportToCsv({
        reportTitle: title,
        columns,
        rows,
      })
    }
  }

  function handlePrint() {
    printReportDocument(title)
  }

  const totalRecordsComputed = totalRecords || rows.length || 0

  return (
    <div className="rpt-overlay" role="dialog" aria-modal="true" aria-label="Visualizador de Impressão A4">
      <header className="rpt-header no-print">
        <div className="rpt-header-left">
          <span className="mat" style={{ fontSize: 20, color: '#005852' }}>assignment</span>
          <span className="rpt-header-title">Visualizador de Impressão A4</span>
        </div>
        <div className="rpt-header-actions">
          <button
            className="rpt-btn"
            type="button"
            onClick={handleExportCsv}
            title="Exportar dados consolidados em planilha CSV"
            disabled={loading || !rows || rows.length === 0}
          >
            <span className="mat">table_view</span>
            <span>Exportar CSV</span>
          </button>

          <button
            className="rpt-btn rpt-btn-primary"
            type="button"
            onClick={handlePrint}
            title="Imprimir documento ou salvar em PDF (Ctrl+P)"
            disabled={loading}
          >
            <span className="mat">print</span>
            <span>Imprimir / Gerar PDF</span>
          </button>

          <button
            className="rpt-btn"
            type="button"
            onClick={onClose}
            aria-label="Fechar visualizador"
            title="Fechar visualizador (Esc)"
          >
            <span className="mat">close</span>
            <span>Fechar</span>
          </button>
        </div>
      </header>

      {filterControls && (
        <div className="no-print">
          {filterControls}
        </div>
      )}

      <main className="rpt-print-canvas" ref={canvasRef}>
        {children || (
          <ReportDocument
            empresa={empresa}
            title={title}
            subtitle={subtitle}
            reportCode={reportCode}
            emissionDate={emissionDate}
            emissionTime={emissionTime}
            filtersText={filtersText}
            columns={columns}
            rows={rows}
            loading={loading}
            error={error}
            onRetry={onRetry}
            emptyFilterHint={emptyFilterHint}
            firstPageCapacity={firstPageCapacity}
            subsequentPageCapacity={subsequentPageCapacity}
            totalRecords={totalRecordsComputed}
          />
        )}
      </main>
    </div>
  )
}

export default ReportViewer

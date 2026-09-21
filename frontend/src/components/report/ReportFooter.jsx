export function ReportFooter({ currentPage = 1, totalPages = 1, generatedAt = '' }) {
  const now = new Date()
  const dataHora = generatedAt || `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`

  return (
    <footer className="rpt-footer">
      <div className="rpt-footer-content">
        <span className="rpt-footer-system">
          Inventário FortLuz
        </span>
        <span className="rpt-footer-date">
          Relatório gerado em {dataHora}
        </span>
        <span className="rpt-page-number">
          Página {currentPage} de {totalPages}
        </span>
      </div>
    </footer>
  )
}

export default ReportFooter

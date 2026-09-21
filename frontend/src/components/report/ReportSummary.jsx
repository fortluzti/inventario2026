/**
 * ReportSummary: Resumo Executivo / Cards de Métricas e Totais (Página 1)
 */
export function ReportSummary({ items = [] }) {
  if (!items || items.length === 0) return null

  return (
    <div className="rpt-summary-grid">
      {items.map((item, idx) => {
        let metricClass = 'tertiary'
        if (item.tone === 'primary' || item.tone === 'red') metricClass = 'primary'
        else if (item.tone === 'secondary' || item.tone === 'amber' || item.tone === 'orange') metricClass = 'secondary'
        else if (item.tone === 'neutral' || item.tone === 'dark') metricClass = ''

        return (
          <div key={idx} className="rpt-summary-card">
            <span className="rpt-summary-card-title">{item.title}</span>
            <div className="rpt-summary-card-values">
              <span className={`rpt-summary-card-metric ${metricClass}`}>
                {item.value}
              </span>
              {item.subtitle && (
                <span className={`rpt-summary-card-sub ${item.subtitleHighlight ? 'highlight' : ''}`}>
                  {item.subtitle}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ReportSummary

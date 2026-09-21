/**
 * ReportFilters: Exibição visual dos filtros aplicados no documento A4
 */
export function ReportFilters({ filters = [] }) {
  // Se filters for string
  if (typeof filters === 'string') {
    if (!filters || filters.trim() === '' || filters === 'Todos os registros') {
      return (
        <div className="rpt-doc-filters">
          <span className="rpt-doc-filters-label">
            <span className="material-symbols-outlined">filter_alt</span>
            Filtros:
          </span>
          <div className="rpt-doc-filters-chips">
            <span className="rpt-doc-filter-chip">
              <strong>Todos os registros</strong>
            </span>
          </div>
        </div>
      )
    }

    const parts = filters.split('|').map(s => s.trim()).filter(Boolean)
    return (
      <div className="rpt-doc-filters">
        <span className="rpt-doc-filters-label">
          <span className="material-symbols-outlined">filter_alt</span>
          Filtros:
        </span>
        <div className="rpt-doc-filters-chips">
          {parts.map((p, idx) => (
            <span key={idx} className="rpt-doc-filter-chip">
              {p}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // Se filters for Array de objetos { label, value }
  if (Array.isArray(filters) && filters.length > 0) {
    return (
      <div className="rpt-doc-filters">
        <span className="rpt-doc-filters-label">
          <span className="material-symbols-outlined">filter_alt</span>
          Filtros:
        </span>
        <div className="rpt-doc-filters-chips">
          {filters.map((f, idx) => (
            <span key={idx} className="rpt-doc-filter-chip">
              {f.label}: <strong>{f.value}</strong>
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rpt-doc-filters">
      <span className="rpt-doc-filters-label">
        <span className="material-symbols-outlined">filter_alt</span>
        Filtros:
      </span>
      <div className="rpt-doc-filters-chips">
        <span className="rpt-doc-filter-chip">
          <strong>Todos os registros</strong>
        </span>
      </div>
    </div>
  )
}

export default ReportFilters

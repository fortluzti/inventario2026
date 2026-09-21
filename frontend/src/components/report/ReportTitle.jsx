export function ReportTitle({
  title = 'RELATATÓRIO DE MONITORES',
  subtitle = 'Inventário e gestão de monitores corporativos.',
  emissionDate = '',
  emissionTime = '',
  filtersText = 'Todos os registros',
  totalRecords = 0,
}) {
  const now = new Date()
  const data = emissionDate || now.toLocaleDateString('pt-BR')
  const hora = emissionTime || now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const emissaoCompleta = `${data} às ${hora}`

  return (
    <div className="rpt-title-block">
      <h1 className="rpt-title">{title}</h1>
      {subtitle && <p className="rpt-subtitle">{subtitle}</p>}

      <div className="rpt-metadata">
        <span className="rpt-meta-item">
          <strong>Data de Emissão:</strong> {emissaoCompleta}
        </span>
        <span className="rpt-meta-item rpt-meta-center">
          <strong>Filtros:</strong> {filtersText || 'Todos os registros'}
        </span>
        <span className="rpt-meta-item rpt-meta-right">
          <strong>Total:</strong> {totalRecords} registro{totalRecords !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

export default ReportTitle

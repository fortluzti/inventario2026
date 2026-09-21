import { ReportViewer } from './report/ReportViewer.jsx'

/**
 * ReportTemplate: Interface retrocompatível do Modelo Mestre de Relatórios FortLuz
 */
export default function ReportTemplate({
  empresa,
  title,
  subtitle,
  reportCode,
  emissionDate,
  emissionTime,
  operator,
  filters,
  filterControls,
  emptyFilterHint,
  summaryItems,
  columns = [],
  rows = [],
  loading = false,
  error = null,
  onRetry = null,
  total = rows.length || 0,
  totalizer = null,
  signatures = null,
  onClose,
  onExportCsv,
}) {
  return (
    <ReportViewer
      empresa={empresa}
      title={title}
      subtitle={subtitle}
      reportCode={reportCode}
      emissionDate={emissionDate}
      emissionTime={emissionTime}
      operator={operator}
      filters={filters}
      filterControls={filterControls}
      emptyFilterHint={emptyFilterHint}
      summaryItems={summaryItems}
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      totalRecords={total}
      totalizer={totalizer}
      signatures={signatures}
      onClose={onClose}
      onExportCsv={onExportCsv}
    />
  )
}

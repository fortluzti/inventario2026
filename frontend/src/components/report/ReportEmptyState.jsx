import { ReportHeader } from './ReportHeader.jsx'
import { ReportTitle } from './ReportTitle.jsx'
import { ReportFilters } from './ReportFilters.jsx'
import { ReportFooter } from './ReportFooter.jsx'

/**
 * ReportEmptyState: Folha A4 formatada quando a consulta não retorna registros
 */
export function ReportEmptyState({
  empresa,
  title = 'Relatório Geral de Ativos',
  subtitle = '',
  reportCode = '',
  filters = [],
  filterCriteriaHint = '',
  onClose,
}) {
  return (
    <section className="rpt-a4-sheet">
      <div className="rpt-a4-body">
        <ReportHeader empresa={empresa} reportCode={reportCode} />
        <div className="rpt-divider-line" />
        <ReportTitle
          title={title}
          subtitle={subtitle}
          reportCode={reportCode}
          totalRecords={0}
        />
        <ReportFilters filters={filters} />

        <div className="rpt-state-empty-box">
          <div className="rpt-state-empty-icon">
            <span className="material-symbols-outlined">inventory_2</span>
          </div>
          <h2 className="rpt-state-empty-title">
            Nenhum registro encontrado para os parâmetros selecionados
          </h2>
          <p className="rpt-state-empty-desc">
            Não foram localizados ativos cadastrados ou movimentados correspondentes aos filtros aplicados.
            Verifique se os critérios de pesquisa, status operacionais ou períodos informados estão corretos.
          </p>
          {filterCriteriaHint && (
            <div className="rpt-state-empty-hint">
              <span className="material-symbols-outlined">info</span>
              <span>{filterCriteriaHint}</span>
            </div>
          )}
        </div>
      </div>

      <ReportFooter currentPage={1} totalPages={1} />
    </section>
  )
}

export default ReportEmptyState

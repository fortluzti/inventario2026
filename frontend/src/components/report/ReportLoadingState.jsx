import { ReportHeader } from './ReportHeader.jsx'
import { ReportTitle } from './ReportTitle.jsx'
import { ReportFooter } from './ReportFooter.jsx'

/**
 * ReportLoadingState: Folha A4 com indicador visual de carregamento dos dados
 */
export function ReportLoadingState({ empresa, title = 'Relatório Geral de Ativos', subtitle = '' }) {
  return (
    <section className="rpt-a4-sheet">
      <div className="rpt-a4-body">
        <ReportHeader empresa={empresa} />
        <div className="rpt-divider-line" />
        <ReportTitle
          title={title}
          subtitle={subtitle}
          totalRecords={0}
        />

        <div className="rpt-state-loading-box">
          <div className="rpt-spinner" />
          <div className="rpt-state-loading-text">
            Carregando registros do inventário…
          </div>
          <div className="rpt-state-loading-sub">
            Processando dados consolidados e calculando paginação A4.
          </div>
        </div>
      </div>

      <ReportFooter currentPage={1} totalPages={1} />
    </section>
  )
}

export default ReportLoadingState

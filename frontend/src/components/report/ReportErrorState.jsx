import { ReportHeader } from './ReportHeader.jsx'
import { ReportTitle } from './ReportTitle.jsx'
import { ReportFooter } from './ReportFooter.jsx'

/**
 * ReportErrorState: Folha A4 com mensagem de erro e botão de tentar novamente
 */
export function ReportErrorState({
  empresa,
  title = 'Relatório Geral de Ativos',
  errorMessage = 'Não foi possível gerar o relatório.',
  onRetry,
}) {
  return (
    <section className="rpt-a4-sheet">
      <div className="rpt-a4-body">
        <ReportHeader empresa={empresa} />
        <div className="rpt-divider-line" />
        <ReportTitle
          title={title}
          subtitle="Ocorreu uma falha na recuperação dos dados operacionais."
          totalRecords={0}
        />

        <div className="rpt-state-error-box">
          <div className="rpt-state-error-icon">
            <span className="material-symbols-outlined">error</span>
          </div>
          <h2 className="rpt-state-error-title">
            Não foi possível gerar o relatório
          </h2>
          <p className="rpt-state-error-desc">
            {errorMessage || 'Houve uma instabilidade na comunicação com o servidor ou nos parâmetros da consulta.'}
          </p>
          {onRetry && (
            <button className="rpt-btn-retry" type="button" onClick={onRetry}>
              <span className="material-symbols-outlined">refresh</span>
              <span>Tentar novamente</span>
            </button>
          )}
        </div>
      </div>

      <ReportFooter currentPage={1} totalPages={1} />
    </section>
  )
}

export default ReportErrorState

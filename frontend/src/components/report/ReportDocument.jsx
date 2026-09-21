import { ReportHeader, ReportHeaderContinuation } from './ReportHeader.jsx'
import { ReportTitle } from './ReportTitle.jsx'
import { ReportTable } from './ReportTable.jsx'
import { ReportFooter } from './ReportFooter.jsx'

export function ReportDocument({
  empresa,
  title = 'RELATÓRIO DE MONITORES',
  subtitle = 'Inventário e gestão de monitores corporativos.',
  reportCode = '',
  emissionDate = '',
  emissionTime = '',
  filtersText = 'Todos os registros',
  columns = [],
  rows = [],
  loading = false,
  error = null,
  onRetry = null,
  emptyFilterHint = '',
  firstPageCapacity = 10,
  subsequentPageCapacity = 12,
  totalRecords = 0,
}) {
  const computedTotal = totalRecords || rows.length || 0

  if (loading) {
    return (
      <section className="a4-sheet">
        <div className="a4-content">
          <ReportHeader empresa={empresa} />
          <div className="rpt-divider" />
          <ReportTitle
            title={title}
            subtitle={subtitle}
            emissionDate={emissionDate}
            emissionTime={emissionTime}
            filtersText={filtersText}
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

  if (error) {
    return (
      <section className="a4-sheet">
        <div className="a4-content">
          <ReportHeader empresa={empresa} />
          <div className="rpt-divider" />
          <ReportTitle
            title={title}
            subtitle={subtitle}
            emissionDate={emissionDate}
            emissionTime={emissionTime}
            filtersText={filtersText}
            totalRecords={0}
          />

          <div className="rpt-state-error-box">
            <div className="rpt-state-error-icon">
              <span className="mat">error</span>
            </div>
            <h2 className="rpt-state-error-title">
              Não foi possível gerar o relatório
            </h2>
            <p className="rpt-state-error-desc">
              {error || 'Falha de comunicação com o servidor de dados.'}
            </p>
            {onRetry && (
              <button
                className="rpt-btn rpt-btn-primary"
                type="button"
                onClick={onRetry}
                style={{ marginTop: 12, height: 28, fontSize: 11 }}
              >
                <span className="mat">refresh</span>
                <span>Tentar novamente</span>
              </button>
            )}
          </div>
        </div>

        <ReportFooter currentPage={1} totalPages={1} />
      </section>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <section className="a4-sheet">
        <div className="a4-content">
          <ReportHeader empresa={empresa} />
          <div className="rpt-divider" />
          <ReportTitle
            title={title}
            subtitle={subtitle}
            emissionDate={emissionDate}
            emissionTime={emissionTime}
            filtersText={filtersText}
            totalRecords={0}
          />

          <div className="rpt-empty-box">
            <div className="rpt-empty-icon">
              <span className="mat">inventory_2</span>
            </div>
            <h2 className="rpt-empty-title">Nenhum registro encontrado</h2>
            <p className="rpt-empty-desc">
              Não foram localizados ativos correspondentes aos filtros aplicados.
              {emptyFilterHint ? ` ${emptyFilterHint}` : ''}
            </p>
          </div>
        </div>

        <ReportFooter currentPage={1} totalPages={1} />
      </section>
    )
  }

  return (
    <section className="a4-sheet">
      <div className="a4-content">
        <ReportHeader empresa={empresa} />
        <div className="rpt-divider" />
        <ReportTitle
          title={title}
          subtitle={subtitle}
          emissionDate={emissionDate}
          emissionTime={emissionTime}
          filtersText={filtersText}
          totalRecords={computedTotal}
        />
        <ReportTable columns={columns} rows={rows} />
      </div>

      <ReportFooter
        currentPage={1}
        totalPages={1}
      />
    </section>
  )
}

export default ReportDocument

import './ReportTemplate.css'

export default function ReportTemplate({ empresa, title, subtitle, filters, columns, rows, total, onClose, onExportCsv, loading }) {
  const now = new Date()
  const dataEmissao = now.toLocaleDateString('pt-BR')
  const horaEmissao = now.toLocaleTimeString('pt-BR', { hour12: false })

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('pt-BR')
  }

  function formatValue(value) {
    if (value === null || value === undefined || value === '') return '—'
    return value
  }

  return (
    <div className="rpt-overlay">
      <div className="rpt-header no-print">
        <div className="rpt-header-left">
          <span className="mat" aria-hidden="true">description</span>
          <span className="rpt-header-title">Visualizador de Impressão A4</span>
        </div>
        <div className="rpt-header-actions">
          <button className="rpt-btn" type="button" onClick={onExportCsv}>
            <span className="mat">table_view</span>
            <span>Exportar CSV</span>
          </button>
          <button className="rpt-btn rpt-btn-primary" type="button" onClick={() => window.print()}>
            <span className="mat">print</span>
            <span>Imprimir / Gerar PDF</span>
          </button>
          <button className="rpt-btn" type="button" onClick={onClose} aria-label="Fechar relatório">
            <span className="mat">close</span>
          </button>
        </div>
      </div>

      <div className="rpt-print-canvas">
        <section className="a4-sheet">
          <div className="a4-content">
            <header className="rpt-header-institucional">
              <div className="rpt-logo-wrap">
                {empresa && empresa.empresa_logo ? (
                  <img src={empresa.empresa_logo} alt="Logo da empresa" className="rpt-logo" />
                ) : (
                  <div className="rpt-logo-fallback">FL</div>
                )}
                <div className="rpt-origem">
                  <span className="mat" style={{ fontSize: 12 }}>domain</span>
                  <span>Origem: {empresa?.empresa_nome || '—'}</span>
                </div>
              </div>
              <div className="rpt-empresa-info">
                <span className="rpt-empresa-nome">{empresa?.empresa_nome || '—'}</span>
                <span className="rpt-empresa-cnpj">CNPJ: {formatValue(empresa?.empresa_cnpj) || '—'}</span>
                <span className="rpt-empresa-endereco">
                  {[empresa?.empresa_logradouro, empresa?.empresa_numero, empresa?.empresa_cidade, empresa?.empresa_estado].filter(Boolean).join(', ') || '—'}
                </span>
                <span className="rpt-empresa-contato">
                  Contato: {[empresa?.empresa_telefone, empresa?.empresa_email].filter(Boolean).join(' | ') || '—'}
                </span>
              </div>
            </header>

            <div className="rpt-divider" />

            <div className="rpt-title-block">
              <div className="rpt-title-row">
                <h1 className="rpt-title">{title}</h1>
                <span className="rpt-badge">TEMPLATE MESTRE DINÂMICO</span>
              </div>
              {subtitle && <p className="rpt-subtitle">{subtitle}</p>}
              <div className="rpt-metadata">
                <span><strong>Data de Emissão:</strong> {dataEmissao} às {horaEmissao}</span>
                <span><strong>Filtros Operacionais:</strong> {filters || 'Todos os registros'}</span>
                <span><strong>Unidades no Escopo:</strong> {total} registros</span>
              </div>
            </div>

            <div className="rpt-table-wrap">
              <div className="rpt-table-title">Demonstrativo Geral de Parque Instalado</div>
              <table className="rpt-table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} style={col.width ? { width: col.width } : undefined}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={columns.length} className="rpt-empty" role="status">
                        Carregando registros…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="rpt-empty">
                        Nenhum registro encontrado para os parâmetros selecionados.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, i) => (
                      <tr key={row.id || i} className={i % 2 === 0 ? 'rpt-row-alt' : ''}>
                        {columns.map((col) => (
                          <td key={col.key} className={col.className || ''}>
                            {col.render ? col.render(row) : formatValue(row[col.key])}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {rows.length > 0 && (
                <p className="rpt-footnote">
                  * O relatório completo contém {total} registros distribuídos em {Math.ceil(total / 30)} páginas A4 impressas sob demanda pelo módulo FortLuz ERP.
                </p>
              )}
            </div>
          </div>

          <footer className="rpt-footer">
            <div className="rpt-divider" />
            <div className="rpt-footer-content">
              <span>Inventário FortLuz ERP • Módulo de Relatórios Corporativos</span>
              <span>Documento oficial gerado para controle patrimonial interno</span>
              <span>Página 1 de 1</span>
            </div>
          </footer>
        </section>
      </div>
    </div>
  )
}

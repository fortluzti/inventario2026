import { formatValue, STATUS_VARIANT_MAP } from './reportUtils.js'

export function ReportTable({ columns = [], rows = [] }) {
  if (!columns || columns.length === 0) return null

  return (
    <div className="rpt-table-wrap">
      <table className="rpt-table">
        <thead>
          <tr>
            {columns.map((col) => {
              let alignClass = ''
              if (col.align === 'right') alignClass = 'cell-right'
              else if (col.align === 'center') alignClass = 'cell-center'

              return (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={alignClass}
                >
                  {col.label}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const isAlt = rowIndex % 2 === 1

            return (
              <tr key={row.id ?? rowIndex} className={isAlt ? 'rpt-row-alt' : ''}>
                {columns.map((col) => {
                  let cellClasses = []
                  if (col.align === 'right') cellClasses.push('cell-right')
                  if (col.align === 'center') cellClasses.push('cell-center')
                  if (col.isMono) cellClasses.push('cell-mono')
                  if (col.isCode) cellClasses.push('cell-code')
                  if (col.isMuted) cellClasses.push('cell-muted')
                  if (col.isStrong) cellClasses.push('cell-strong')
                  if (col.className) cellClasses.push(col.className)

                  return (
                    <td key={col.key} className={cellClasses.join(' ')}>
                      {col.render ? (
                        col.render(row, rowIndex)
                      ) : col.key === 'status' ? (
                        <span className={`rpt-status ${STATUS_VARIANT_MAP[row.status] || 'in-stock'}`}>
                          {row.status || '–'}
                        </span>
                      ) : (
                        formatValue(row[col.key])
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default ReportTable

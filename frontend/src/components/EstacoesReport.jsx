import { useEffect, useState } from 'react'
import { listarTodas } from '../api/estacoes.js'
import ReportTemplate from './ReportTemplate.jsx'

const STATUS_CLASS = {
  'Em Uso': 'in-use',
  'Em Estoque': 'in-stock',
  'Em Manutenção': 'maintenance',
  'Danificado': 'damaged',
  'Descartado': 'discarded',
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('pt-BR')
}

export default function EstacoesReport({ empresa, filters, onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterLabels, setFilterLabels] = useState({})

  const columns = [
    { key: 'codigo_interno_estacao', label: 'Código' },
    { key: 'empresa_nome', label: 'Empresa' },
    { key: 'setor_nome', label: 'Setor' },
    { key: 'funcionario_nome', label: 'Responsável' },
    { key: 'ip', label: 'IP' },
    { key: 'monitor_codigo', label: 'Monitor' },
    { key: 'status', label: 'Status', render: (row) => {
      const cls = STATUS_CLASS[row.status] || 'in-stock'
      return <span className={`rpt-status ${cls}`}>{row.status || '—'}</span>
    }},
    { key: 'data_compra', label: 'Dt. Compra', render: (row) => formatDate(row.data_compra) },
  ]

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    listarTodas(filters)
      .then((items) => {
        if (!active) return
        setRows(items)
      })
      .catch((e) => {
        if (active) { setError(e.message); setRows([]) }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [filters])

  const filtersStr = Object.keys(filters).filter(k => filters[k]).map(k => {
    if (k === 'status') return `Status: ${filters.status}`
    if (k === 'setor_id') return `Setor: ${filterLabels.setor || filters.setor_id}`
    if (k === 'empresa_id') return `Empresa: ${filterLabels.empresa || filters.empresa_id}`
    return `${k}: ${filters[k]}`
  }).join(' | ') || 'Todos os registros'

  return (
    <ReportTemplate
      empresa={empresa}
      title="Relatório de Estações"
      subtitle="Demonstrativo consolidado de estações de trabalho cadastradas no inventário corporativo."
      filters={filtersStr}
      columns={columns}
      rows={rows}
      total={rows.length}
      loading={loading}
      onClose={onClose}
      onExportCsv={() => {
        const csv = [
          ['Código', 'Empresa', 'Setor', 'Responsável', 'IP', 'Monitor', 'Status', 'Dt. Compra']
        ]
        rows.forEach(r => {
          csv.push([
            r.codigo_interno_estacao,
            r.empresa_nome || '',
            r.setor_nome || '',
            r.funcionario_nome || '',
            r.ip || '',
            r.monitor_codigo || '',
            r.status,
            r.data_compra ? formatDate(r.data_compra) : '',
          ])
        })
        const csvStr = csv.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
        const blob = new Blob(['\uFEFF' + csvStr], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `estacoes_report_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }}
    />
  )
}

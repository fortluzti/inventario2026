import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { listarOpcoes, listarTodas } from '../api/monitores.js'
import { carregarEmpresa } from '../api/configuracoes.js'
import MonitorDialog from '../components/MonitorDialog.jsx'
import MonitoresReport from '../components/MonitoresReport.jsx'
import './Monitores.css'

const EMPTY = { items: [], total: 0, total_pages: 0 }
const STATUS_CLASS = (status) => ({
  'Em Uso': 'in-use',
  'Em Estoque': 'in-stock',
  'Em Manutenção': 'maintenance',
  'Danificado': 'damaged',
  'Descartado': 'discarded',
}[status] || 'in-stock')

export default function Monitores({ refreshKey = 0, newRequest = 0, onChanged }) {
  const [data, setData] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ status: '' })
  const [draft, setDraft] = useState(filters)
  const [showFilters, setShowFilters] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [dialog, setDialog] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [showReport, setShowReport] = useState(false)
  const [empresa, setEmpresa] = useState(null)
  const deleteLock = useRef(false)
  const searchRef = useRef(null)
  const lastNewRequest = useRef(newRequest)

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api('monitores', 'listar', { params: { search: query, ...filters, page, limit } })
      .then((result) => {
        if (!active) return
        if (page > Math.max(1, result.total_pages)) { setPage(Math.max(1, result.total_pages)); return }
        setData(result)
      })
      .catch((e) => { if (active) { setError(e.message); setData(EMPTY) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, filters, page, limit, revision, refreshKey])

  useEffect(() => {
    if (newRequest > lastNewRequest.current) { lastNewRequest.current = newRequest; setDialog({ mode: 'new' }) }
  }, [newRequest])

  useEffect(() => {
    if (showReport) {
      carregarEmpresa().then(setEmpresa).catch(() => setEmpresa(null))
    }
  }, [showReport])

  useEffect(() => {
    function onKey(e) {
      if (dialog) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); setDialog({ mode: 'new' }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog])

  async function remove(row) {
    if (deleteLock.current || !window.confirm(`Excluir o monitor ${row.codigo_interno_monitor}? Esta ação não pode ser desfeita.`)) return
    deleteLock.current = true
    setDeleting(row.id)
    setMessage('')
    setError('')
    try {
      await api('monitores', 'excluir', { method: 'POST', body: { id: row.id } })
      setMessage('Monitor excluído com sucesso.')
      setRevision((v) => v + 1)
      onChanged?.()
    } catch (e) { setError(e.message) }
    finally { deleteLock.current = false; setDeleting(null) }
  }

  function clear() {
    setSearch(''); setQuery(''); setFilters({ status: '' }); setDraft({ status: '' }); setPage(1)
  }

  const MONITOR_STATUS_OPTIONS = ['Em Uso', 'Em Estoque', 'Em Manutenção', 'Danificado', 'Descartado']

  return <section className="mon-page" aria-labelledby="mon-page-title">
    <header className="mon-page-header">
      <div><div className="mon-breadcrumb">Ativos de TI / Monitores</div><h1 id="mon-page-title"><span className="mat" aria-hidden="true">desktop_windows</span>Monitores</h1><p>Inventário e gestão de monitores corporativos.</p></div>
      <button className="mon-btn mon-btn-primary" onClick={() => { setMessage(''); setDialog({ mode: 'new' }) }}><span className="mat" aria-hidden="true">add</span>Novo Monitor</button>
    </header>
    <div className="mon-toolbar">
      <div className="mon-toolbar-row">
        <label className="mon-search"><span className="mat" aria-hidden="true">search</span><input ref={searchRef} aria-label="Buscar monitores" placeholder="Buscar monitores…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="mon-actions">
          <button className="mon-btn" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="mon-filters"><span className="mat" aria-hidden="true">filter_list</span>Filtros{(filters.status && ' •')}</button>
          <button className="mon-btn" onClick={() => setRevision((v) => v + 1)} disabled={loading}>Atualizar</button>
          <button className="mon-btn" onClick={() => setShowReport(true)} disabled={loading || !data.items.length} title="Imprimir relatório de monitores"><span className="mat" aria-hidden="true">print</span>Relatório</button>
        </div>
      </div>
      {showFilters && <form id="mon-filters" className="mon-filters" onSubmit={(e) => { e.preventDefault(); setFilters({ ...draft }); setPage(1) }}>
        <label>Status: <select aria-label="Filtrar por status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}><option value="">Todos os Status</option>{MONITOR_STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <div className="mon-actions"><button className="mon-btn mon-btn-primary" type="submit">Aplicar</button><button className="mon-btn" type="button" onClick={clear}>Limpar</button></div>
      </form>}
    </div>
    {message && <div className="mon-message" role="status">{message}</div>}
    {(error) && <div className="mon-message error" role="alert">{error}<button className="mon-btn" onClick={() => setRevision((v) => v + 1)}>Tentar novamente</button></div>}
    <div className="mon-grid" aria-busy={loading}>
      <div className="mon-table-scroll"><table className="mon-table">
        <caption className="mon-sr-only">Monitores cadastrados</caption>
        <thead><tr>{['Código', 'Marca', 'Modelo', 'Série', 'Empresa', 'Status', 'Compra', 'Ações'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={8} className="mon-empty" role="status">Carregando monitores…</td></tr> : data.items.length === 0 ? <tr><td colSpan={8} className="mon-empty">{error ? 'Não foi possível carregar a listagem.' : 'Nenhum monitor encontrado.'}</td></tr> : data.items.map((row) => <tr key={row.id}>
          <td><strong className="mon-code">{row.codigo_interno_monitor || '—'}</strong></td>
          <td>{row.marca || '—'}</td>
          <td className="mon-medium">{row.modelo || '—'}</td>
          <td className="mon-mono">{row.numero_serie || '—'}</td>
          <td>{row.empresa_nome || '—'}</td>
          <td><span className={`mon-status ${STATUS_CLASS(row.status)}`}>{row.status || 'Não informado'}</span></td>
          <td className="mon-mono">{row.data_compra ? new Date(row.data_compra).toLocaleDateString('pt-BR') : '—'}</td>
          <td><div className="mon-actions"><button className="mon-btn mon-btn-icon" title="Visualizar" aria-label="Visualizar monitor" onClick={() => setDialog({ mode: 'view', id: row.id })}><span className="mat">visibility</span></button><button className="mon-btn mon-btn-icon" title="Editar" aria-label="Editar monitor" onClick={() => setDialog({ mode: 'edit', id: row.id })}><span className="mat">edit</span></button><button className="mon-btn mon-btn-icon danger" title="Excluir" aria-label="Excluir monitor" disabled={deleting !== null} onClick={() => remove(row)}><span className="mat">delete</span></button></div></td>
        </tr>)}</tbody>
      </table></div>
      <footer className="mon-pagination">
        <span>{data.total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)}` : '0'} de {data.total} registros</span>
        <label>Por página: <select aria-label="Registros por página" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>{[10, 20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></label>
        <div className="mon-actions"><button className="mon-btn" disabled={loading || page <= 1} onClick={() => setPage((v) => v - 1)}>Anterior</button><span>{page} / {Math.max(1, data.total_pages)}</span><button className="mon-btn" disabled={loading || page >= data.total_pages} onClick={() => setPage((v) => v + 1)}>Próximo</button></div>
      </footer>
    </div>
    {dialog && <MonitorDialog {...dialog} onClose={() => setDialog(null)} onSaved={(text) => { setDialog(null); setMessage(text); setRevision((v) => v + 1); onChanged?.() }} />}
    {showReport && <MonitoresReport empresa={empresa} filters={filters} onClose={() => setShowReport(false)} />}
  </section>
}
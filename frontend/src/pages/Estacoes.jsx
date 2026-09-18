import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { ESTACAO_STATUS, listarOpcoes } from '../api/estacoes.js'
import { carregarEmpresa } from '../api/configuracoes.js'
import EstacaoDialog from '../components/EstacaoDialog.jsx'
import EstacoesReport from '../components/EstacoesReport.jsx'
import './Estacoes.css'

const EMPTY = { items: [], total: 0, total_pages: 0 }
const statusClass = (status) => ({ 'Em Uso': 'in-use', 'Em Manutenção': 'maintenance', Danificado: 'damaged', Descartado: 'discarded' }[status] || 'stock')

export default function Estacoes({ refreshKey = 0, newRequest = 0, onChanged }) {
  const [data, setData] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ status: '', setor_id: '' })
  const [draft, setDraft] = useState(filters)
  const [showFilters, setShowFilters] = useState(true)
  const [setores, setSetores] = useState([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [optionError, setOptionError] = useState('')
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
    setOptionError('')
    listarOpcoes('setores').then((rows) => { if (active) setSetores(rows) })
      .catch((e) => { if (active) setOptionError(`Não foi possível carregar os setores: ${e.message}`) })
    return () => { active = false }
  }, [revision, refreshKey])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api('estacoes', 'listar', { params: { search: query, ...filters, page, limit } })
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
      if (dialog || showReport) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); setDialog({ mode: 'new' }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog])

  async function remove(row) {
    if (deleteLock.current || !window.confirm(`Excluir a estação ${row.codigo_interno_estacao}? Esta ação não pode ser desfeita.`)) return
    deleteLock.current = true
    setDeleting(row.id)
    setMessage('')
    setError('')
    try {
      await api('estacoes', 'excluir', { method: 'POST', body: { id: row.id } })
      setMessage('Estação excluída com sucesso.')
      setRevision((v) => v + 1)
      onChanged?.()
    } catch (e) { setError(e.message) }
    finally { deleteLock.current = false; setDeleting(null) }
  }

  function clear() {
    setSearch(''); setQuery(''); setFilters({ status: '', setor_id: '' }); setDraft({ status: '', setor_id: '' }); setPage(1)
  }

  return <section className="est-page" aria-labelledby="est-page-title">
    <header className="est-page-header">
      <div><div className="est-breadcrumb">Ativos de TI / Estações</div><h1 id="est-page-title"><span className="mat" aria-hidden="true">computer</span>Estações de Trabalho</h1><p>Inventário, alocação e configuração de hardware.</p></div>
      <button className="est-btn primary" onClick={() => { setMessage(''); setDialog({ mode: 'new' }) }}><span className="mat" aria-hidden="true">add</span>Nova Estação</button>
    </header>
    <div className="est-toolbar">
      <div className="est-toolbar-row">
        <label className="est-search"><span className="mat" aria-hidden="true">search</span><input ref={searchRef} aria-label="Buscar estações" placeholder="Buscar estações…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="est-actions">
          <button className="est-btn" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="est-filters"><span className="mat" aria-hidden="true">filter_list</span>Filtros{(filters.status || filters.setor_id) && ' •'}</button>
          <button className="est-btn" onClick={() => setRevision((v) => v + 1)} disabled={loading}>Atualizar</button>
          <button className="est-btn" onClick={() => setShowReport(true)} disabled={loading || !data.items.length} title="Imprimir relatório de estações"><span className="mat" aria-hidden="true">print</span>Relatório</button>
        </div>
      </div>
      {showFilters && <form id="est-filters" className="est-filters" onSubmit={(e) => { e.preventDefault(); setFilters({ ...draft }); setPage(1) }}>
        <label>Status: <select aria-label="Filtrar por status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}><option value="">Todos os Status</option>{ESTACAO_STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Setor: <select aria-label="Filtrar por setor" value={draft.setor_id} onChange={(e) => setDraft({ ...draft, setor_id: e.target.value })}><option value="">Todos os Setores</option>{setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>
        <div className="est-actions"><button className="est-btn primary" type="submit">Aplicar</button><button className="est-btn" type="button" onClick={clear}>Limpar</button></div>
      </form>}
    </div>
    {message && <div className="est-message" role="status">{message}</div>}
    {(error || optionError) && <div className="est-message error" role="alert">{error || optionError}<button className="est-btn" onClick={() => setRevision((v) => v + 1)}>Tentar novamente</button></div>}
    <div className="est-grid" aria-busy={loading}>
      <div className="est-table-scroll"><table className="est-table">
        <caption className="est-sr-only">Estações de trabalho cadastradas</caption>
        <thead><tr>{['Código', 'Empresa', 'Setor', 'Responsável', 'IP', 'Monitor', 'Status', 'Ações'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={8} className="est-empty" role="status">Carregando estações…</td></tr> : data.items.length === 0 ? <tr><td colSpan={8} className="est-empty">{error ? 'Não foi possível carregar a listagem.' : 'Nenhuma estação encontrada.'}</td></tr> : data.items.map((row) => <tr key={row.id}>
          <td><strong className="est-code">{row.codigo_interno_estacao || '—'}</strong><small>{row.monitor_modelo || 'Sem monitor'}</small></td>
          <td className="est-company">{row.empresa_nome || '—'}</td><td>{row.setor_nome || '—'}</td>
          <td>{row.funcionario_nome ? <span className="est-person"><span className="est-avatar" aria-hidden="true">{row.funcionario_nome[0]}</span>{row.funcionario_nome}</span> : <em>Não atribuído</em>}</td>
          <td className="est-mono">{row.ip || '—'}</td><td className="est-code">{row.monitor_codigo || '—'}</td>
          <td><span className={`est-status ${statusClass(row.status)}`}>{row.status || 'Não informado'}</span></td>
          <td><div className="est-actions">{[['view', 'visibility', 'Visualizar'], ['edit', 'edit', 'Editar'], ['delete', 'delete', 'Excluir']].map(([mode, icon, label]) => <button key={mode} className={`est-btn est-icon ${mode === 'delete' ? 'danger' : ''}`} title={`${label} ${row.codigo_interno_estacao}`} aria-label={`${label} ${row.codigo_interno_estacao}`} disabled={deleting !== null} onClick={() => mode === 'delete' ? remove(row) : setDialog({ mode, id: row.id })}><span className="mat" aria-hidden="true">{icon}</span></button>)}</div></td>
        </tr>)}</tbody>
      </table></div>
      <footer className="est-pagination">
        <span>{data.total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)}` : '0'} de {data.total} registros</span>
        <label>Por página: <select aria-label="Registros por página" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>{[10, 20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></label>
        <div className="est-actions"><button className="est-btn" disabled={loading || page <= 1} onClick={() => setPage((v) => v - 1)}>Anterior</button><span>{page} / {Math.max(1, data.total_pages)}</span><button className="est-btn" disabled={loading || page >= data.total_pages} onClick={() => setPage((v) => v + 1)}>Próximo</button></div>
      </footer>
    </div>
    {dialog && <EstacaoDialog {...dialog} onClose={() => setDialog(null)} onSaved={(text) => { setDialog(null); setMessage(text); setRevision((v) => v + 1); onChanged?.() }} />}
    {showReport && <EstacoesReport empresa={empresa} filters={filters} onClose={() => setShowReport(false)} />}
  </section>
}

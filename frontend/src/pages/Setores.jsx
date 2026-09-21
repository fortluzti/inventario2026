import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { listarOpcoes, listarTodas, excluir } from '../api/setores.js'
import SetoresDialog from '../components/SetoresDialog.jsx'
import './Setores.css'

const EMPTY = { items: [], total: 0, total_pages: 0 }

export default function Setores({ refreshKey = 0, newRequest = 0, onChanged }) {
  const [data, setData] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ ativo: '' })
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
    api('setores', 'listar', { params: { search: query, ...filters, page, limit } })
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
    function onKey(e) {
      if (dialog) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); setDialog({ mode: 'new' }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog])

  async function remove(row) {
    if (deleteLock.current || !window.confirm(`Excluir o setor "${row.nome}")? Esta ação não pode ser desfeita.`)) return
    deleteLock.current = true
    setDeleting(row.id)
    setMessage('')
    setError('')
    try {
      await excluir(row.id)
      setMessage('Setor excluído com sucesso.')
      setRevision((v) => v + 1)
      onChanged?.()
    } catch (e) { setError(e.message) }
    finally { deleteLock.current = false; setDeleting(null) }
  }

  function clear() {
    setSearch(''); setQuery(''); setFilters({ ativo: '' }); setDraft({ ativo: '' }); setPage(1)
  }

  const SETOR_STATUS_OPTIONS = ['Ativo', 'Inativo']

  return <section className="set-page" aria-labelledby="set-page-title">
    <header className="set-page-header">
      <div>
        <div className="set-breadcrumb">Ativos de TI / Setores</div>
        <h1 id="set-page-title"><span className="mat" aria-hidden="true">schema</span>Setores</h1>
        <p>Organização e classificação de ativos por localização ou departamento.</p>
      </div>
      <button className="set-btn set-btn-primary" onClick={() => { setMessage(''); setDialog({ mode: 'new' }) }}><span className="mat" aria-hidden="true">add</span>Novo Setor</button>
    </header>

    <div className="set-toolbar">
      <div className="set-toolbar-row">
        <label className="set-search"><span className="mat" aria-hidden="true">search</span><input ref={searchRef} aria-label="Buscar setores" placeholder="Buscar setores…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="set-actions">
          <button className="set-btn" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="set-filters"><span className="mat" aria-hidden="true">filter_list</span>Filtros{(filters.ativo && ' •')}</button>
          <button className="set-btn" onClick={() => setRevision((v) => v + 1)} disabled={loading}>Atualizar</button>
        </div>
      </div>
      {showFilters && <form id="set-filters" className="set-filters" onSubmit={(e) => { e.preventDefault(); setFilters({ ...draft }); setPage(1) }}>
        <label>Status: <select aria-label="Filtrar por status" value={draft.ativo} onChange={(e) => setDraft({ ativo: e.target.value })}><option value="">Todos os Status</option>{SETOR_STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <div className="set-actions"><button className="set-btn set-btn-primary" type="submit">Aplicar</button><button className="set-btn" type="button" onClick={clear}>Limpar</button></div>
      </form>}
    </div>

    {message && <div className="set-message" role="status">{message}</div>}
    {(error) && <div className="set-message error" role="alert">{error}<button className="set-btn" onClick={() => setRevision((v) => v + 1)}>Tentar novamente</button></div>}

    <div className="set-grid" aria-busy={loading}>
      <div className="set-table-scroll"><table className="set-table">
        <caption className="set-sr-only">Setores cadastrados</caption>
        <thead><tr>{['Nome', 'Descrição', 'Status', 'Ações'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={4} className="set-empty" role="status">Carregando setores…</td></tr> : data.items.length === 0 ? <tr><td colSpan={4} className="set-empty">{error ? 'Não foi possível carregar a listagem.' : 'Nenhum setor encontrado.'}</td></tr> : data.items.map((row) => <tr key={row.id}>
          <td><strong className="set-name">{row.nome || '—'}</strong></td>
          <td className="set-muted">{row.descricao || '—'}</td>
          <td><span className={`set-status ${row.ativo ? 'active' : 'inactive'}`}>{row.ativo ? 'Ativo' : 'Inativo'}</span></td>
          <td><div className="set-actions"><button className="set-btn set-btn-icon" title="Visualizar" aria-label="Visualizar setor" onClick={() => setDialog({ mode: 'view', id: row.id })}><span className="mat">visibility</span></button><button className="set-btn set-btn-icon" title="Editar" aria-label="Editar setor" onClick={() => setDialog({ mode: 'edit', id: row.id })}><span className="mat">edit</span></button><button className="set-btn set-btn-icon danger" title="Excluir" aria-label="Excluir setor" disabled={deleting !== null} onClick={() => remove(row)}><span className="mat">delete</span></button></div></td>
        </tr>)}</tbody>
      </table></div>
      <footer className="set-pagination">
        <span>{data.total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)}` : '0'} de {data.total} registros</span>
        <label>Por página: <select aria-label="Registros por página" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>{[10, 20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></label>
        <div className="set-actions"><button className="set-btn" disabled={loading || page <= 1} onClick={() => setPage((v) => v - 1)}>Anterior</button><span>{page} / {Math.max(1, data.total_pages)}</span><button className="set-btn" disabled={loading || page >= data.total_pages} onClick={() => setPage((v) => v + 1)}>Próximo</button></div>
      </footer>
    </div>

    {dialog && <SetoresDialog {...dialog} onClose={() => setDialog(null)} onSaved={(text) => { setDialog(null); setMessage(text); setRevision((v) => v + 1); onChanged?.() }} />}
  </section>
}
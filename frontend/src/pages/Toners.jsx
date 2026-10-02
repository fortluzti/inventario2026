import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { excluir } from '../api/toners.js'
import TonerDialog from '../components/TonerDialog.jsx'
import './Toners.css'

const EMPTY = { items: [], total: 0, total_pages: 0 }

/* Valor unitário (R$) — apenas cadastro, formatado pt-BR. */
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Consumíveis (toners/cilindros): CRUD do estoque de insumos.
 * O campo `valor` (migration 007) é apenas cadastral — não entra no cálculo de
 * estoque mínimo e não vai para solicitação/pedido de compra.
 */
export default function Toners({ refreshKey = 0, newRequest = 0, onChanged }) {
  const [data, setData] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({})
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
    api('toners', 'listar', { params: { search: query, ...filters, page, limit } })
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
    if (deleteLock.current || !window.confirm(`Excluir o consumível "${row.codigo}"? Esta ação não pode ser desfeita.`)) return
    deleteLock.current = true
    setDeleting(row.id)
    setMessage('')
    setError('')
    try {
      await excluir(row.id)
      setMessage('Consumível excluído com sucesso.')
      setRevision((v) => v + 1)
      onChanged?.()
    } catch (e) {
      setError(e.message)
    }
    finally { deleteLock.current = false; setDeleting(null) }
  }

  function clear() {
    setSearch(''); setQuery(''); setFilters({}); setDraft({}); setPage(1)
  }

  return <section className="tnd-page" aria-labelledby="tnd-page-title">
    <header className="tnd-page-header">
      <div>
        <div className="tnd-breadcrumb">Estoque &amp; Insumos / Consumíveis</div>
        <h1 id="tnd-page-title"><span className="mat" aria-hidden="true">inventory_2</span>Toners em Estoque</h1>
        <p>Cadastro de consumíveis (toners e cilindros) e seus valores unitários.</p>
      </div>
      <button className="tnd-btn tnd-btn-primary" onClick={() => { setMessage(''); setDialog({ mode: 'new' }) }}><span className="mat" aria-hidden="true">add</span>Novo Consumível</button>
    </header>

    <div className="tnd-toolbar">
      <div className="tnd-toolbar-row">
        <label className="tnd-search"><span className="mat" aria-hidden="true">search</span><input ref={searchRef} aria-label="Buscar consumíveis" placeholder="Buscar por código…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="tnd-actions">
          <button className="tnd-btn" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="tnd-filters"><span className="mat" aria-hidden="true">filter_list</span>Filtros{filters.tipo ? ' •' : ''}</button>
          <button className="tnd-btn" onClick={() => setRevision((v) => v + 1)} disabled={loading}>Atualizar</button>
        </div>
      </div>
      {showFilters && <form id="tnd-filters" className="tnd-filters" onSubmit={(e) => { e.preventDefault(); setFilters({ ...draft }); setPage(1) }}>
        <label>Tipo: <select aria-label="Filtrar por tipo" value={draft.tipo || ''} onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}><option value="">Todos</option><option value="TONER">TONER</option><option value="CILINDRO">CILINDRO</option></select></label>
        <div className="tnd-actions"><button className="tnd-btn tnd-btn-primary" type="submit">Aplicar</button><button className="tnd-btn" type="button" onClick={clear}>Limpar</button></div>
      </form>}
    </div>

    {message && <div className="tnd-message" role="status">{message}</div>}
    {error && <div className="tnd-message error" role="alert">{error}<button className="tnd-btn" onClick={() => setRevision((v) => v + 1)}>Tentar novamente</button></div>}

    <div className="tnd-grid" aria-busy={loading}>
      <div className="tnd-table-scroll"><table className="tnd-table">
        <caption className="tnd-sr-only">Consumíveis cadastrados</caption>
        <thead><tr>{['Código', 'Tipo', 'Estoque', 'Mín.', 'Autonomia', 'Valor (R$)', 'Ações'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={7} className="tnd-muted" role="status">Carregando consumíveis…</td></tr> : data.items.length === 0 ? <tr><td colSpan={7} className="tnd-muted">{error ? 'Não foi possível carregar a listagem.' : 'Nenhum consumível encontrado.'}</td></tr> : data.items.map((row) => <tr key={row.id}>
          <td><strong className="tnd-name">{row.codigo || '—'}</strong></td>
          <td><span className={`tnd-tipo ${row.tipo === 'CILINDRO' ? 'cilindro' : 'toner'}`}>{row.tipo || '—'}</span></td>
          <td className="tnd-number">{row.estoque ?? 0}</td>
          <td className="tnd-number">{row.estoque_minimo ?? 0}</td>
          <td className="tnd-muted">{row.autonomia || '—'}</td>
          <td className="tnd-number tnd-valor">{`R$ ${brl(row.valor)}`}</td>
          <td><div className="tnd-actions"><button className="tnd-btn tnd-btn-icon" title="Visualizar" aria-label="Visualizar consumível" onClick={() => setDialog({ mode: 'view', id: row.id })}><span className="mat">visibility</span></button><button className="tnd-btn tnd-btn-icon" title="Editar" aria-label="Editar consumível" onClick={() => setDialog({ mode: 'edit', id: row.id })}><span className="mat">edit</span></button><button className="tnd-btn tnd-btn-icon danger" title="Excluir" aria-label="Excluir consumível" disabled={deleting !== null} onClick={() => remove(row)}><span className="mat">delete</span></button></div></td>
        </tr>)}</tbody>
      </table></div>
      <footer className="tnd-pagination">
        <span>{data.total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)}` : '0'} de {data.total} registros</span>
        <label>Por página: <select aria-label="Registros por página" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>{[10, 20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></label>
        <div className="tnd-actions"><button className="tnd-btn" disabled={loading || page <= 1} onClick={() => setPage((v) => v - 1)}>Anterior</button><span>{page} / {Math.max(1, data.total_pages)}</span><button className="tnd-btn" disabled={loading || page >= data.total_pages} onClick={() => setPage((v) => v + 1)}>Próximo</button></div>
      </footer>
    </div>

    {dialog && <TonerDialog {...dialog} onClose={() => setDialog(null)} onSaved={(text) => { setDialog(null); setMessage(text); setRevision((v) => v + 1); onChanged?.() }} />}
  </section>
}

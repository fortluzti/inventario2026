import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'

import ImpressoraModelosDialog from '../components/ImpressoraModelosDialog.jsx'
import './ImpressoraModelos.css'

const EMPTY = { items: [], total: 0, total_pages: 0 }

export default function ImpressoraModelos({ refreshKey = 0, newRequest = 0, onChanged }) {
  const [data, setData] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({})
  const [draft, setDraft] = useState(filters)
  const [showFilters, setShowFilters] = useState(false)
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
    api('impressoras_modelos', 'listar', { params: { search: query, ...filters, page, limit } })
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
    if (deleteLock.current || !window.confirm(`Excluir o modelo "${row.nome_modelo} ${row.marca || ''}"? Esta ação não pode ser desfeita.`)) return
    deleteLock.current = true
    setDeleting(row.id)
    setMessage('')
    setError('')
    try {
      await api('impressoras_modelos', 'excluir', { method: 'POST', body: { id: row.id } })
      setMessage('Modelo excluído com sucesso.')
      setRevision((v) => v + 1)
      onChanged?.()
    } catch (e) { setError(e.message) }
    finally { deleteLock.current = false; setDeleting(null) }
  }

  function clear() {
    setSearch(''); setQuery(''); setFilters({}); setDraft({}); setPage(1)
  }

  return <section className="imo-page" aria-labelledby="imo-page-title">
    <header className="imo-page-header">
      <div>
        <div className="imo-breadcrumb">Ativos de TI / Modelos de Impressoras</div>
        <h1 id="imo-page-title"><span className="mat" aria-hidden="true">print</span>Modelos de Impressoras</h1>
        <p>Cadastro de modelos de impressoras e seus estoques mínimos de consumíveis.</p>
      </div>
      <button className="imo-btn imo-btn-primary" onClick={() => { setMessage(''); setDialog({ mode: 'new' }) }}><span className="mat" aria-hidden="true">add</span>Novo Modelo</button>
    </header>

    <div className="imo-toolbar">
      <div className="imo-toolbar-row">
        <label className="imo-search"><span className="mat" aria-hidden="true">search</span><input ref={searchRef} aria-label="Buscar modelos" placeholder="Buscar modelos…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="imo-actions">
          <button className="imo-btn" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="imo-filters"><span className="mat" aria-hidden="true">filter_list</span>Filtros</button>
          <button className="imo-btn" onClick={() => setRevision((v) => v + 1)} disabled={loading}>Atualizar</button>
        </div>
      </div>
      {showFilters && <form id="imo-filters" className="imo-filters" onSubmit={(e) => { e.preventDefault(); setFilters({ ...draft }); setPage(1) }}>
        {/* We could add filters for marca, etc. but not required now */}
        <div className="imo-actions"><button className="imo-btn imo-btn-primary" type="submit">Aplicar</button><button className="imo-btn" type="button" onClick={clear}>Limpar</button></div>
      </form>}
    </div>

    {message && <div className="imo-message" role="status">{message}</div>}
    {(error) && <div className="imo-message error" role="alert">{error}<button className="imo-btn" onClick={() => setRevision((v) => v + 1)}>Tentar novamente</button></div>}

    <div className="imo-grid" aria-busy={loading}>
      <div className="imo-table-scroll"><table className="imo-table">
        <caption className="imo-sr-only">Modelos de impressoras cadastrados</caption>
        <thead><tr>{['Nome', 'Marca', 'Descrição', 'Estoque Mínimo Toner', 'Estoque Mínimo Cilindro', 'Ações'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={6} className="imo-empty" role="status">Carregando modelos…</td></tr> : data.items.length === 0 ? <tr><td colSpan={6} className="imo-empty">{error ? 'Não foi possível carregar a listagem.' : 'Nenhum modelo encontrado.'}</td></tr> : data.items.map((row) => <tr key={row.id}>
          <td><strong className="imo-name">{row.nome_modelo || '—'}</strong></td>
          <td className="imo-muted">{row.marca || '—'}</td>
          <td>{row.descricao || '—'}</td>
          <td className="imo-number">{row.estoque_minimo_toner ?? 0}</td>
          <td className="imo-number">{row.estoque_minimo_cilindro ?? 0}</td>
          <td className="imo-actions"><button className="imo-btn imo-btn-icon" title="Visualizar" aria-label="Visualizar modelo" onClick={() => setDialog({ mode: 'view', id: row.id })}><span className="mat">visibility</span></button><button className="imo-btn imo-btn-icon" title="Editar" aria-label="Editar modelo" onClick={() => setDialog({ mode: 'edit', id: row.id })}><span className="mat">edit</span></button><button className="imo-btn imo-btn-icon danger" title="Excluir" aria-label="Excluir modelo" disabled={deleting !== null} onClick={() => remove(row)}><span className="mat">delete</span></button></td>
        </tr>)}</tbody>
      </table></div>
      <footer className="imo-pagination">
        <span>{data.total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)}` : '0'} de {data.total} registros</span>
        <label>Por página: <select aria-label="Registros por página" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>{[10, 20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></label>
        <div className="imo-actions"><button className="imo-btn" disabled={loading || page <= 1} onClick={() => setPage((v) => v - 1)}>Anterior</button><span>{page} / {Math.max(1, data.total_pages)}</span><button className="imo-btn" disabled={loading || page >= data.total_pages} onClick={() => setPage((v) => v + 1)}>Próximo</button></div>
      </footer>
    </div>

    {dialog && (
       <ImpressoraModelosDialog
         {...dialog}
         onClose={() => setDialog(null)}
         onSaved={(text) => {
           setDialog(null);
           setMessage(text);
           setRevision(v => v + 1);
           onChanged?.();
         }}
       />
)}
   </section>
}
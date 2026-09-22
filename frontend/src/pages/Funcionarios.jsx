import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { listarOpcoes } from '../api/funcionarios.js'
import FuncionarioDialog from '../components/FuncionarioDialog.jsx'
import './Funcionarios.css'

const EMPTY = { items: [], total: 0, total_pages: 0 }

export default function Funcionarios({ refreshKey = 0, newRequest = 0, onChanged }) {
  const [data, setData] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ setor_id: '' })
  const [draft, setDraft] = useState(filters)
  const [showFilters, setShowFilters] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [optionError, setOptionError] = useState('')
  const [message, setMessage] = useState('')
  const [dialog, setDialog] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [setores, setSetores] = useState([])
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
    api('setores', 'listar', { params: { limit: 200, page: 1, ativo: 1 } })
      .then((result) => { if (active) setSetores(result.items) })
      .catch((e) => { if (active) setOptionError(`Não foi possível carregar os setores: ${e.message}`) })
    return () => { active = false }
  }, [revision, refreshKey])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api('funcionarios', 'listar', { params: { search: query, ...filters, page, limit } })
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
    if (deleteLock.current || !window.confirm(`Excluir o funcionário "${row.nome}"? Esta ação não pode ser desfeita.`)) return
    deleteLock.current = true
    setDeleting(row.id)
    setMessage('')
    setError('')
    try {
      await api('funcionarios', 'excluir', { method: 'POST', body: { id: row.id } })
      setMessage('Funcionário excluído com sucesso.')
      setRevision((v) => v + 1)
      onChanged?.()
    } catch (e) { setError(e.message) }
    finally { deleteLock.current = false; setDeleting(null) }
  }

  function clear() {
    setSearch(''); setQuery(''); setFilters({ setor_id: '' }); setDraft({ setor_id: '' }); setPage(1)
  }

  return <section className="func-page" aria-labelledby="func-page-title">
    <header className="func-page-header">
      <div>
        <div className="func-breadcrumb">Ativos de TI / Funcionários</div>
        <h1 id="func-page-title"><span className="mat" aria-hidden="true">badge</span>Funcionários</h1>
        <p>Cadastro e gestão de funcionários e colaboradores.</p>
      </div>
      <button className="func-btn func-btn-primary" onClick={() => { setMessage(''); setDialog({ mode: 'new' }) }}><span className="mat" aria-hidden="true">add</span>Novo Funcionário</button>
    </header>

    <div className="func-toolbar">
      <div className="func-toolbar-row">
        <label className="func-search"><span className="mat" aria-hidden="true">search</span><input ref={searchRef} aria-label="Buscar funcionários" placeholder="Buscar funcionários…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="func-actions">
          <button className="func-btn" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="func-filters"><span className="mat" aria-hidden="true">filter_list</span>Filtros{(filters.setor_id && ' •')}</button>
          <button className="func-btn" onClick={() => setRevision((v) => v + 1)} disabled={loading}>Atualizar</button>
        </div>
      </div>
      {showFilters && <form id="func-filters" className="func-filters" onSubmit={(e) => { e.preventDefault(); setFilters({ ...draft }); setPage(1) }}>
        <label>Setor: <select aria-label="Filtrar por setor" value={draft.setor_id} onChange={(e) => setDraft({ setor_id: e.target.value })}><option value="">Todos os Setores</option>{setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>
        <div className="func-actions"><button className="func-btn func-btn-primary" type="submit">Aplicar</button><button className="func-btn" type="button" onClick={clear}>Limpar</button></div>
      </form>}
    </div>

    {message && <div className="func-message" role="status">{message}</div>}
    {(error || optionError) && <div className="func-message error" role="alert">{error || optionError}<button className="func-btn" onClick={() => setRevision((v) => v + 1)}>Tentar novamente</button></div>}

    <div className="func-grid" aria-busy={loading}>
      <div className="func-table-scroll"><table className="func-table">
        <caption className="func-sr-only">Funcionários cadastrados</caption>
        <thead><tr>{['Nome', 'Cargo', 'Setor', 'RG', 'E-mail', 'Ações'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={6} className="func-empty" role="status">Carregando funcionários…</td></tr> : data.items.length === 0 ? <tr><td colSpan={6} className="func-empty">{error ? 'Não foi possível carregar a listagem.' : 'Nenhum funcionário encontrado.'}</td></tr> : data.items.map((row) => <tr key={row.id}>
          <td><strong className="func-name">{row.nome || '—'}</strong></td>
          <td className="func-muted">{row.cargo || '—'}</td>
          <td className="func-muted">{row.setor_nome || row.setor || '—'}</td>
          <td className="func-muted">{row.rg || '—'}</td>
          <td className="func-muted">{row.email || '—'}</td>
          <td><div className="func-actions"><button className="func-btn func-btn-icon" title="Visualizar" aria-label="Visualizar funcionário" onClick={() => setDialog({ mode: 'view', id: row.id })}><span className="mat">visibility</span></button><button className="func-btn func-btn-icon" title="Editar" aria-label="Editar funcionário" onClick={() => setDialog({ mode: 'edit', id: row.id })}><span className="mat">edit</span></button><button className="func-btn func-btn-icon danger" title="Excluir" aria-label="Excluir funcionário" disabled={deleting !== null} onClick={() => remove(row)}><span className="mat">delete</span></button></div></td>
        </tr>)}</tbody>
      </table></div>
      <footer className="func-pagination">
        <span>{data.total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)}` : '0'} de {data.total} registros</span>
        <label>Por página: <select aria-label="Registros por página" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>{[10, 20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select></label>
        <div className="func-actions"><button className="func-btn" disabled={loading || page <= 1} onClick={() => setPage((v) => v - 1)}>Anterior</button><span>{page} / {Math.max(1, data.total_pages)}</span><button className="func-btn" disabled={loading || page >= data.total_pages} onClick={() => setPage((v) => v + 1)}>Próximo</button></div>
      </footer>
    </div>

    {dialog && <FuncionarioDialog {...dialog} onClose={() => setDialog(null)} onSaved={(text) => { setDialog(null); setMessage(text); setRevision((v) => v + 1); onChanged?.() }} />}
  </section>
}
